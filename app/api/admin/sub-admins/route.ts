import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, isValidSessionCookie } from '@/lib/admin-auth'
import { readSubAdmins } from '@/lib/sub-admins-store'
import { readUsers, readCommissions } from '@/lib/users-store'

export const dynamic = 'force-dynamic'

export async function GET() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value
  if (!(await isValidSessionCookie(token))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const [subAdmins, users, commissions] = await Promise.all([
    readSubAdmins(),
    readUsers(),
    readCommissions(),
  ])

  // Enrich each sub-admin with referral / commission stats.
  const enriched = subAdmins.map((sa) => {
    const refs = users.filter((u) => u.referredBySubAdminId === sa.id)
    const withDeposit = refs.filter((u) => u.firstDepositAt).length
    const myCommissions = commissions.filter((c) => c.subAdminId === sa.id)
    return {
      id: sa.id,
      name: sa.name,
      email: sa.email,
      referralCode: sa.referralCode,
      approved: sa.approved,
      createdAt: sa.createdAt,
      commissionBalance: sa.commissionBalance,
      totalCommissionEarned: sa.totalCommissionEarned,
      commissionBalances: sa.commissionBalances,
      totalCommissionEarnedBy: sa.totalCommissionEarnedBy,
      referrals: refs.length,
      withDeposit,
      commissionsCount: myCommissions.length,
    }
  })

  // Per-currency platform totals.
  const referredDepositsByCurrency: Record<string, number> = {}
  const subAdminShareByCurrency: Record<string, number> = {}
  const adminShareByCurrency: Record<string, number> = {}
  for (const c of commissions) {
    const cur = c.currency
    referredDepositsByCurrency[cur] = +((referredDepositsByCurrency[cur] ?? 0) + c.depositAmount).toFixed(2)
    subAdminShareByCurrency[cur] = +((subAdminShareByCurrency[cur] ?? 0) + c.commission).toFixed(2)
    adminShareByCurrency[cur] = +((adminShareByCurrency[cur] ?? 0) + (c.depositAmount - c.commission)).toFixed(2)
  }

  return NextResponse.json({
    subAdmins: enriched,
    platform: {
      referredDepositsByCurrency,
      subAdminShareByCurrency,
      adminShareByCurrency,
    },
  })
}
