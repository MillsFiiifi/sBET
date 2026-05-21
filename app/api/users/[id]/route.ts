import { NextResponse } from 'next/server'
import { findUserById } from '@/lib/users-store'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const user = await findUserById(id.trim())
  if (!user) {
    return NextResponse.json({ error: 'user not found' }, { status: 404 })
  }

  const balance = user.balance ?? user.totalDeposited - (user.totalWithdrawn ?? 0)
  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    totalDeposited: user.totalDeposited,
    totalWithdrawn: user.totalWithdrawn ?? 0,
    balance,
    verificationStep: user.verificationStep ?? 0,
    firstDepositAt: user.firstDepositAt ?? null,
  })
}
