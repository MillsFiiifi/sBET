import { NextResponse } from 'next/server'
import { readCustomMatches, type CustomMatch } from '@/lib/custom-matches-store'

export const dynamic = 'force-dynamic'

/** Public UI shape consumed by the homepage / match cards. */
export interface UiMatch {
  id: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  time: string
  status: 'LIVE' | 'UPCOMING'
  league: string
  sport: string
  odds: { home: number; draw?: number; away: number }
  locked: boolean
}

function toUi(m: CustomMatch): UiMatch {
  const status: 'LIVE' | 'UPCOMING' = m.isLive ? 'LIVE' : 'UPCOMING'
  const time = m.isLive
    ? (m.minute ? `${m.minute}'` : 'LIVE')
    : (m.startTime || 'Upcoming')
  return {
    id: m.id,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    homeScore: m.homeScore ?? 0,
    awayScore: m.awayScore ?? 0,
    time,
    status,
    league: m.league,
    sport: m.sport,
    odds: {
      home: m.oddsHome,
      ...(m.oddsDraw > 0 ? { draw: m.oddsDraw } : {}),
      away: m.oddsAway,
    },
    locked: m.locked,
  }
}

export async function GET() {
  try {
    const matches = await readCustomMatches()
    return NextResponse.json({ matches: matches.map(toUi) })
  } catch (e) {
    return NextResponse.json(
      { matches: [], error: e instanceof Error ? e.message : String(e) },
      { status: 200 },
    )
  }
}
