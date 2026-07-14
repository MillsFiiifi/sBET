import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { updateBet, setSelectionStatusForBet } from '@/lib/bets-store'
import { creditBalance } from '@/lib/users-store'
import { computeCashout } from '@/lib/cashout'
import type { PlacedBet } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

// Cash out a still-running bet: pay the user the current cash-out value and
// close the ticket. The value is recomputed server-side (never trusted from the
// client). Idempotent via the `status = 'pending'` guard on the settle update.
export async function POST(request: Request, { params }: Params) {
  const { id } = await params

  let body: { userId?: string }
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  const userId = (body.userId ?? '').trim()
  if (!userId) {
    return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })
  }

  const { data: bet, error } = await supabaseServer()
    .from('bets')
    .select('id, user_id, status, stake, potential_win, placed_at')
    .eq('id', id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!bet) return NextResponse.json({ error: 'bet not found' }, { status: 404 })
  if (bet.user_id !== userId) {
    return NextResponse.json({ error: 'not your bet' }, { status: 403 })
  }
  if (bet.status !== 'pending') {
    return NextResponse.json({ error: 'This bet is already settled.' }, { status: 409 })
  }

  const value = computeCashout(
    {
      status: 'pending',
      stake: Number(bet.stake),
      potentialWin: Number(bet.potential_win),
      placedAt: bet.placed_at,
    } as PlacedBet,
    Date.now(),
  )
  if (value <= 0) {
    return NextResponse.json({ error: 'Cash out is not available for this bet yet.' }, { status: 400 })
  }

  // Atomically flip pending -> won so two taps can't both pay out. We store the
  // cash-out amount as the payout; a cashed-out ticket reads as won-for-<value>.
  const { data: settled, error: updErr } = await supabaseServer()
    .from('bets')
    .update({ status: 'won', settled_at: new Date().toISOString(), payout: value })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  if (!settled) {
    return NextResponse.json({ error: 'This bet was just settled.' }, { status: 409 })
  }

  await setSelectionStatusForBet(id, 'won').catch(() => {})
  await creditBalance(userId, value)

  const updated = await updateBet(id, {})
  return NextResponse.json({ ok: true, cashout: value, bet: updated as PlacedBet | null })
}
