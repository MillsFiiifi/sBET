import { NextResponse } from 'next/server'
import { readCustomMatches, type CustomMatch } from '@/lib/custom-matches-store'
import type { UiMatch } from '@/lib/ui-match'

export const dynamic = 'force-dynamic'

function toUi(m: CustomMatch): UiMatch {
  const hasScore = m.homeScore != null && m.awayScore != null
  const state: UiMatch['state'] = m.isLive ? 'LIVE' : hasScore ? 'FINISHED' : 'UPCOMING'
  const time = m.isLive
    ? (m.minute ? `${m.minute}'` : 'LIVE')
    : (m.startTime || 'Upcoming')
  return {
    id: m.id,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    homeScore: m.homeScore ?? 0,
    awayScore: m.awayScore ?? 0,
    hasScore,
    time,
    status: m.isLive ? 'LIVE' : 'UPCOMING',
    state,
    league: m.league,
    sport: m.sport,
    odds: {
      home: m.oddsHome,
      ...(m.oddsDraw > 0 ? { draw: m.oddsDraw } : {}),
      away: m.oddsAway,
    },
    locked: m.locked,
    startTime: m.startTime ?? undefined,
    createdAt: m.createdAt,
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
