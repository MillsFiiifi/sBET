// Shared verify-then-credit pipeline for Korapay deposits.
//
// Used by:
//   - /api/payments/korapay/callback (GET, user redirect after checkout)
//   - /api/payments/korapay/verify   (POST, frontend confirm after popup/redirect)
//   - /api/payments/korapay/webhook  (POST, Korapay server-to-server, signed)
//
// Idempotent on the `reference`: callers can safely re-run this for the same
// reference and it short-circuits to 'already-credited' once the row is
// marked success. The atomic markPaymentResolved gate guarantees only ONE
// path runs applyDepositCredit even under a redirect/webhook race.
//
// We re-verify against Korapay's authoritative GET /charges/:reference rather
// than trusting the redirect URL or webhook body — and credit only when the
// inner data.status === 'success'.

import { findPaymentByReference, markPaymentResolved } from '@/lib/payments-store'
import { verifyCharge, toAmountNumber } from '@/lib/korapay'
import { applyDepositCredit } from '@/lib/deposit-credit'
import { getCountryForCurrency, isCurrencyCode } from '@/lib/countries'

export type KorapayCreditStatus =
  | 'success'
  | 'already-credited'
  | 'missing-reference'
  | 'unknown-reference'
  | 'verify-failed'
  | 'amount-mismatch'
  | 'no-user'
  | 'credit-failed'
  | string // pass-through for non-success charge statuses (processing/failed/…)

export interface KorapayCreditResult {
  status: KorapayCreditStatus
  ok: boolean
  reference: string
}

export async function verifyAndCreditKorapay(
  reference: string,
): Promise<KorapayCreditResult> {
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

  // Verify against the same Korapay account the charge was created on. The
  // account is keyed by country, which we recover from the pending row's
  // currency (GHS → GH, NGN → NG).
  const country = isCurrencyCode(pending.currency)
    ? getCountryForCurrency(pending.currency).code
    : undefined

  let charge
  try {
    charge = await verifyCharge(reference, country)
  } catch (e) {
    console.error('[korapay-credit] verify failed:', e)
    return { status: 'verify-failed', ok: false, reference }
  }

  if (charge.status !== 'success') {
    return { status: charge.status, ok: false, reference }
  }

  // Korapay returns major-unit amounts (no minor-unit conversion). Prefer the
  // settled amount_paid when present, fall back to the charge amount.
  const paid = toAmountNumber(charge.amount_paid ?? charge.amount)
  if (!Number.isFinite(paid) || Math.abs(paid - pending.amount) > 0.01) {
    console.error('[korapay-credit] amount mismatch', {
      reference,
      pendingAmount: pending.amount,
      paidAmount: paid,
    })
    return { status: 'amount-mismatch', ok: false, reference }
  }

  if (!pending.userId) {
    console.error('[korapay-credit] missing userId on pending row', reference)
    return { status: 'no-user', ok: false, reference }
  }

  try {
    const resolved = await markPaymentResolved(pending.id, 'korapay auto-verify')
    if (!resolved) {
      // Another path (redirect callback racing the webhook, or admin manual
      // credit) already ran the credit pipeline on this reference.
      return { status: 'already-credited', ok: true, reference }
    }
    await applyDepositCredit(pending.userId, pending.amount, { reference })
  } catch (e) {
    console.error('[korapay-credit] credit pipeline failed:', e)
    return { status: 'credit-failed', ok: false, reference }
  }

  return { status: 'success', ok: true, reference }
}
