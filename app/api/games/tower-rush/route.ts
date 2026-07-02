// Tower Rush — server-authoritative, provably-fair game API.
//
// Every meaningful action is decided here, never on the client:
//   action 'start'   → debit stake, commit a secret crash floor, open a round
//   action 'build'   → server places the next floor and decides survive/collapse
//   action 'cashout' → server credits stake × coefficient
//
// The crash floor is derived from a server seed (committed via its SHA-256 hash
// at start, revealed when the round ends) + a client seed + nonce, so a player
// can verify the outcome was fixed before they played and cannot predict or
// force it. The client never learns the crash floor until the round is over.
//
// NOTE: identity follows the app's existing model (userId in the request body,
// same as /api/bets). Round ownership is checked so a caller can only act on
// their own rounds. Tightening player auth app-wide is tracked separately.

import { NextResponse } from 'next/server'
import { createHash, createHmac, randomBytes, randomUUID } from 'crypto'
import { creditBalance, debitBalance, findUserById } from '@/lib/users-store'
import { checkRecentDeposit, DEPOSIT_REQUIRED_MESSAGE } from '@/lib/deposit-gate'
import {
  findActiveRoundForUser,
  findRoundById,
  insertRound,
  updateRound,
  type TowerRound,
} from '@/lib/tower-store'
import {
  TOWER_MIN_STAKE,
  crashFloorFromUniform,
  towerCoeffAt,
} from '@/lib/tower-rush'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Uniform float in [0,1) from (serverSeed, clientSeed, nonce).
function deriveUniform(serverSeed: string, clientSeed: string, nonce: number): number {
  const h = createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}`).digest('hex')
  // 13 hex digits = 52 bits → divide by 2^52 for a uniform in [0,1).
  return parseInt(h.slice(0, 13), 16) / 2 ** 52
}

const nowIso = () => new Date().toISOString()

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { action, userId, stake, roundId, clientSeed } = (body ?? {}) as {
    action?: string
    userId?: string
    stake?: number
    roundId?: string
    clientSeed?: string
  }

  const cleanUserId = (userId ?? '').trim()
  if (!cleanUserId) {
    return NextResponse.json({ error: 'Please sign in to play.' }, { status: 401 })
  }

  try {
  // ─── START ────────────────────────────────────────────────────────────────
  if (action === 'start') {
    const stakeNum = typeof stake === 'number' ? stake : Number(stake)
    if (!Number.isFinite(stakeNum) || stakeNum < TOWER_MIN_STAKE) {
      return NextResponse.json({ error: 'invalid stake' }, { status: 400 })
    }

    const user = await findUserById(cleanUserId)
    if (!user) return NextResponse.json({ error: 'user not found' }, { status: 404 })

    // 24h stake gate: require a deposit within the last 24 hours before a new
    // round, so players can't keep recycling their existing balance.
    const gate = await checkRecentDeposit(cleanUserId)
    if (!gate.allowed) {
      return NextResponse.json(
        { error: DEPOSIT_REQUIRED_MESSAGE, code: 'deposit-required' },
        { status: 402 },
      )
    }

    // Forfeit any abandoned open round (stake was already taken at its start).
    const existing = await findActiveRoundForUser(cleanUserId)
    if (existing) {
      await updateRound(existing.id, { status: 'lost', settledAt: nowIso() })
    }

    const debit = await debitBalance(cleanUserId, +stakeNum.toFixed(2))
    if ('error' in debit) {
      if (debit.error === 'not-found') {
        return NextResponse.json({ error: 'user not found' }, { status: 404 })
      }
      return NextResponse.json(
        { error: 'Add funds to your wallet to play.' },
        { status: 402 },
      )
    }

    const serverSeed = randomBytes(32).toString('hex')
    const serverSeedHash = createHash('sha256').update(serverSeed).digest('hex')
    const seedFromClient = (clientSeed ?? '').toString().slice(0, 64) || randomBytes(8).toString('hex')
    const nonce = 0
    const crashFloor = crashFloorFromUniform(deriveUniform(serverSeed, seedFromClient, nonce))
    const coeff = towerCoeffAt(1)

    const round: TowerRound = {
      id: randomUUID(),
      userId: cleanUserId,
      stake: +stakeNum.toFixed(2),
      currency: user.currency,
      status: 'active',
      currentFloor: 1,
      crashFloor,
      coeff,
      payout: null,
      serverSeed,
      serverSeedHash,
      clientSeed: seedFromClient,
      nonce,
      placedAt: nowIso(),
      settledAt: null,
    }

    try {
      await insertRound(round)
    } catch (err) {
      // Refund — the debit already happened.
      await creditBalance(cleanUserId, round.stake).catch(() => null)
      console.error('[tower-rush] insertRound failed (stake refunded):', err)
      return NextResponse.json(
        { error: 'Could not start round — your stake was refunded.' },
        { status: 500 },
      )
    }

    return NextResponse.json(
      {
        roundId: round.id,
        floor: 1,
        coeff,
        balance: debit.user.balance,
        currency: user.currency,
        serverSeedHash,
        clientSeed: seedFromClient,
        nonce,
      },
      { status: 201 },
    )
  }

  // ─── BUILD ──────────────────────────────────────────────────────────────────
  if (action === 'build') {
    const round = await findRoundById((roundId ?? '').trim())
    if (!round || round.userId !== cleanUserId) {
      return NextResponse.json({ error: 'round not found' }, { status: 404 })
    }
    if (round.status !== 'active') {
      return NextResponse.json({ error: 'round already settled' }, { status: 409 })
    }

    const next = round.currentFloor + 1

    if (next >= round.crashFloor) {
      // Collapse. Stake stays debited; round closes as a loss.
      await updateRound(round.id, {
        status: 'lost',
        currentFloor: next,
        settledAt: nowIso(),
      })
      return NextResponse.json({
        crashed: true,
        floor: next,
        crashFloor: round.crashFloor,
        serverSeed: round.serverSeed,
        serverSeedHash: round.serverSeedHash,
        clientSeed: round.clientSeed,
        nonce: round.nonce,
      })
    }

    const coeff = towerCoeffAt(next)
    await updateRound(round.id, { currentFloor: next, coeff })
    return NextResponse.json({ crashed: false, floor: next, coeff })
  }

  // ─── CASH OUT ────────────────────────────────────────────────────────────────
  if (action === 'cashout') {
    const round = await findRoundById((roundId ?? '').trim())
    if (!round || round.userId !== cleanUserId) {
      return NextResponse.json({ error: 'round not found' }, { status: 404 })
    }
    if (round.status !== 'active') {
      return NextResponse.json({ error: 'round already settled' }, { status: 409 })
    }

    const floor = round.currentFloor
    const coeff = towerCoeffAt(floor)
    const payout = +(round.stake * coeff).toFixed(2)

    const updatedUser = await creditBalance(cleanUserId, payout)
    await updateRound(round.id, {
      status: 'won',
      coeff,
      payout,
      settledAt: nowIso(),
    })

    return NextResponse.json({
      won: true,
      floor,
      coeff,
      payout,
      balance: updatedUser?.balance ?? null,
      serverSeed: round.serverSeed,
      serverSeedHash: round.serverSeedHash,
      clientSeed: round.clientSeed,
      nonce: round.nonce,
      crashFloor: round.crashFloor,
    })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  } catch (err) {
    console.error('[tower-rush] unexpected error:', err)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
