import { NextResponse } from 'next/server'
import { currentSubAdmin } from '@/lib/sub-admin-session'
import { listUsersReferredBy, listCommissionsForSubAdmin } from '@/lib/users-store'

export const dynamic = 'force-dynamic'

export async function GET() {
  const sa = await currentSubAdmin()
  if (!sa) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const referredUsers = await listUsersReferredBy(sa.id)
  const commissions = await listCommissionsForSubAdmin(sa.id)

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
}
