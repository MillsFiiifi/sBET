import { NextResponse } from 'next/server'
import { findUserById } from '@/lib/users-store'
import { listPaymentsForUser } from '@/lib/payments-store'
import { readBetsForUser } from '@/lib/bets-store'

export const dynamic = 'force-dynamic'

export type TransactionKind =
  | 'deposit'
  | 'withdrawal'
  | 'bet-placed'
  | 'bet-won'
  | 'bet-lost'

export interface TransactionItem {
  id: string
  kind: TransactionKind
  /** Positive for credits (deposit, won), negative for debits (withdrawal, bet stake). */
  amount: number
  status: 'pending' | 'success' | 'failed' | 'cancelled'
  createdAt: string
  reference?: string
  description: string
  meta?: Record<string, unknown>
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: userId } = await params
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const user = await findUserById(userId)
  if (!user) {
    return NextResponse.json({ error: 'user not found' }, { status: 404 })
  }

  const [payments, bets] = await Promise.all([
    listPaymentsForUser(userId).catch(() => []),
    readBetsForUser(userId).catch(() => []),
  ])

  const transactions: TransactionItem[] = []

  for (const p of payments) {
    const isDeposit = p.type === 'deposit'
    transactions.push({
      id: `pay-${p.id}`,
      kind: isDeposit ? 'deposit' : 'withdrawal',
      amount: isDeposit ? p.amount : -p.amount,
      status: p.status,
      createdAt: p.createdAt,
      reference: p.reference,
      description: isDeposit
        ? p.metadata?.source === 'admin_credit'
          ? 'Admin credit'
          : `Deposit via ${p.provider}`
        : `Withdrawal to ${(p.metadata.network as string)?.toUpperCase?.() ?? 'mobile money'}`,
      meta: p.metadata,
    })
  }

  for (const b of bets) {
    const firstMatch = b.selections[0]
      ? `${b.selections[0].match.homeTeam} vs ${b.selections[0].match.awayTeam}`
      : 'Bet'
    const more = b.selections.length > 1 ? ` (+${b.selections.length - 1} more)` : ''
    transactions.push({
      id: `bet-${b.id}-stake`,
      kind: 'bet-placed',
      amount: -b.stake,
      status: 'success',
      createdAt: b.placedAt,
      reference: b.code,
      description: `Bet stake — ${firstMatch}${more}`,
      meta: { code: b.code, selections: b.selections.length },
    })

    if (b.status === 'won' && b.settledAt) {
      const payout = b.payout ?? b.potentialWin
      transactions.push({
        id: `bet-${b.id}-payout`,
        kind: 'bet-won',
        amount: payout,
        status: 'success',
        createdAt: b.settledAt,
        reference: b.code,
        description: `Bet won — ${firstMatch}${more}`,
        meta: { code: b.code, totalOdds: b.totalOdds },
      })
    } else if (b.status === 'lost' && b.settledAt) {
      transactions.push({
        id: `bet-${b.id}-lost`,
        kind: 'bet-lost',
        amount: 0,
        status: 'success',
        createdAt: b.settledAt,
        reference: b.code,
        description: `Bet lost — ${firstMatch}${more}`,
        meta: { code: b.code, totalOdds: b.totalOdds },
      })
    }
  }

  transactions.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      balance: user.balance ?? 0,
      totalDeposited: user.totalDeposited,
      totalWithdrawn: user.totalWithdrawn ?? 0,
    },
    transactions,
  })
}
