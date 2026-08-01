import { NextResponse } from 'next/server'
import {
  readCustomMatches,
  addCustomMatch,
} from '@/lib/custom-matches-store'
import { supportedSports } from '@/lib/api-football'
import type { Match, MatchGoal } from '@/lib/domain-types'

/** Validate an incoming goal script into clean MatchGoal[]. */
function sanitizeGoals(raw: unknown): MatchGoal[] {
  if (!Array.isArray(raw)) return []
  const out: MatchGoal[] = []
  for (const g of raw) {
    const minute = Number((g as { minute?: unknown })?.minute)
    const team = (g as { team?: unknown })?.team
    if (Number.isFinite(minute) && minute >= 0 && minute <= 130 && (team === 'home' || team === 'away')) {
      out.push({ minute: Math.floor(minute), team })
    }
  }
  return out.sort((a, b) => a.minute - b.minute)
}

export const dynamic = 'force-dynamic'

export async function GET() {
  const matches = await readCustomMatches()
  return NextResponse.json({ matches })
}

interface CreatePayload {
  sport?: string
  league?: string
  country?: string
  homeTeam?: string
  awayTeam?: string
  homeFlagUrl?: string
  awayFlagUrl?: string
  startTime?: string
  /** Full ISO kickoff timestamp for a scheduled match (enables auto-start). */
  startTimeISO?: string
  isLive?: boolean
  minute?: string
  homeScore?: number
  awayScore?: number
  odds?: { home?: number; draw?: number; away?: number }
  /** Scripted goal timeline, e.g. [{ minute: 20, team: 'home' }]. */
  goals?: unknown
}

export async function POST(request: Request) {
  let body: CreatePayload
  try {
    body = (await request.json()) as CreatePayload
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const sport = (body.sport ?? 'football').toLowerCase()
  if (!supportedSports().includes(sport)) {
    return NextResponse.json(
      { error: `unsupported sport: ${sport}` },
      { status: 400 },
    )
  }

  const league = (body.league ?? '').trim()
  const country = (body.country ?? '').trim()
  const homeTeam = (body.homeTeam ?? '').trim()
  const awayTeam = (body.awayTeam ?? '').trim()
  if (!league || !homeTeam || !awayTeam) {
    return NextResponse.json(
      { error: 'league, homeTeam, and awayTeam are required' },
      { status: 400 },
    )
  }

  const home = Number(body.odds?.home)
  const draw = Number(body.odds?.draw)
  const away = Number(body.odds?.away)
  if (!Number.isFinite(home) || !Number.isFinite(away) || home <= 1 || away <= 1) {
    return NextResponse.json(
      { error: 'odds.home and odds.away must be > 1.0' },
      { status: 400 },
    )
  }

  const homeFlagUrl = (body.homeFlagUrl ?? '').trim() || undefined
  const awayFlagUrl = (body.awayFlagUrl ?? '').trim() || undefined

  const isLive = body.isLive === true
  const goals = sanitizeGoals(body.goals)

  // A scheduled match can carry a full ISO kickoff so it auto-starts at that
  // time; derive the "HH:MM" display label from it when not given explicitly.
  const startISO = (body.startTimeISO ?? '').trim() || undefined
  let startLabel = (body.startTime ?? '').trim() || undefined
  if (!startLabel && startISO) {
    const d = new Date(startISO)
    if (!Number.isNaN(d.getTime())) {
      startLabel = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    }
  }

  const match: Omit<Match, 'id' | 'custom'> & { sport: string } = {
    sport,
    league,
    country: country || 'Custom',
    homeTeam,
    awayTeam,
    homeFlagUrl,
    awayFlagUrl,
    isLive,
    goals,
    odds: {
      home: +home.toFixed(2),
      draw: Number.isFinite(draw) && draw > 1 ? +draw.toFixed(2) : 0,
      away: +away.toFixed(2),
    },
    ...(isLive
      ? {
          minute: (body.minute ?? "1'").trim(),
          homeScore: Number.isFinite(Number(body.homeScore))
            ? Math.max(0, Math.floor(Number(body.homeScore)))
            : 0,
          awayScore: Number.isFinite(Number(body.awayScore))
            ? Math.max(0, Math.floor(Number(body.awayScore)))
            : 0,
          startTime: startLabel,
          startTimeISO: startISO,
        }
      : { startTime: startLabel, startTimeISO: startISO }),
  }

  const created = await addCustomMatch(match)
  return NextResponse.json({ match: created }, { status: 201 })
}
