/** Shape returned by the public /api/matches endpoint and consumed by the UI. */
export interface UiMatch {
  id: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  /** True when both scores are set (used to tell FINISHED from UPCOMING). */
  hasScore: boolean
  time: string
  /** Coarse status kept for the match card (LIVE vs everything else). */
  status: 'LIVE' | 'UPCOMING'
  /** Full lifecycle state used by Results / Schedule / Home. */
  state: 'LIVE' | 'UPCOMING' | 'FINISHED'
  league: string
  sport: string
  odds: { home: number; draw?: number; away: number }
  locked?: boolean
  startTime?: string
  createdAt?: string
}
