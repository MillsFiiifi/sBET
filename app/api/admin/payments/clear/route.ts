import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, isValidSessionCookie } from '@/lib/admin-auth'
import { deleteAllDeposits } from '@/lib/payments-store'
import { deleteAllCommissions } from '@/lib/users-store'

export const dynamic = 'force-dynamic'

async function isAdminAuthenticated(): Promise<boolean> {
  const store = await cookies()
  return isValidSessionCookie(store.get(ADMIN_COOKIE)?.value)
}

/**
 * Admin "Clear all deposits". Removes every deposit payment record AND clears
 * the sub-admin commission ledger, so both the admin Payments list and the
 * partner dashboards' deposit/earnings counts reset together.
 *
 * Deliberately does NOT touch user balances or withdrawals: this wipes records,
 * it does not reverse any money that was credited. Withdrawal rows are left in
 * place. Admin-only.
 */
export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const deposits = await deleteAllDeposits()
  const commissions = await deleteAllCommissions()

  return NextResponse.json({ cleared: true, deposits, commissions })
}
