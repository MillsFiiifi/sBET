import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { creditBalance, findUserById } from '@/lib/users-store'
import { recordPayment } from '@/lib/payments-store'
import { ADMIN_COOKIE, isValidSessionCookie } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

async function isAdminAuthenticated(): Promise<boolean> {
  const store = await cookies()
  return isValidSessionCookie(store.get(ADMIN_COOKIE)?.value)
}

export async function POST(request: Request, { params }: Params) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await params

  let body: { amount?: number; note?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const amount = Number(body.amount)
  const note = (body.note ?? '').toString().trim().slice(0, 200)

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 })
  }

  const existing = await findUserById(id)
  if (!existing) return NextResponse.json({ error: 'user not found' }, { status: 404 })

  const updated = await creditBalance(id, amount)
  if (!updated) return NextResponse.json({ error: 'user not found' }, { status: 404 })

  // Log to the payments ledger so it appears in the user's transactions feed
  // (and on the admin deposits page). Tag with source='admin_credit' so it's
  // distinguishable from Paystack deposits — these do NOT advance the
  // verification gate or fire sub-admin commission.
  try {
    await recordPayment({
      userId: id,
      reference: `ADMIN-CREDIT-${id.slice(0, 8)}-${Date.now()}`,
      amount,
      type: 'deposit',
      status: 'success',
      provider: 'admin',
      metadata: { source: 'admin_credit', note: note || undefined },
    })
  } catch (e) {
    console.error('[admin credit] payment ledger write failed:', e)
  }

  return NextResponse.json({
    user: {
      id: updated.id,
      name: updated.name,
      balance: updated.balance ?? 0,
    },
    credited: amount,
  })
}
