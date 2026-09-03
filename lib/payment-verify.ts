// One verify-then-credit entry point that works for any gateway.
//
// Why this exists: a poller that hardcodes one provider's status endpoint goes
// wrong the moment a deposit is taken by a different one. The provider it asks
// has never heard of the reference, so the answer is "not confirmed" forever —
// on a payment the webhook has already credited correctly. The money is fine;
// the screen is what's broken, and it looks exactly like a lost deposit to the
// player and to support. AkwaPay's migration notes call this out as the single
// most common bug they find in partner integrations.
//
// So: route on the provider stored on our own payments row, never on which
// gateway happens to be wired up on the deposit page today. Old pending rows
// from a previous gateway keep resolving through the code that understands
// them.

import { findPaymentByReference, type PaymentRecord } from '@/lib/payments-store'
import { verifyAndCreditAkwapay } from '@/lib/akwapay-credit'
import { verifyAndCreditFlutterwave } from '@/lib/flutterwave-credit'
import { verifyAndCreditPaystack } from '@/lib/paystack-credit'
import { finalizeWithdrawalFromFee } from '@/lib/flutterwave-withdrawal'
import { classifyIntentStatus } from '@/lib/akwapay'

export interface PaymentVerifyResult {
  status: string
  ok: boolean
  reference: string
  /** Which pipeline answered — useful in logs when a poll looks stuck. */
  provider: string | null
  /** Terminal success: the client can stop polling and show the balance. */
  done: boolean
  /** Terminal failure: stop polling, but say why. */
  failed: boolean
}

// Outcomes that will never change on their own, whoever the provider is.
const DEAD = new Set([
  'missing-reference',
  'unknown-reference',
  'unknown-intent',
  'no-intent',
  'no-user',
  'missing-charge-id',
  'amount-mismatch',
  'abandoned',
])

export async function verifyPaymentByReference(reference: string): Promise<PaymentVerifyResult> {
  const ref = reference.trim()
  if (!ref) return settle({ status: 'missing-reference', ok: false, reference }, null)

  const row = await findPaymentByReference(ref).catch(() => null)
  if (!row) return settle({ status: 'unknown-reference', ok: false, reference: ref }, null)

  const provider = (row.provider ?? '').trim().toLowerCase()

  // A withdrawal fee is verified but never credited to the wallet — it pays for
  // the payout rather than topping it up.
  const isFee = row.metadata?.purpose === 'withdrawal-fee'

  switch (provider) {
    case 'akwapay': {
      const result = await verifyAndCreditAkwapay(ref, { credit: !isFee })
      await maybeFinalizeFee(isFee, result.status, row)
      return settle(result, provider)
    }
    case 'flutterwave': {
      const result = await verifyAndCreditFlutterwave(ref, { credit: !isFee })
      await maybeFinalizeFee(isFee, result.status, row)
      return settle(result, provider)
    }
    case 'paystack': {
      return settle(await verifyAndCreditPaystack(ref), provider)
    }
    default:
      // Manual MoMo, USDT and the retired Moolre rail have no status API we can
      // ask — an admin (or a callback) resolves the row. Report what the ledger
      // already says rather than inventing a verdict.
      return settle(
        {
          status: row.status === 'success' ? 'already-credited' : row.status,
          ok: row.status === 'success',
          reference: ref,
        },
        provider || null,
      )
  }
}

async function maybeFinalizeFee(isFee: boolean, status: string, row: PaymentRecord) {
  if (!isFee || status !== 'success') return
  await finalizeWithdrawalFromFee(row)
}

function settle(
  result: { status: string; ok: boolean; reference: string },
  provider: string | null,
): PaymentVerifyResult {
  const done = result.status === 'success' || result.status === 'already-credited'
  // classifyIntentStatus is AkwaPay's vocabulary, but the words it treats as
  // terminal ('failed', 'cancelled', 'expired') are the same ones every gateway
  // here uses — and anything it doesn't recognise stays pending, which is the
  // safe way round. AkwaPay's `unknown` in particular means "no answer yet",
  // never "failed": stopping on it strands a payment that is still landing.
  const failed = !done && (DEAD.has(result.status) || classifyIntentStatus(result.status) === 'failed')
  return { ...result, provider, done, failed }
}
