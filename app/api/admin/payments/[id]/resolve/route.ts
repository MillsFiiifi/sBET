import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, isValidSessionCookie } from '@/lib/admin-auth'
import { findPaymentById, markPaymentResolved } from '@/lib/payments-store'
import { creditBalance } from '@/lib/users-store'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

async function isAdminAuthenticated(): Promise<boolean> {
  const store = await cookies()
  return isValidSessionCookie(store.get(ADMIN_COOKIE)?.value)
}

/**
 * Admin "Credit & resolve" — for a failed/pending Moolre row, credit the
 * user the recorded amount and flip the payment row to success so it can't
 * be credited twice.
 */
export async function POST(request: Request, { params }: Params) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await params

  let body: { note?: string } = {}
  try {
    body = await request.json()
  } catch {
    // empty body is fine
  }
  const note = (body.note ?? '').toString().trim().slice(0, 200)

  const payment = await findPaymentById(id)
  if (!payment) return NextResponse.json({ error: 'payment not found' }, { status: 404 })
  if (payment.type !== 'deposit') {
    return NextResponse.json({ error: 'only deposit rows can be resolved' }, { status: 400 })
  }
  if (payment.status === 'success') {
    return NextResponse.json({ error: 'payment already credited' }, { status: 409 })
  }
  if (!payment.userId) {
    return NextResponse.json({ error: 'payment has no user' }, { status: 400 })
  }
  if (!Number.isFinite(payment.amount) || payment.amount <= 0) {
    return NextResponse.json({ error: 'invalid amount on payment row' }, { status: 400 })
  }

  const updatedUser = await creditBalance(payment.userId, payment.amount)
  if (!updatedUser) {
    return NextResponse.json({ error: 'user not found' }, { status: 404 })
  }

  const resolved = await markPaymentResolved(id, note)

  return NextResponse.json({
    payment: resolved,
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      balance: updatedUser.balance ?? 0,
    },
    credited: payment.amount,
  })
}
