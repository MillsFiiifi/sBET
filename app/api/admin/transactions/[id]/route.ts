import { NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-guard'
import { findTransactionById, setTransactionStatus } from '@/lib/transactions-store'
import { addCommission, recordDeposit, recordWithdrawal } from '@/lib/users-store'
import { creditCommission } from '@/lib/sub-admins-store'
import { COMMISSION_RATE } from '@/lib/domain-types'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/transactions/:id  { action: 'approve' | 'decline' }
 * Approving a deposit credits the balance; approving a withdrawal debits it.
 * Declining just marks the request cancelled — no balance change.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params
  let body: { action?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const tx = await findTransactionById(id)
  if (!tx) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (tx.status !== 'pending') {
    return NextResponse.json({ error: 'transaction already processed' }, { status: 409 })
  }

  if (body.action === 'decline') {
    const updated = await setTransactionStatus(id, 'cancelled')
    return NextResponse.json({ transaction: updated })
  }

  if (body.action !== 'approve') {
    return NextResponse.json({ error: "action must be 'approve' or 'decline'" }, { status: 400 })
  }
  if (!tx.userId) {
    return NextResponse.json({ error: 'transaction has no user' }, { status: 400 })
  }

  // Apply the balance change first, then mark the ledger row completed.
  if (tx.type === 'deposit') {
    const res = await recordDeposit(tx.userId, tx.amount)
    if (!res) return NextResponse.json({ error: 'user not found' }, { status: 404 })

    // Referral commission: pay the sub-admin on the user's FIRST deposit only.
    if (res.isFirst && res.user.referredBySubAdminId) {
      const commissionAmount = +(tx.amount * COMMISSION_RATE).toFixed(2)
      if (commissionAmount > 0) {
        try {
          await addCommission({
            subAdminId: res.user.referredBySubAdminId,
            userId: res.user.id,
            depositAmount: tx.amount,
            commission: commissionAmount,
            rate: COMMISSION_RATE,
            currency: res.user.currency,
          })
          await creditCommission(res.user.referredBySubAdminId, commissionAmount, res.user.currency)
        } catch {
          // Don't fail the deposit approval if the commission payout hiccups.
        }
      }
    }
  } else if (tx.type === 'withdrawal') {
    const res = await recordWithdrawal(tx.userId, tx.amount)
    if ('error' in res) {
      return NextResponse.json({ error: res.error }, { status: 400 })
    }
  }

  const updated = await setTransactionStatus(id, 'completed')
  return NextResponse.json({ transaction: updated })
}
