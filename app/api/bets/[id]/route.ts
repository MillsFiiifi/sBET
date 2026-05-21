import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { updateBet, deleteBet, setSelectionStatusForBet } from '@/lib/bets-store'
import { creditBalance } from '@/lib/users-store'
import { supabaseServer } from '@/lib/supabase'
import { ADMIN_COOKIE, isValidSessionCookie } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

async function isAdminAuthenticated(): Promise<boolean> {
  const store = await cookies()
  const value = store.get(ADMIN_COOKIE)?.value
  return isValidSessionCookie(value)
}

export async function PATCH(request: Request, { params }: Params) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { status } = body as { status?: 'won' | 'lost' }
  if (status !== 'won' && status !== 'lost') {
    return NextResponse.json(
      { error: 'status must be won or lost — settled bets cannot be reopened' },
      { status: 400 },
    )
  }

  // Pull the current row directly so we can enforce the lock and grab user_id
  // for the payout credit.
  const { data: existing, error: lookupErr } = await supabaseServer()
    .from('bets')
    .select('id, status, user_id, potential_win, stake')
    .eq('id', id)
    .maybeSingle()
  if (lookupErr) {
    return NextResponse.json({ error: lookupErr.message }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: 'bet not found' }, { status: 404 })
  }
  if (existing.status !== 'pending') {
    return NextResponse.json(
      { error: `This bet is already settled (${existing.status}).` },
      { status: 409 },
    )
  }

  const settledAt = new Date().toISOString()

  if (status === 'won') {
    const payout = Number(existing.potential_win)
    // Mark every selection as 'won' first so the bet read returns the right
    // colors. Then update the parent bet.
    await setSelectionStatusForBet(id, 'won')
    const updated = await updateBet(id, { status, settledAt, payout })
    if (!updated) {
      return NextResponse.json({ error: 'bet not found' }, { status: 404 })
    }
    // Credit the user's wallet with the full payout (stake was deducted when
    // they placed the bet).
    if (existing.user_id) {
      await creditBalance(existing.user_id, payout)
    }
    return NextResponse.json({ bet: updated })
  }

  // status === 'lost' — stake already gone, no balance change. Every leg is
  // coloured red on the bet card.
  await setSelectionStatusForBet(id, 'lost')
  const updated = await updateBet(id, { status, settledAt, payout: 0 })
  if (!updated) {
    return NextResponse.json({ error: 'bet not found' }, { status: 404 })
  }
  return NextResponse.json({ bet: updated })
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const ok = await deleteBet(id)
  if (!ok) return NextResponse.json({ error: 'bet not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
