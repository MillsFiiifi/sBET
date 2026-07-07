import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, isValidSessionCookie } from '@/lib/admin-auth'
import { readSubAdmins } from '@/lib/sub-admins-store'
import { readUsers, readCommissions } from '@/lib/users-store'
import { listAllPayments } from '@/lib/payments-store'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Admin-only: sub-admins must not see the platform's 40% share or any
  // cross-partner data.
  const token = (await cookies()).get(ADMIN_COOKIE)?.value
  if (!(await isValidSessionCookie(token))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const [subAdmins, users, commissions, withdrawalPayments] = await Promise.all([
    readSubAdmins(),
    readUsers(),
    readCommissions(),
    listAllPayments({ type: 'withdrawal', limit: 5000 }),
  ])

  // Sum each sub-admin's referred users' *successful* withdrawals, per currency.
  const subAdminByUserId = new Map(users.map((u) => [u.id, u.referredBySubAdminId]))
  const withdrawnBySubAdmin: Record<string, Record<string, number>> = {}
  for (const p of withdrawalPayments) {
    if (p.status !== 'success' || !p.userId) continue
    const said = subAdminByUserId.get(p.userId)
    if (!said) continue
    const cur = p.currency || 'GHS'
    withdrawnBySubAdmin[said] ??= {}
    withdrawnBySubAdmin[said][cur] = +(((withdrawnBySubAdmin[said][cur] ?? 0) + p.amount)).toFixed(2)
  }

  // Enrich each sub-admin with referral / commission stats
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
      // Legacy GHS scalars retained so older clients keep rendering.
      commissionBalance: sa.commissionBalance,
      totalCommissionEarned: sa.totalCommissionEarned,
      // Per-currency authoritative balances.
      commissionBalances: sa.commissionBalances,
      totalCommissionEarnedBy: sa.totalCommissionEarnedBy,
      referrals: refs.length,
      withDeposit,
      commissionsCount: myCommissions.length,
      // Total their referred users have successfully withdrawn, per currency.
      referredWithdrawnByCurrency: withdrawnBySubAdmin[sa.id] ?? {},
    }
  })

  // Per-currency platform totals. Every commission row carries its own
  // currency now, so we group there instead of summing into a single number.
  const referredDepositsByCurrency: Record<string, number> = {}
  const subAdminShareByCurrency: Record<string, number> = {}
  const adminShareByCurrency: Record<string, number> = {}
  for (const c of commissions) {
    const cur = c.currency
    referredDepositsByCurrency[cur] = +(((referredDepositsByCurrency[cur] ?? 0) + c.depositAmount)).toFixed(2)
    subAdminShareByCurrency[cur] = +(((subAdminShareByCurrency[cur] ?? 0) + c.commission)).toFixed(2)
    adminShareByCurrency[cur] = +(((adminShareByCurrency[cur] ?? 0) + (c.depositAmount - c.commission))).toFixed(2)
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
