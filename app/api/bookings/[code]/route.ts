import { NextResponse } from 'next/server'
import { findBookingByCode } from '@/lib/bookings-store'
import { readCustomMatches, toUiMatch } from '@/lib/custom-matches-store'
import { fetchApiFootballMatches } from '@/lib/api-football'
import type { UiMatch } from '@/lib/ui-match'

export const dynamic = 'force-dynamic'

/**
 * GET /api/bookings/:code → the booking's matches with current data, so the
 * games "load" when a user pastes the code. Resolves ids against BOTH admin
 * (custom) matches and live API-Football fixtures, in the booked order.
 * Matches that have since ended / been removed are dropped.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params
  const booking = await findBookingByCode(code)
  if (!booking) {
    return NextResponse.json({ error: 'booking code not found' }, { status: 404 })
  }

  const [custom, live] = await Promise.all([
    readCustomMatches().catch(() => []),
    fetchApiFootballMatches().catch(() => []),
  ])

  const byId = new Map<string, UiMatch>()
  for (const m of custom) byId.set(m.id, toUiMatch(m))
  for (const m of live) byId.set(m.id, m)

  const matches = booking.matchIds
    .map((id) => byId.get(id))
    .filter((m): m is UiMatch => m != null)

  return NextResponse.json({ code: booking.code, matches })
}
