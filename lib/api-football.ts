import type { UiMatch } from '@/lib/ui-match'

// Real fixtures from API-Football (api-sports.io). Reads the key from
// process.env.API_FOOTBALL_KEY — never hard-code it. Results are cached in
// module memory for a short TTL so we stay under the plan's daily request cap.

const BASE = 'https://v3.football.api-sports.io'
const TTL_MS = 60_000 // 60s cache
const MAX_UPCOMING = 120 // cap upcoming fixtures so the UI isn't flooded
const UPCOMING_DAYS = 4 // today + next 3 days of fixtures

const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'])
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN'])

// Marquee competitions floated to the top of the upcoming board (lower = higher
// priority). Matched case-insensitively against the fixture's league name.
const POPULAR_LEAGUES = [
  'champions league', 'europa league', 'premier league', 'la liga',
  'serie a', 'bundesliga', 'ligue 1', 'world cup', 'euro',
  'fa cup', 'copa del rey', 'eredivisie', 'primeira liga', 'mls',
  'saudi pro league', 'championship',
]
function leagueRank(name: string): number {
  const n = name.toLowerCase()
  const i = POPULAR_LEAGUES.findIndex((l) => n.includes(l))
  return i === -1 ? POPULAR_LEAGUES.length : i
}

interface AFFixture {
  fixture: { id: number; status: { short: string; elapsed: number | null }; date: string }
  league: { name: string; country: string }
  teams: {
    home: { name: string; logo?: string }
    away: { name: string; logo?: string }
  }
  goals: { home: number | null; away: number | null }
}

let cache: { at: number; data: UiMatch[] } | null = null

/** Deterministic, stable, plausible 1X2 odds derived from the fixture id.
 *  (API-Football's odds endpoint is a separate, rate-limited call; these keep
 *  the betting UI usable without burning the quota. Swap for real odds later.) */
function genOdds(id: number): { home: number; draw: number; away: number } {
  const frac = (n: number) => {
    const x = Math.sin(id * 12.9898 + n * 78.233) * 43758.5453
    return x - Math.floor(x)
  }
  return {
    home: +(1.35 + frac(1) * 3.2).toFixed(2),
    draw: +(2.9 + frac(2) * 1.8).toFixed(2),
    away: +(1.35 + frac(3) * 3.2).toFixed(2),
  }
}

function toUi(f: AFFixture): UiMatch {
  const short = f.fixture.status.short
  const isLive = LIVE_STATUSES.has(short)
  const finished = FINISHED_STATUSES.has(short)
  const state: UiMatch['state'] = isLive ? 'LIVE' : finished ? 'FINISHED' : 'UPCOMING'
  const kickoff = new Date(f.fixture.date)
  const time = isLive
    ? (f.fixture.status.elapsed != null ? `${f.fixture.status.elapsed}'` : 'LIVE')
    : kickoff.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return {
    id: `af-${f.fixture.id}`,
    homeTeam: f.teams.home.name,
    awayTeam: f.teams.away.name,
    homeScore: f.goals.home ?? 0,
    awayScore: f.goals.away ?? 0,
    hasScore: f.goals.home != null && f.goals.away != null,
    time,
    status: isLive ? 'LIVE' : 'UPCOMING',
    state,
    league: f.league.name,
    sport: 'soccer',
    odds: genOdds(f.fixture.id),
    startTime: kickoff.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    createdAt: f.fixture.date,
    homeFlagUrl: f.teams.home.logo,
    awayFlagUrl: f.teams.away.logo,
  }
}

export function isApiFootballConfigured(): boolean {
  return !!process.env.API_FOOTBALL_KEY
}

/**
 * Sports the admin may file a custom match under. Football is the only one with
 * a real upstream feed; the rest exist so the sport tabs render (and admins can
 * add matches by hand) without the API rejecting them.
 */
export function supportedSports(): string[] {
  return ['football', 'basketball', 'tennis', 'baseball', 'hockey', 'volleyball']
}

export async function fetchApiFootballMatches(): Promise<UiMatch[]> {
  const key = process.env.API_FOOTBALL_KEY
  if (!key) return []
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data

  try {
    const headers = { 'x-apisports-key': key }

    // Fetch all live fixtures plus a rolling window of upcoming days so the
    // board is well stocked, not just today's games.
    const now = new Date()
    const dates = Array.from({ length: UPCOMING_DAYS }, (_, i) => {
      const d = new Date(now)
      d.setUTCDate(now.getUTCDate() + i)
      return d.toISOString().slice(0, 10)
    })
    const [liveRes, ...dayResList] = await Promise.all([
      fetch(`${BASE}/fixtures?live=all`, { headers, cache: 'no-store' }),
      ...dates.map((date) => fetch(`${BASE}/fixtures?date=${date}`, { headers, cache: 'no-store' })),
    ])
    const live = (await liveRes.json())?.response ?? []
    const days = (await Promise.all(dayResList.map((r) => r.json()))).flatMap(
      (j) => j?.response ?? [],
    )

    // Dedup by fixture id, live rows win (fresher status/score).
    const byId = new Map<number, AFFixture>()
    for (const f of days as AFFixture[]) byId.set(f.fixture.id, f)
    for (const f of live as AFFixture[]) byId.set(f.fixture.id, f)

    const all = Array.from(byId.values()).map(toUi)
    const liveOnes = all.filter((m) => m.state === 'LIVE')
    // Upcoming: marquee leagues first, then soonest kickoff within each tier.
    const rest = all
      .filter((m) => m.state === 'UPCOMING')
      .sort((a, b) => {
        const r = leagueRank(a.league) - leagueRank(b.league)
        if (r !== 0) return r
        return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
      })
      .slice(0, MAX_UPCOMING)
    const data = [...liveOnes, ...rest]

    cache = { at: Date.now(), data }
    return data
  } catch {
    return cache?.data ?? []
  }
}
