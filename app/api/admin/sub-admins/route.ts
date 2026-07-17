import { NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-guard'
import { readSubAdmins } from '@/lib/sub-admins-store'
import { listUsersForAdmin } from '@/lib/users-store'
import { COMMISSION_RATE } from '@/lib/domain-types'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const [subs, users] = await Promise.all([readSubAdmins(), listUsersForAdmin()])

  const referred = new Map<string, number>()
  const deposited = new Map<string, number>()
  for (const u of users) {
    const sa = u.referredBySubAdminId
    if (!sa) continue
    referred.set(sa, (referred.get(sa) ?? 0) + 1)
    if (u.firstDepositAt) deposited.set(sa, (deposited.get(sa) ?? 0) + 1)
  }

  const subAdmins = subs.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    referralCode: s.referralCode,
    approved: s.approved,
    createdAt: s.createdAt,
    commissionBalances: s.commissionBalances,
    totalCommissionEarnedBy: s.totalCommissionEarnedBy,
    referredUsers: referred.get(s.id) ?? 0,
    depositedUsers: deposited.get(s.id) ?? 0,
  }))

  return NextResponse.json({ subAdmins, rate: COMMISSION_RATE })
}
