// Verify-then-credit pipeline for AkwaPay payment intents.
//
// The same shape as lib/flutterwave-credit.ts, and for the same reason: the
// poller, the webhook and any manual retry all funnel through one function, so
// they cannot disagree about whether a deposit landed.
//
// Idempotent on our `reference`. Once the payments row reads success we
// short-circuit — which matters here because AkwaPay delivers webhooks
// at-least-once, so a duplicate `payment_intent.succeeded` is normal traffic,
// not an anomaly.
//
// We never credit from the webhook body. The webhook only tells us *when* to
// look; GET /v1/payment_intents/{id} is what we believe.

import { findPaymentByReference, markPaymentResolved, updatePayment } from '@/lib/payments-store'
import { classifyIntentStatus, getPaymentIntent, toPesewas } from '@/lib/akwapay'
import { applyDepositCredit } from '@/lib/deposit-credit'

export interface AkwapayCreditResult {
  status: string
  ok: boolean
  reference: string
}

export async function verifyAndCreditAkwapay(
  reference: string,
  opts: { credit: boolean } = { credit: true },
): Promise<AkwapayCreditResult> {
  if (!reference) return { status: 'missing-reference', ok: false, reference }

  const pending = await findPaymentByReference(reference)
  if (!pending) return { status: 'unknown-reference', ok: false, reference }
  if (pending.status === 'success') {
    return { status: 'already-credited', ok: true, reference }
  }

  // The intent id was stashed on the row at /start. Without it there is
  // nothing to poll — the intent was never created, so the row is stale.
  const intentId = (pending.metadata?.akwapayIntentId as string | undefined)?.trim()
  if (!intentId) {
    return { status: 'no-intent', ok: false, reference }
  }

  let snapshot
  try {
    snapshot = await getPaymentIntent(intentId)
  } catch (e) {
    console.error('[akwapay-credit] intent lookup failed:', e)
    return { status: 'verify-failed', ok: false, reference }
  }

  if (!snapshot.found) return { status: 'unknown-intent', ok: false, reference }

  const verdict = classifyIntentStatus(snapshot.status)
  if (verdict !== 'success') {
    // 'pending' keeps the client polling; a terminal failure stops it. The raw
    // gateway status rides along so the UI can say something specific.
    return { status: verdict === 'failed' ? snapshot.status : 'pending', ok: false, reference }
  }

  // Both sides in pesewas — comparing minor units avoids the float wobble that
  // makes 49.999999 != 50 when you compare majors.
  if (snapshot.amountMinor != null && snapshot.amountMinor !== toPesewas(pending.amount)) {
    console.error('[akwapay-credit] amount mismatch', {
      reference,
      expectedMinor: toPesewas(pending.amount),
      paidMinor: snapshot.amountMinor,
    })
    return { status: 'amount-mismatch', ok: false, reference }
  }

  if (opts.credit && !pending.userId) {
    return { status: 'no-user', ok: false, reference }
  }

  const resolved = await markPaymentResolved(pending.id, 'akwapay verified')
  if (!resolved) {
    // The webhook and a poll tick raced; whoever won owns the credit.
    return { status: 'already-credited', ok: true, reference }
  }

  if (opts.credit && pending.userId) {
    try {
      await applyDepositCredit(pending.userId, pending.amount)
    } catch (e) {
      console.error('[akwapay-credit] credit failed after resolve, reverting:', e)
      // Back to pending so the next poll or webhook retries, rather than
      // short-circuiting to 'already-credited' forever on an uncredited row.
      await updatePayment(pending.id, { status: 'pending' }).catch(() => null)
      return { status: 'credit-failed', ok: false, reference }
    }
  }

  return { status: 'success', ok: true, reference }
}
