import { NextResponse } from 'next/server'
import { currentSubAdmin } from '@/lib/sub-admin-session'
import { listUsersReferredBy, listCommissionsForSubAdmin } from '@/lib/users-store'
import { listWithdrawalsForUsers } from '@/lib/payments-store'

export const dynamic = 'force-dynamic'

export async function GET() {
  const sa = await currentSubAdmin()
  if (!sa) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  try {
    const referredUsers = await listUsersReferredBy(sa.id)
    const commissions = await listCommissionsForSubAdmin(sa.id)

    const userNameById = new Map(referredUsers.map((u) => [u.id, u.name] as const))
    // Best-effort: a failure here must not take down the whole dashboard.
    const withdrawals = await listWithdrawalsForUsers(referredUsers.map((u) => u.id)).catch(
      (e) => {
        console.error('[sub-admin/me] withdrawals load failed:', e)
        return []
      },
    )

    const depositedCount = referredUsers.filter((u) => u.firstDepositAt).length

    return NextResponse.json({
    subAdmin: {
      id: sa.id,
      name: sa.name,
      email: sa.email,
      referralCode: sa.referralCode,
      approved: sa.approved,
      commissionBalance: sa.commissionBalance,
      totalCommissionEarned: sa.totalCommissionEarned,
      commissionBalances: sa.commissionBalances,
      totalCommissionEarnedBy: sa.totalCommissionEarnedBy,
      createdAt: sa.createdAt,
    },
    stats: {
      referrals: referredUsers.length,
      withDeposit: depositedCount,
      pending: referredUsers.length - depositedCount,
      commissionsCount: commissions.length,
    },
    withdrawals: withdrawals.map((w) => ({
      id: w.id,
      userId: w.userId,
      userName: (w.userId && userNameById.get(w.userId)) || '—',
      amount: w.amount,
      currency: w.currency,
      status: w.status,
      createdAt: w.createdAt,
    })),
    referredUsers: referredUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      currency: u.currency,
      createdAt: u.createdAt,
      firstDepositAmount: u.firstDepositAmount,
      firstDepositAt: u.firstDepositAt,
      totalDeposited: u.totalDeposited,
    })),
    commissions,
    })
  } catch (e) {
    console.error('[sub-admin/me] failed:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'failed to load dashboard' },
      { status: 500 },
    )
  }
}
