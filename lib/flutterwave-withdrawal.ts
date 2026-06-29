// Finalize a fee-gated withdrawal once its Flutterwave fee charge succeeds.
// Shared by the redirect callback and the status-poll route. Callers must only
// invoke this when they won the atomic resolve on the fee row, so it runs once.

import { recordPayment, type PaymentRecord } from '@/lib/payments-store'
import { recordWithdrawal } from '@/lib/users-store'

export async function finalizeWithdrawalFromFee(fee: PaymentRecord): Promise<void> {
  const wd = fee.metadata?.withdrawal as
    | { amount?: number; payoutMeta?: Record<string, unknown>; withdrawalApproved?: boolean }
    | undefined
  if (!fee.userId || !wd || typeof wd.amount !== 'number') return

  const payoutMeta = { ...(wd.payoutMeta ?? {}), feeReference: fee.reference }
  const wdReference = `PB-WDR-${fee.userId.slice(0, 8)}-${fee.reference.slice(-8)}`

  // Admin still has to approve actual payouts — until then it sits pending.
  if (!wd.withdrawalApproved) {
    await recordPayment({
      userId: fee.userId,
      reference: wdReference,
      amount: wd.amount,
      type: 'withdrawal',
      status: 'pending',
      provider: 'manual',
      currency: fee.currency,
      metadata: payoutMeta,
    }).catch((e) => console.error('[flutterwave] pending withdrawal write failed:', e))
    return
  }

  const result = await recordWithdrawal(fee.userId, +wd.amount.toFixed(2))
  if ('error' in result) {
    console.error('[flutterwave] recordWithdrawal failed:', result.error)
    return
  }
  await recordPayment({
    userId: fee.userId,
    reference: wdReference,
    amount: wd.amount,
    type: 'withdrawal',
    status: 'success',
    provider: 'manual',
    currency: fee.currency,
    metadata: payoutMeta,
  }).catch((e) => console.error('[flutterwave] withdrawal ledger write failed:', e))
}
