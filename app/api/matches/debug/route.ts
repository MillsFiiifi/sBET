import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const API_BASE = 'https://v3.football.api-sports.io'

interface DebugFixture {
  id: number
  league: string
  leagueId: number
  status: string
  elapsed: number | null
  home: string
  away: string
}

interface DebugOddsRow {
  fixtureId: number
  league: string
  betCount: number
  hasMatchWinner: boolean
  bets: Array<{ id: number; name: string; sampleValues: string[] }>
}

async function call(path: string, key: string) {
  const start = Date.now()
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'x-apisports-key': key },
      cache: 'no-store',
    })
    const ms = Date.now() - start
    const text = await res.text()
    let json: { errors?: unknown; results?: number; response?: unknown } | null = null
    try {
      json = JSON.parse(text)
    } catch {}
    return {
      ok: res.ok,
      status: res.status,
      ms,
      results: json?.results ?? null,
      errors: json?.errors ?? null,
      response: json?.response ?? null,
      raw: res.ok ? undefined : text.slice(0, 400),
    }
  } catch (e) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - start,
      results: null,
      errors: null,
      response: null,
      raw: e instanceof Error ? e.message : String(e),
    }
  }
}

export async function GET() {
  const key = process.env.API_FOOTBALL_KEY
  if (!key) {
    return NextResponse.json({ error: 'API_FOOTBALL_KEY missing' }, { status: 500 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const [today_fixtures, live_fixtures, live_odds] = await Promise.all([
    call(`/fixtures?date=${today}`, key),
    call(`/fixtures?live=all`, key),
    call(`/odds/live`, key),
  ])

  const liveFixturesSummary: DebugFixture[] = Array.isArray(live_fixtures.response)
    ? (live_fixtures.response as Array<Record<string, unknown>>)
        .slice(0, 10)
        .map((f) => {
          const fixture = f.fixture as Record<string, unknown>
          const league = f.league as Record<string, unknown>
          const teams = f.teams as Record<string, Record<string, unknown>>
          const status = fixture.status as Record<string, unknown>
          return {
            id: fixture.id as number,
            league: league.name as string,
            leagueId: league.id as number,
            status: status.short as string,
            elapsed: (status.elapsed as number | null) ?? null,
            home: teams.home.name as string,
            away: teams.away.name as string,
          }
        })
    : []

  const liveOddsSummary: DebugOddsRow[] = Array.isArray(live_odds.response)
    ? (live_odds.response as Array<Record<string, unknown>>)
        .slice(0, 3)
        .map((r) => {
          const fixture = r.fixture as Record<string, unknown>
          const league = (r.league as Record<string, unknown>) ?? {}
          const odds = (r.odds as Array<Record<string, unknown>>) ?? []
          return {
            fixtureId: fixture.id as number,
            league: (league.name as string) ?? '?',
            betCount: odds.length,
            hasMatchWinner: odds.some((b) => b.id === 1),
            bets: odds.map((b) => {
              const values = (b.values as Array<Record<string, unknown>>) ?? []
              return {
                id: b.id as number,
                name: b.name as string,
                sampleValues: values
                  .slice(0, 3)
                  .map((v) => `${v.value}=${v.odd}`),
              }
            }),
          }
        })
    : []

  const liveFixtureIds = new Set(
    (Array.isArray(live_fixtures.response) ? live_fixtures.response : []).map(
      (f) => (f as { fixture: { id: number } }).fixture.id,
    ),
  )
  const liveOddsIds = new Set(
    (Array.isArray(live_odds.response) ? live_odds.response : []).map(
      (r) => (r as { fixture: { id: number } }).fixture.id,
    ),
  )
  const overlap = [...liveFixtureIds].filter((id) => liveOddsIds.has(id)).length

  // Distribution of bet ids across ALL live odds rows so we can see which
  // markets are widely offered live (and confirm whether Match Winner /
  // Fulltime Result is present anywhere).
  const betIdHistogram: Record<number, { name: string; count: number }> = {}
  const liveRows = Array.isArray(live_odds.response) ? live_odds.response : []
  let liveRowsWithMatchWinner = 0
  for (const r of liveRows) {
    const odds = ((r as Record<string, unknown>).odds as Array<Record<string, unknown>>) ?? []
    let hasMW = false
    for (const b of odds) {
      const id = b.id as number
      const name = b.name as string
      if (!betIdHistogram[id]) betIdHistogram[id] = { name, count: 0 }
      betIdHistogram[id].count++
      if (id === 1 || id === 59) hasMW = true
    }
    if (hasMW) liveRowsWithMatchWinner++
  }

  return NextResponse.json({
    today,
    upstream: {
      todayFixtures: {
        ok: today_fixtures.ok,
        status: today_fixtures.status,
        ms: today_fixtures.ms,
        results: today_fixtures.results,
        errors: today_fixtures.errors,
        raw: today_fixtures.raw,
      },
      liveFixtures: {
        ok: live_fixtures.ok,
        status: live_fixtures.status,
        ms: live_fixtures.ms,
        results: live_fixtures.results,
        errors: live_fixtures.errors,
        raw: live_fixtures.raw,
        sample: liveFixturesSummary,
      },
      liveOdds: {
        ok: live_odds.ok,
        status: live_odds.status,
        ms: live_odds.ms,
        results: live_odds.results,
        errors: live_odds.errors,
        raw: live_odds.raw,
        sample: liveOddsSummary,
      },
    },
    overlap: {
      liveFixtureIds: liveFixtureIds.size,
      liveOddsIds: liveOddsIds.size,
      idsInBoth: overlap,
    },
    liveBetDistribution: {
      rowsWithMatchWinner: liveRowsWithMatchWinner,
      totalRows: liveRows.length,
      byBetId: betIdHistogram,
    },
  })
}
