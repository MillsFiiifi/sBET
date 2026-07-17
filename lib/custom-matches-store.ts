import { supabaseServer } from '@/lib/supabase'

/**
 * Admin-added matches. These are the real, editable matches players bet on —
 * they replace the old hard-coded LIVE_MATCHES constant. An admin creates them
 * in the dashboard; the public /api/matches endpoint serves them to the site.
 */
export interface CustomMatch {
  id: string
  sport: string
  league: string
  country: string
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
  minute: string | null
  startTime: string | null
  isLive: boolean
  locked: boolean
  oddsHome: number
  oddsDraw: number
  oddsAway: number
  createdAt: string
}

interface Row {
  id: string
  sport: string
  league: string
  country: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  minute: string | null
  start_time: string | null
  is_live: boolean
  locked: boolean
  odds_home: number
  odds_draw: number
  odds_away: number
  created_at: string
}

function rowToMatch(r: Row): CustomMatch {
  return {
    id: r.id,
    sport: r.sport ?? 'soccer',
    league: r.league,
    country: r.country ?? '',
    homeTeam: r.home_team,
    awayTeam: r.away_team,
    homeScore: r.home_score,
    awayScore: r.away_score,
    minute: r.minute,
    startTime: r.start_time,
    isLive: !!r.is_live,
    locked: !!r.locked,
    oddsHome: Number(r.odds_home),
    oddsDraw: Number(r.odds_draw ?? 0),
    oddsAway: Number(r.odds_away),
    createdAt: r.created_at,
  }
}

export async function readCustomMatches(): Promise<CustomMatch[]> {
  const { data, error } = await supabaseServer()
    .from('custom_matches')
    .select('*')
    .order('is_live', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(`custom_matches.readAll: ${error.message}`)
  return (data ?? []).map((r) => rowToMatch(r as Row))
}

export async function findCustomMatchById(id: string): Promise<CustomMatch | null> {
  const { data, error } = await supabaseServer()
    .from('custom_matches')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`custom_matches.findById: ${error.message}`)
  return data ? rowToMatch(data as Row) : null
}

export interface CustomMatchInput {
  sport?: string
  league: string
  country?: string
  homeTeam: string
  awayTeam: string
  homeScore?: number | null
  awayScore?: number | null
  minute?: string | null
  startTime?: string | null
  isLive?: boolean
  locked?: boolean
  oddsHome: number
  oddsDraw?: number
  oddsAway: number
}

export async function addCustomMatch(input: CustomMatchInput): Promise<CustomMatch> {
  const insert = {
    sport: input.sport?.trim() || 'soccer',
    league: input.league.trim(),
    country: input.country?.trim() || '',
    home_team: input.homeTeam.trim(),
    away_team: input.awayTeam.trim(),
    home_score: input.homeScore ?? null,
    away_score: input.awayScore ?? null,
    minute: input.minute?.trim() || null,
    minute_set_at: input.isLive && input.minute ? new Date().toISOString() : null,
    start_time: input.startTime?.trim() || null,
    is_live: !!input.isLive,
    locked: !!input.locked,
    odds_home: input.oddsHome,
    odds_draw: input.oddsDraw ?? 0,
    odds_away: input.oddsAway,
  }
  const { data, error } = await supabaseServer()
    .from('custom_matches')
    .insert(insert)
    .select('*')
    .single()
  if (error) throw new Error(`custom_matches.add: ${error.message}`)
  return rowToMatch(data as Row)
}

export async function updateCustomMatch(
  id: string,
  patch: Partial<CustomMatchInput>,
): Promise<CustomMatch | null> {
  const db: Record<string, unknown> = {}
  if (patch.sport !== undefined) db.sport = patch.sport
  if (patch.league !== undefined) db.league = patch.league
  if (patch.country !== undefined) db.country = patch.country
  if (patch.homeTeam !== undefined) db.home_team = patch.homeTeam
  if (patch.awayTeam !== undefined) db.away_team = patch.awayTeam
  if (patch.homeScore !== undefined) db.home_score = patch.homeScore
  if (patch.awayScore !== undefined) db.away_score = patch.awayScore
  if (patch.minute !== undefined) {
    db.minute = patch.minute
    db.minute_set_at = new Date().toISOString()
  }
  if (patch.startTime !== undefined) db.start_time = patch.startTime
  if (patch.isLive !== undefined) db.is_live = patch.isLive
  if (patch.locked !== undefined) db.locked = patch.locked
  if (patch.oddsHome !== undefined) db.odds_home = patch.oddsHome
  if (patch.oddsDraw !== undefined) db.odds_draw = patch.oddsDraw
  if (patch.oddsAway !== undefined) db.odds_away = patch.oddsAway

  if (Object.keys(db).length === 0) return findCustomMatchById(id)

  const { data, error } = await supabaseServer()
    .from('custom_matches')
    .update(db)
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) throw new Error(`custom_matches.update: ${error.message}`)
  return data ? rowToMatch(data as Row) : null
}

export async function deleteCustomMatch(id: string): Promise<boolean> {
  const { error, count } = await supabaseServer()
    .from('custom_matches')
    .delete({ count: 'exact' })
    .eq('id', id)
  if (error) throw new Error(`custom_matches.delete: ${error.message}`)
  return (count ?? 0) > 0
}
