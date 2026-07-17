import { NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-guard'
import { deleteCustomMatch, updateCustomMatch } from '@/lib/custom-matches-store'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const num = (v: unknown) => (v === undefined || v === '' || v === null ? undefined : Number(v))
  const match = await updateCustomMatch(id, {
    league: body.league === undefined ? undefined : String(body.league),
    homeTeam: body.homeTeam === undefined ? undefined : String(body.homeTeam),
    awayTeam: body.awayTeam === undefined ? undefined : String(body.awayTeam),
    sport: body.sport === undefined ? undefined : String(body.sport),
    country: body.country === undefined ? undefined : String(body.country),
    homeScore: body.homeScore === undefined ? undefined : num(body.homeScore) ?? null,
    awayScore: body.awayScore === undefined ? undefined : num(body.awayScore) ?? null,
    minute: body.minute === undefined ? undefined : (body.minute ? String(body.minute) : null),
    startTime: body.startTime === undefined ? undefined : (body.startTime ? String(body.startTime) : null),
    isLive: body.isLive === undefined ? undefined : !!body.isLive,
    locked: body.locked === undefined ? undefined : !!body.locked,
    oddsHome: num(body.oddsHome),
    oddsDraw: num(body.oddsDraw),
    oddsAway: num(body.oddsAway),
  })
  if (!match) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ match })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const ok = await deleteCustomMatch(id)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
