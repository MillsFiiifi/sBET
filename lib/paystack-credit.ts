// Shared verify-then-credit pipeline for Paystack deposits.
//
// Used by:
//   - /api/payments/paystack/callback (GET, legacy redirect flow / popup-blocked fallback)
//   - /api/payments/paystack/verify (POST, inline JS popup flow)
//
// Idempotent on the `reference`: callers can safely re-run this for the same
// reference and it will short-circuit to 'already-credited' once the row is
// marked success.

import { findPaymentByReference, markPaymentResolved } from '@/lib/payments-store'
import { verifyTransaction, fromMinorUnits } from '@/lib/paystack'
import { applyDepositCredit } from '@/lib/deposit-credit'
import { isCurrencyCode, type CurrencyCode } from '@/lib/countries'

export type PaystackCreditStatus =
  | 'success'
  | 'already-credited'
  | 'missing-reference'
  | 'unknown-reference'
  | 'verify-failed'
  | 'amount-mismatch'
  | 'no-user'
  | 'credit-failed'
  | string // pass-through for non-success verification statuses (failed/abandoned/…)

export interface PaystackCreditResult {
  status: PaystackCreditStatus
  ok: boolean
  reference: string
}

export async function verifyAndCreditPaystack(
  reference: string,
): Promise<PaystackCreditResult> {
  if (!reference) {
    return { status: 'missing-reference', ok: false, reference }
  }

  const pending = await findPaymentByReference(reference)
  if (!pending) {
    return { status: 'unknown-reference', ok: false, reference }
  }

  if (pending.status === 'success') {
    return { status: 'already-credited', ok: true, reference }
  }

  let verified
  try {
    verified = await verifyTransaction(reference)
  } catch (e) {
    console.error('[paystack-credit] verify failed:', e)
    return { status: 'verify-failed', ok: false, reference }
  }

  if (verified.status !== 'success') {
    return { status: verified.status, ok: false, reference }
  }

  const currency: CurrencyCode = isCurrencyCode(verified.currency)
    ? verified.currency
    : (pending.currency as CurrencyCode)
  const major = fromMinorUnits(verified.amount, currency)

  if (Math.abs(major - pending.amount) > 0.01) {
    console.error('[paystack-credit] amount mismatch', {
      reference,
      pendingAmount: pending.amount,
      paidAmount: major,
    })
    return { status: 'amount-mismatch', ok: false, reference }
  }

  if (!pending.userId) {
    console.error('[paystack-credit] missing userId on pending row', reference)
    return { status: 'no-user', ok: false, reference }
  }

  try {
    const resolved = await markPaymentResolved(pending.id, 'paystack auto-verify')
    if (!resolved) {
      // Another path (admin manual credit, redirect callback racing the inline
      // verify) already ran the credit pipeline on this reference.
      return { status: 'already-credited', ok: true, reference }
    }
    await applyDepositCredit(pending.userId, pending.amount, { reference })
  } catch (e) {
    console.error('[paystack-credit] credit pipeline failed:', e)
    return { status: 'credit-failed', ok: false, reference }
  }

  return { status: 'success', ok: true, reference }
}
