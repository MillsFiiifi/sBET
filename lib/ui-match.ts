/** Shape returned by the public /api/matches endpoint and consumed by the UI. */
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
  locked?: boolean
}
