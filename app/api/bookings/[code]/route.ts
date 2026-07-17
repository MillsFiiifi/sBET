import { NextResponse } from 'next/server'
import { findBookingByCode } from '@/lib/bookings-store'
import { findCustomMatchById, toUiMatch } from '@/lib/custom-matches-store'

export const dynamic = 'force-dynamic'

/**
 * GET /api/bookings/:code → the booking's matches with current data, so the
 * games "load" when a user pastes the code. Missing/deleted matches are
 * silently dropped from the result.
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

  const matches = (
    await Promise.all(booking.matchIds.map((id) => findCustomMatchById(id)))
  )
    .filter((m): m is NonNullable<typeof m> => m != null)
    .map(toUiMatch)

  return NextResponse.json({ code: booking.code, matches })
}
