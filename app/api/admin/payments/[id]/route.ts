import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, isValidSessionCookie } from '@/lib/admin-auth'
import { deletePayment, findPaymentById } from '@/lib/payments-store'
import { reverseDeposit } from '@/lib/users-store'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

async function isAdminAuthenticated(): Promise<boolean> {
  const store = await cookies()
  return isValidSessionCookie(store.get(ADMIN_COOKIE)?.value)
}

/**
 * Admin "delete deposit" — remove a payment row from the database. If it was a
 * SUCCESSFUL deposit that credited a wallet, reverse the money first (subtract
 * the amount back off the user's balance and lifetime total) so deleting the
 * record also undoes its effect. Failed/pending rows never credited anyone, so
 * those just get deleted with no wallet change.
 */
export async function DELETE(_request: Request, { params }: Params) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const payment = await findPaymentById(id)
  if (!payment) {
    return NextResponse.json({ error: 'payment not found' }, { status: 404 })
  }

  // Only a credited deposit moved money; reverse just those.
  let reversed = 0
  if (
    payment.type === 'deposit' &&
    payment.status === 'success' &&
    payment.userId &&
    Number.isFinite(payment.amount) &&
    payment.amount > 0
  ) {
    const user = await reverseDeposit(payment.userId, payment.amount)
    if (user) reversed = payment.amount
  }

  const deleted = await deletePayment(id)
  if (!deleted) {
    return NextResponse.json({ error: 'payment not found' }, { status: 404 })
  }

  return NextResponse.json({ deleted: true, reversed, currency: payment.currency })
}
