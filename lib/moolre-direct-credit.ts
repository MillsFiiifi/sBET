// Verify-then-credit pipeline for Moolre direct (in-app) MoMo deposits.
// Idempotent on the externalref (which we store as the payment reference).

import { findPaymentByReference, markPaymentResolved } from '@/lib/payments-store'
import { getMoolreDirectStatus, verifyMoolreTransaction } from '@/lib/moolre'
import { applyDepositCredit } from '@/lib/deposit-credit'

export type MoolreDirectStatus =
  | 'success'
  | 'already-credited'
  | 'pending'
  | 'failed'
  | 'missing-reference'
  | 'unknown-reference'
  | 'status-failed'
  | 'no-user'
  | 'credit-failed'

export interface MoolreDirectResult {
  status: MoolreDirectStatus
  ok: boolean
  reference: string
  reason?: string | null
}

export async function verifyAndCreditMoolreDirect(
  reference: string,
): Promise<MoolreDirectResult> {
  if (!reference) return { status: 'missing-reference', ok: false, reference }

  const pending = await findPaymentByReference(reference)
  if (!pending) return { status: 'unknown-reference', ok: false, reference }
  if (pending.status === 'success') {
    return { status: 'already-credited', ok: true, reference }
  }

  let result
  try {
    result = await getMoolreDirectStatus(reference)
  } catch (e) {
    console.error('[moolre-direct-credit] status check failed:', e)
    return { status: 'status-failed', ok: false, reference }
  }

  if (result.state === 'failed') {
    return { status: 'failed', ok: false, reference, reason: result.message }
  }
  // 'pending' and 'not-found' (just-kicked-off) → keep polling.
  if (result.state !== 'success') {
    return { status: 'pending', ok: false, reference, reason: result.message }
  }

  if (!pending.userId) return { status: 'no-user', ok: false, reference }

  try {
    const resolved = await markPaymentResolved(pending.id, 'moolre direct confirm')
    if (!resolved) return { status: 'already-credited', ok: true, reference }
    await applyDepositCredit(pending.userId, pending.amount, { reference })
  } catch (e) {
    console.error('[moolre-direct-credit] credit pipeline failed:', e)
    return { status: 'credit-failed', ok: false, reference }
  }

  return { status: 'success', ok: true, reference }
}

/**
 * Verify-then-credit for Moolre HOSTED checkout deposits (the `flow: 'api-init'`
 * rows minted by /api/payments/moolre/start). Uses Moolre's `state: confirm`
 * endpoint. This is the safety net for when Moolre's redirect back to our
 * callback never lands (the player closed the tab, lost signal, etc.) — the
 * account page calls reconcile on load and any settled hosted deposit credits
 * here instead. Idempotent: markPaymentResolved guards against double-credit.
 */
export async function verifyAndCreditMoolreHosted(
  reference: string,
): Promise<MoolreDirectResult> {
  if (!reference) return { status: 'missing-reference', ok: false, reference }

  const pending = await findPaymentByReference(reference)
  if (!pending) return { status: 'unknown-reference', ok: false, reference }
  if (pending.status === 'success') {
    return { status: 'already-credited', ok: true, reference }
  }

  let verified
  try {
    verified = await verifyMoolreTransaction(reference)
  } catch (e) {
    console.error('[moolre-hosted-credit] confirm failed:', e)
    return { status: 'status-failed', ok: false, reference }
  }

  // Not successful (yet). Leave it pending so a later reconcile can retry — a
  // hosted confirm returns not-ok for both "still pending" and "never paid".
  if (!verified.ok) {
    return { status: 'pending', ok: false, reference, reason: verified.message }
  }

  if (!pending.userId) return { status: 'no-user', ok: false, reference }

  try {
    const resolved = await markPaymentResolved(pending.id, 'moolre hosted reconcile')
    if (!resolved) return { status: 'already-credited', ok: true, reference }
    await applyDepositCredit(pending.userId, pending.amount, { reference })
  } catch (e) {
    console.error('[moolre-hosted-credit] credit pipeline failed:', e)
    return { status: 'credit-failed', ok: false, reference }
  }

  return { status: 'success', ok: true, reference }
}
