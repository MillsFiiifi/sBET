import type { UiMatch } from '@/lib/ui-match'

// Real fixtures from API-Football (api-sports.io). Reads the key from
// process.env.API_FOOTBALL_KEY — never hard-code it. Results are cached in
// module memory for a short TTL so we stay under the plan's daily request cap.

const BASE = 'https://v3.football.api-sports.io'
const TTL_MS = 60_000 // 60s cache
const MAX_UPCOMING = 40 // cap the day's fixtures so the UI isn't flooded

const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'])
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN'])

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

export async function fetchApiFootballMatches(): Promise<UiMatch[]> {
  const key = process.env.API_FOOTBALL_KEY
  if (!key) return []
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data

  try {
    const headers = { 'x-apisports-key': key }
    const today = new Date().toISOString().slice(0, 10)
    const [liveRes, dayRes] = await Promise.all([
      fetch(`${BASE}/fixtures?live=all`, { headers, cache: 'no-store' }),
      fetch(`${BASE}/fixtures?date=${today}`, { headers, cache: 'no-store' }),
    ])
    const live = (await liveRes.json())?.response ?? []
    const day = (await dayRes.json())?.response ?? []

    // Dedup by fixture id, live rows win (fresher status/score).
    const byId = new Map<number, AFFixture>()
    for (const f of day as AFFixture[]) byId.set(f.fixture.id, f)
    for (const f of live as AFFixture[]) byId.set(f.fixture.id, f)

    const all = Array.from(byId.values()).map(toUi)
    const liveOnes = all.filter((m) => m.state === 'LIVE')
    const rest = all.filter((m) => m.state !== 'LIVE').slice(0, MAX_UPCOMING)
    const data = [...liveOnes, ...rest]

    cache = { at: Date.now(), data }
    return data
  } catch {
    return cache?.data ?? []
  }
}
