import { NextResponse } from 'next/server'
import { createBooking } from '@/lib/bookings-store'

export const dynamic = 'force-dynamic'

/**
 * POST /api/bookings  { matchIds: string[] }
 * Creates a shareable booking code from a set of matches and returns it.
 */
export async function POST(request: Request) {
  let body: { matchIds?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const matchIds = Array.isArray(body.matchIds)
    ? body.matchIds.filter((x): x is string => typeof x === 'string')
    : []

  if (matchIds.length === 0) {
    return NextResponse.json({ error: 'select at least one match to book' }, { status: 400 })
  }
  if (matchIds.length > 40) {
    return NextResponse.json({ error: 'too many selections (max 40)' }, { status: 400 })
  }

  const booking = await createBooking(matchIds)
  return NextResponse.json({ code: booking.code }, { status: 201 })
}
