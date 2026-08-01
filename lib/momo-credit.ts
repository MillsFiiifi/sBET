// Verify-then-credit pipeline for MTN MoMo deposits. Mirrors paystack-credit:
// idempotent on the reference (the MoMo X-Reference-Id), safe to poll.

import { findPaymentByReference, markPaymentResolved } from '@/lib/payments-store'
import { getRequestToPayStatus, isSandbox } from '@/lib/momo'
import { applyDepositCredit } from '@/lib/deposit-credit'

export type MomoCreditStatus =
  | 'success'
  | 'already-credited'
  | 'pending'
  | 'failed'
  | 'sandbox'
  | 'missing-reference'
  | 'unknown-reference'
  | 'status-failed'
  | 'amount-mismatch'
  | 'no-user'
  | 'credit-failed'

export interface MomoCreditResult {
  status: MomoCreditStatus
  ok: boolean
  reference: string
  reason?: string | null
}

export async function verifyAndCreditMomo(reference: string): Promise<MomoCreditResult> {
  if (!reference) return { status: 'missing-reference', ok: false, reference }

  const pending = await findPaymentByReference(reference)
  if (!pending) return { status: 'unknown-reference', ok: false, reference }
  if (pending.status === 'success') {
    return { status: 'already-credited', ok: true, reference }
  }

  let result
  try {
    result = await getRequestToPayStatus(reference)
  } catch (e) {
    console.error('[momo-credit] status check failed:', e)
    return { status: 'status-failed', ok: false, reference }
  }

  if (result.status === 'PENDING') {
    return { status: 'pending', ok: false, reference, reason: result.reason }
  }
  if (result.status === 'FAILED') {
    return { status: 'failed', ok: false, reference, reason: result.reason }
  }

  // SAFETY GUARD: the sandbox simulator reports SUCCESSFUL without any real
  // money moving. NEVER credit a real wallet balance from sandbox — otherwise
  // a live site on sandbox creds would hand out free balance. Only production
  // (mtnghana) credits.
  if (isSandbox()) {
    console.warn('[momo-credit] sandbox success ignored — no real funds, not crediting', reference)
    return {
      status: 'sandbox',
      ok: false,
      reference,
      reason: 'Sandbox test mode — no real money moved; balance not credited.',
    }
  }

  // SUCCESSFUL — sanity-check the amount the network actually debited.
  if (result.amount != null && Math.abs(result.amount - pending.amount) > 0.01) {
    console.error('[momo-credit] amount mismatch', {
      reference,
      pendingAmount: pending.amount,
      paidAmount: result.amount,
    })
    return { status: 'amount-mismatch', ok: false, reference }
  }
  if (!pending.userId) {
    return { status: 'no-user', ok: false, reference }
  }

  try {
    const resolved = await markPaymentResolved(pending.id, 'momo auto-verify')
    if (!resolved) {
      // Another poll / admin path already credited this reference.
      return { status: 'already-credited', ok: true, reference }
    }
    await applyDepositCredit(pending.userId, pending.amount, { reference })
  } catch (e) {
    console.error('[momo-credit] credit pipeline failed:', e)
    return { status: 'credit-failed', ok: false, reference }
  }

  return { status: 'success', ok: true, reference }
}
