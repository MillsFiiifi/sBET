// Verify-then-credit pipeline for Paystack mobile-money charges. Idempotent on
// our reference: once the payment row is 'success' we short-circuit to
// 'already-credited'. Mirrors flutterwave-credit so the poller sees the same
// { ok, status } shape.

import { findPaymentByReference, markPaymentResolved, updatePayment } from '@/lib/payments-store'
import { verifyTransaction, isPaystackSuccessful } from '@/lib/paystack'
import { applyDepositCredit } from '@/lib/deposit-credit'

export interface PaystackCreditResult {
  status: string
  ok: boolean
  reference: string
}

export async function verifyAndCreditPaystack(reference: string): Promise<PaystackCreditResult> {
  if (!reference) return { status: 'missing-reference', ok: false, reference }

  const pending = await findPaymentByReference(reference)
  if (!pending) return { status: 'unknown-reference', ok: false, reference }
  if (pending.status === 'success') return { status: 'already-credited', ok: true, reference }

  let verified
  try {
    verified = await verifyTransaction(reference)
  } catch (e) {
    console.error('[paystack-credit] verify failed:', e)
    return { status: 'verify-failed', ok: false, reference }
  }

  if (!isPaystackSuccessful(verified.status)) {
    // 'failed'/'abandoned' are terminal; anything else keeps the poller waiting.
    return { status: verified.found ? verified.status : 'pending', ok: false, reference }
  }

  if (typeof verified.amount === 'number' && Math.abs(verified.amount - pending.amount) > 0.01) {
    console.error('[paystack-credit] amount mismatch', {
      reference,
      expected: pending.amount,
      paid: verified.amount,
    })
    return { status: 'amount-mismatch', ok: false, reference }
  }

  if (!pending.userId) return { status: 'no-user', ok: false, reference }

  const resolved = await markPaymentResolved(pending.id, 'paystack verified')
  if (!resolved) return { status: 'already-credited', ok: true, reference }

  try {
    await applyDepositCredit(pending.userId, pending.amount)
  } catch (e) {
    console.error('[paystack-credit] credit failed after resolve, reverting:', e)
    await updatePayment(pending.id, { status: 'pending' }).catch(() => null)
    return { status: 'credit-failed', ok: false, reference }
  }

  return { status: 'success', ok: true, reference }
}
