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
 * Always returns JSON (even on failure) so the client never sees a bare 500.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params
  try {
    const booking = await findBookingByCode(code)
    if (!booking) {
      return NextResponse.json({ error: 'Booking code not found' }, { status: 404 })
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // Most common cause: the `bookings` table hasn't been created in Supabase.
    const hint = /relation .*bookings.* does not exist/i.test(msg)
      ? 'Booking storage is not set up yet (run supabase/setup-all.sql).'
      : 'Could not load that code, please try again.'
    return NextResponse.json({ error: hint, detail: msg }, { status: 200 })
  }
}
