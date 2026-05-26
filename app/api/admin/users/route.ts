import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { listUsersForAdmin } from '@/lib/users-store'
import { ADMIN_COOKIE, isValidSessionCookie } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

async function isAdminAuthenticated(): Promise<boolean> {
  const store = await cookies()
  return isValidSessionCookie(store.get(ADMIN_COOKIE)?.value)
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const users = await listUsersForAdmin()
  // Don't leak password hashes
  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone ?? null,
      verificationStep: u.verificationStep ?? 0,
      withdrawalApproved: u.withdrawalApproved ?? false,
      balance: u.balance ?? 0,
      totalDeposited: u.totalDeposited,
      totalWithdrawn: u.totalWithdrawn ?? 0,
      firstDepositAt: u.firstDepositAt ?? null,
      createdAt: u.createdAt,
    })),
  })
}
