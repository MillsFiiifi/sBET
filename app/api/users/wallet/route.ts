import { NextResponse } from 'next/server'
import { findUserById } from '@/lib/users-store'
import { readBetsForUser } from '@/lib/bets-store'
import { addTransaction, readTransactionsForUser } from '@/lib/transactions-store'

export const dynamic = 'force-dynamic'

/**
 * GET /api/users/wallet?userId=... → the player's real balance, wallet
 * currency, lifetime totals, and recent ledger (deposits / withdrawals /
 * settlements). The client passes its stored user id.
 */
export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }
  const user = await findUserById(userId)
  if (!user) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const [transactions, bets] = await Promise.all([
    readTransactionsForUser(userId),
    readBetsForUser(userId),
  ])

  const totalWagers = bets.reduce((s, b) => s + b.stake, 0)
  const totalWins = bets
    .filter((b) => b.status === 'won')
    .reduce((s, b) => s + (b.payout ?? b.potentialWin), 0)
  const pendingWithdrawals = transactions
    .filter((t) => t.type === 'withdrawal' && t.status === 'pending')
    .reduce((s, t) => s + t.amount, 0)

  return NextResponse.json({
    name: user.name,
    balance: user.balance ?? 0,
    currency: user.currency,
    totalDeposited: user.totalDeposited ?? 0,
    totalWithdrawn: user.totalWithdrawn ?? 0,
    withdrawalApproved: user.withdrawalApproved ?? false,
    pendingWithdrawals: +pendingWithdrawals.toFixed(2),
    totalWagers: +totalWagers.toFixed(2),
    totalWins: +totalWins.toFixed(2),
    transactions,
  })
}

/**
 * POST /api/users/wallet → create a pending deposit or withdrawal request.
 * An admin approves it in the dashboard, which credits / debits the balance.
 */
export async function POST(request: Request) {
  let body: { userId?: string; type?: string; amount?: number; method?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const userId = String(body.userId ?? '')
  const type = body.type
  const amount = Number(body.amount)
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  if (type !== 'deposit' && type !== 'withdrawal') {
    return NextResponse.json({ error: 'type must be deposit or withdrawal' }, { status: 400 })
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }

  const user = await findUserById(userId)
  if (!user) return NextResponse.json({ error: 'not found' }, { status: 404 })

  if (type === 'withdrawal' && amount > (user.balance ?? 0)) {
    return NextResponse.json({ error: 'insufficient balance' }, { status: 400 })
  }

  const tx = await addTransaction({
    userId,
    type,
    amount,
    currency: user.currency,
    method: body.method?.toString().trim() || (type === 'deposit' ? 'Mobile Money' : 'Bank Transfer'),
    status: 'pending',
  })
  return NextResponse.json({ transaction: tx }, { status: 201 })
}
