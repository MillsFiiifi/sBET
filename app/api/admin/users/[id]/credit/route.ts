import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { creditBalance, findUserById } from '@/lib/users-store'
import { recordPayment } from '@/lib/payments-store'
import { applyDepositCredit } from '@/lib/deposit-credit'
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

  let body: { amount?: number; note?: string; kind?: 'deposit' | 'bonus' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const amount = Number(body.amount)
  const note = (body.note ?? '').toString().trim().slice(0, 200)
  // Default is 'deposit' — the common case is admin confirming a Moolre POS
  // payment that came through manually. Pass kind: 'bonus' to credit without
  // counting toward verification / firing sub-admin commission.
  const kind: 'deposit' | 'bonus' = body.kind === 'bonus' ? 'bonus' : 'deposit'

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 })
  }

  const existing = await findUserById(id)
  if (!existing) return NextResponse.json({ error: 'user not found' }, { status: 404 })

  if (kind === 'bonus') {
    const updated = await creditBalance(id, amount)
    if (!updated) return NextResponse.json({ error: 'user not found' }, { status: 404 })

    try {
      await recordPayment({
        userId: id,
        reference: `ADMIN-BONUS-${id.slice(0, 8)}-${Date.now()}`,
        amount,
        type: 'deposit',
        status: 'success',
        provider: 'admin',
        metadata: { source: 'admin_bonus', note: note || undefined },
      })
    } catch (e) {
      console.error('[admin credit] bonus ledger write failed:', e)
    }

    return NextResponse.json({
      kind,
      user: { id: updated.id, name: updated.name, balance: updated.balance ?? 0 },
      credited: amount,
    })
  }

  // kind === 'deposit' — full pipeline: updates totals, advances verification,
  // fires sub-admin commission. Matches the auto-credit path we used to have
  // when Moolre's API was wired up.
  const result = await applyDepositCredit(id, amount)
  if (!result) return NextResponse.json({ error: 'user not found' }, { status: 404 })

  try {
    await recordPayment({
      userId: id,
      reference: `ADMIN-CREDIT-${id.slice(0, 8)}-${Date.now()}`,
      amount,
      type: 'deposit',
      status: 'success',
      provider: 'admin',
      metadata: {
        source: 'admin_credit',
        note: note || undefined,
        firstDeposit: result.isFirstDeposit,
      },
    })
  } catch (e) {
    console.error('[admin credit] deposit ledger write failed:', e)
  }

  return NextResponse.json({
    kind,
    user: {
      id: result.user.id,
      name: result.user.name,
      balance: result.user.balance ?? 0,
      totalDeposited: result.user.totalDeposited,
      verificationStep: result.user.verificationStep ?? 0,
    },
    credited: amount,
    isFirstDeposit: result.isFirstDeposit,
    commission: result.commission,
  })
}
