import { NextResponse } from 'next/server'
import { findUserById, recordWithdrawal } from '@/lib/users-store'

export const dynamic = 'force-dynamic'

const STEP_1_MESSAGE =
  'To complete account verification for withdrawals, a deposit of 200 GHC is required. Once completed, your account will be successfully verified for withdrawal access.'
const STEP_2_MESSAGE =
  'Final verification is currently pending. A remaining verification payment of 200 GHC is required to fully enable withdrawal access on your account.'

export async function POST(request: Request) {
  let body: { userId?: string; amount?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const userId = (body.userId ?? '').trim()
  const amount = Number(body.amount)
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 })
  }

  // Gate withdrawals behind the two-step verification.
  const user = await findUserById(userId)
  if (!user) {
    return NextResponse.json({ error: 'user not found' }, { status: 404 })
  }
  const step = user.verificationStep ?? 0
  if (step < 2) {
    return NextResponse.json(
      {
        error: step === 0 ? STEP_1_MESSAGE : STEP_2_MESSAGE,
        verificationRequired: true,
        verificationStep: step,
        verificationDepositAmount: 200,
      },
      { status: 403 },
    )
  }

  const result = await recordWithdrawal(userId, +amount.toFixed(2))
  if ('error' in result) {
    if (result.error === 'not-found') {
      return NextResponse.json({ error: 'user not found' }, { status: 404 })
    }
    if (result.error === 'no-deposit') {
      return NextResponse.json(
        { error: 'make a deposit before withdrawing' },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: 'insufficient funds' }, { status: 400 })
  }

  return NextResponse.json(
    {
      user: {
        id: result.user.id,
        name: result.user.name,
        totalDeposited: result.user.totalDeposited,
        totalWithdrawn: result.user.totalWithdrawn ?? 0,
        balance: result.user.balance ?? 0,
        verificationStep: result.user.verificationStep ?? 0,
      },
    },
    { status: 201 },
  )
}
