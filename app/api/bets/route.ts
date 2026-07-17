import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { addBet, generateUniqueCode } from '@/lib/bets-store'
import { debitBalance, findUserById } from '@/lib/users-store'
import type { BetSelection, Match, PlacedBet } from '@/lib/domain-types'

export const dynamic = 'force-dynamic'

interface SelectionInput {
  matchId: string
  homeTeam: string
  awayTeam: string
  league?: string
  country?: string
  marketKey?: string
  marketLabel?: string
  outcomeKey: string
  outcomeLabel?: string
  odds: number
}
interface BetInput {
  stake: number
  selections: SelectionInput[]
}

/**
 * POST /api/bets  { userId, bets: [{ stake, selections: [...] }] }
 * A Multiple sends one bet with N selections; Singles send N bets with one
 * selection each. The combined stake is debited from the balance atomically-ish
 * (one debit up front), then each ticket is written.
 */
export async function POST(request: Request) {
  let body: { userId?: string; bets?: BetInput[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const userId = String(body.userId ?? '')
  const bets = Array.isArray(body.bets) ? body.bets : []
  if (!userId) return NextResponse.json({ error: 'please log in to place a bet' }, { status: 401 })
  if (bets.length === 0) return NextResponse.json({ error: 'no bets to place' }, { status: 400 })

  // Validate shape + compute total stake.
  let totalStake = 0
  for (const b of bets) {
    const stake = Number(b.stake)
    if (!Number.isFinite(stake) || stake <= 0) {
      return NextResponse.json({ error: 'each bet needs a stake greater than 0' }, { status: 400 })
    }
    if (!Array.isArray(b.selections) || b.selections.length === 0) {
      return NextResponse.json({ error: 'each bet needs at least one selection' }, { status: 400 })
    }
    for (const s of b.selections) {
      if (!s.matchId || !Number.isFinite(Number(s.odds)) || Number(s.odds) < 1) {
        return NextResponse.json({ error: 'a selection has invalid odds' }, { status: 400 })
      }
    }
    totalStake += stake
  }
  totalStake = +totalStake.toFixed(2)

  const user = await findUserById(userId)
  if (!user) return NextResponse.json({ error: 'account not found' }, { status: 404 })

  const debit = await debitBalance(userId, totalStake)
  if ('error' in debit) {
    return NextResponse.json(
      { error: debit.error === 'insufficient-funds' ? 'insufficient balance' : debit.error },
      { status: 400 },
    )
  }

  const placed: { code: string; stake: number; potentialWin: number }[] = []
  for (const b of bets) {
    const stake = +Number(b.stake).toFixed(2)
    const totalOdds = b.selections.reduce((p, s) => p * Number(s.odds), 1)
    const potentialWin = +(stake * totalOdds).toFixed(2)
    const code = await generateUniqueCode()

    const selections: BetSelection[] = b.selections.map((s) => {
      const match: Match = {
        id: s.matchId,
        league: s.league ?? '',
        country: s.country ?? '',
        homeTeam: s.homeTeam,
        awayTeam: s.awayTeam,
        isLive: false,
        odds: { home: 0, draw: 0, away: 0 },
      }
      return {
        id: randomUUID(),
        matchId: s.matchId,
        match,
        marketKey: s.marketKey ?? '1x2',
        marketLabel: s.marketLabel ?? 'Match Result',
        outcomeKey: s.outcomeKey,
        outcomeLabel: s.outcomeLabel ?? s.outcomeKey,
        odds: Number(s.odds),
        selection:
          (s.marketKey ?? '1x2') === '1x2'
            ? (s.outcomeKey as 'home' | 'draw' | 'away')
            : undefined,
        status: 'pending',
      }
    })

    const bet: PlacedBet = {
      id: randomUUID(),
      code,
      userId,
      placedAt: new Date().toISOString(),
      stake,
      totalOdds: +totalOdds.toFixed(4),
      potentialWin,
      currency: user.currency,
      status: 'pending',
      selections,
    }
    await addBet(bet)
    placed.push({ code, stake, potentialWin })
  }

  return NextResponse.json({ bets: placed, balance: debit.user.balance ?? 0 }, { status: 201 })
}
