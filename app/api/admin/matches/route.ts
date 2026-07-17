import { NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-guard'
import { addCustomMatch, readCustomMatches } from '@/lib/custom-matches-store'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const matches = await readCustomMatches()
  return NextResponse.json({ matches })
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const league = String(body.league ?? '').trim()
  const homeTeam = String(body.homeTeam ?? '').trim()
  const awayTeam = String(body.awayTeam ?? '').trim()
  const oddsHome = Number(body.oddsHome)
  const oddsAway = Number(body.oddsAway)
  const oddsDraw = body.oddsDraw === undefined || body.oddsDraw === '' ? 0 : Number(body.oddsDraw)

  if (!league || !homeTeam || !awayTeam) {
    return NextResponse.json(
      { error: 'league, homeTeam and awayTeam are required' },
      { status: 400 },
    )
  }
  if (!Number.isFinite(oddsHome) || oddsHome < 1 || !Number.isFinite(oddsAway) || oddsAway < 1) {
    return NextResponse.json(
      { error: 'oddsHome and oddsAway must be numbers ≥ 1' },
      { status: 400 },
    )
  }

  const match = await addCustomMatch({
    sport: body.sport ? String(body.sport) : 'soccer',
    league,
    country: body.country ? String(body.country) : '',
    homeTeam,
    awayTeam,
    homeScore: body.homeScore === undefined || body.homeScore === '' ? null : Number(body.homeScore),
    awayScore: body.awayScore === undefined || body.awayScore === '' ? null : Number(body.awayScore),
    minute: body.minute ? String(body.minute) : null,
    startTime: body.startTime ? String(body.startTime) : null,
    isLive: !!body.isLive,
    oddsHome,
    oddsDraw: Number.isFinite(oddsDraw) ? oddsDraw : 0,
    oddsAway,
  })
  return NextResponse.json({ match }, { status: 201 })
}
