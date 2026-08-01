import type { Match } from '@/lib/domain-types'

/**
 * Number of minutes before a match's end (live) or start (upcoming) at which
 * we stop accepting new bets on it.
 */
export const BETTING_CUTOFF_MINUTES = 5

/**
 * Total regulation minutes per sport — used to compute "minutes to end" for
 * live matches. Sports without a clean fixed length aren't auto-closed at the
 * end (only at the start).
 */
const REGULATION_MINUTES: Record<string, number> = {
  football: 90,
  basketball: 48, // NBA-ish; this is loose but good enough for a cutoff signal
  hockey: 60,
}

function parseLeadingNumber(value: string | undefined): number | null {
  if (!value) return null
  const m = value.match(/^\s*(\d+)/)
  if (!m) return null
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) ? n : null
}

/**
 * Minutes until the match's scheduled start, given `startTime` like "19:30"
 * (treated as today in the local timezone). Returns null if the field is
 * missing or unparseable. Negative values mean the start time has passed.
 */
export function minutesUntilStart(startTime: string | undefined, now: Date = new Date()): number | null {
  if (!startTime) return null
  const m = startTime.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const hours = parseInt(m[1], 10)
  const minutes = parseInt(m[2], 10)
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null
  }
  const target = new Date(now)
  target.setHours(hours, minutes, 0, 0)
  // If the time-of-day has already passed today, assume it's tomorrow — that
  // way "19:30" on a 22:00 clock isn't reported as 2.5 hours in the past.
  if (target.getTime() < now.getTime() - 60 * 60 * 1000) {
    target.setDate(target.getDate() + 1)
  }
  return Math.round((target.getTime() - now.getTime()) / 60000)
}

/**
 * How long after kickoff we keep treating a NON-football match as "live" when
 * the feed gives no clock (football has its own half-aware window below).
 */
export const LIVE_WINDOW_MINUTES = 130

// Real-football clock model, used when we derive the minute from wall-clock
// (feed gave no live minute): play 0→45, then a 15-minute half-time break with
// the clock held at 45, then resume 45→90. So 90' is reached 105 wall-minutes
// after kickoff, and the match is "live" for that whole span.
const FIRST_HALF_MIN = 45
const HALF_TIME_BREAK_MIN = 15
const FULL_MATCH_MIN = 90
// Wall-clock minute at which the match clock reaches 90' (45 + 15 + 45).
const FOOTBALL_FULL_WALL = FIRST_HALF_MIN + HALF_TIME_BREAK_MIN + (FULL_MATCH_MIN - FIRST_HALF_MIN)

function isFootball(match: Match): boolean {
  return (match.sport ?? 'football').toLowerCase() === 'football'
}

/** How long after kickoff a match keeps showing live (sport-aware). */
function liveWindowMinutes(match: Match): number {
  return isFootball(match) ? FOOTBALL_FULL_WALL : LIVE_WINDOW_MINUTES
}

/** Epoch-ms of kickoff from the full ISO timestamp; null if not parseable. */
function kickoffTime(match: Match): number | null {
  if (match.startTimeISO) {
    const t = Date.parse(match.startTimeISO)
    if (!Number.isNaN(t)) return t
  }
  return null
}

/**
 * True once the scheduled kickoff time has passed. Prefers the full ISO
 * timestamp (accurate); falls back to the "HH:MM" start time.
 */
export function hasKickedOff(match: Match, now: Date = new Date()): boolean {
  const k = kickoffTime(match)
  if (k !== null) return now.getTime() >= k
  const until = minutesUntilStart(match.startTime, now)
  return until !== null && until <= 0
}

/**
 * Whether to DISPLAY a match as live right now. True if the feed already flags
 * it live, OR kickoff has passed and we're still inside the live window — so a
 * game shows "LIVE" the moment it kicks off even before the feed catches up,
 * without showing live forever after it ends.
 */
export function isLiveNow(match: Match, now: Date = new Date()): boolean {
  if (match.isLive) return true
  const k = kickoffTime(match)
  if (k !== null) {
    const elapsedMin = (now.getTime() - k) / 60000
    return elapsedMin >= 0 && elapsedMin <= liveWindowMinutes(match)
  }
  // No ISO timestamp: HH:MM can't tell "just kicked off" from "tomorrow" past
  // an hour, so this only reliably catches the first hour — acceptable fallback.
  const until = minutesUntilStart(match.startTime, now)
  return until !== null && until <= 0
}

/**
 * Match minute derived from wall-clock since kickoff, for a live match the feed
 * gave no clock for. For football it mirrors a real match: 0→45 in the first
 * half, held at 45 through the 15-minute half-time break, then 45→90 in the
 * second half. Other sports just count up, capped at their regulation length.
 */
export function liveMinuteFromKickoff(match: Match, now: Date = new Date()): number | null {
  const k = kickoffTime(match)
  if (k === null) return null
  const elapsed = (now.getTime() - k) / 60000 // wall-clock minutes since kickoff
  if (elapsed < 0) return null

  if (isFootball(match)) {
    if (elapsed < FIRST_HALF_MIN) return Math.floor(elapsed) // 1st half 0'→44'
    if (elapsed < FIRST_HALF_MIN + HALF_TIME_BREAK_MIN) return FIRST_HALF_MIN // half-time, held at 45'
    if (elapsed < FOOTBALL_FULL_WALL) return Math.floor(elapsed - HALF_TIME_BREAK_MIN) // 2nd half 45'→89'
    return FULL_MATCH_MIN // 90'
  }

  const regulation = REGULATION_MINUTES[(match.sport ?? 'football').toLowerCase()] ?? 90
  return Math.min(Math.floor(elapsed), regulation)
}

/**
 * The integer match minute derived from a kickoff ISO timestamp, half-aware for
 * football (held at 45 during the break, 90 once finished). Returns null before
 * kickoff. Used to drive scripted goals off the clock.
 */
export function matchMinuteFromKickoff(
  startTimeISO: string | undefined,
  sport: string | undefined,
  now: Date = new Date(),
): number | null {
  if (!startTimeISO) return null
  const k = Date.parse(startTimeISO)
  if (Number.isNaN(k)) return null
  const elapsed = (now.getTime() - k) / 60000
  if (elapsed < 0) return null
  if ((sport ?? 'football').toLowerCase() === 'football') {
    if (elapsed < FIRST_HALF_MIN) return Math.floor(elapsed)
    if (elapsed < FIRST_HALF_MIN + HALF_TIME_BREAK_MIN) return FIRST_HALF_MIN
    if (elapsed < FOOTBALL_FULL_WALL) return Math.floor(elapsed - HALF_TIME_BREAK_MIN)
    return FULL_MATCH_MIN
  }
  const reg = REGULATION_MINUTES[(sport ?? '').toLowerCase()] ?? 90
  return Math.min(Math.floor(elapsed), reg)
}

/**
 * Shift 1X2 odds to reflect the live scoreline, like a real book: the team in
 * front shortens, the team behind drifts out, and the swing grows with the size
 * of the lead and how late it is. Pure display drama for custom matches (live
 * betting is locked anyway). Draw odds of 0 (no draw market) stay 0.
 */
export function liveOddsForScore(
  base: { home: number; draw: number; away: number },
  homeScore: number,
  awayScore: number,
  minute: number,
): { home: number; draw: number; away: number } {
  const lead = homeScore - awayScore
  const t = Math.max(0, Math.min(1, minute / 90)) // 0 at KO → 1 at full time
  const k = 0.25 + 0.55 * t // adjustment strength grows through the match
  const f = Math.min(Math.abs(lead), 3) * k
  const floor = (x: number) => Math.max(1.01, Math.round(x * 100) / 100)

  let { home, draw, away } = base
  if (lead > 0) {
    home = home * (1 - 0.18 * f)
    away = away * (1 + 0.55 * f)
    draw = draw * (1 + 0.15 * f)
  } else if (lead < 0) {
    away = away * (1 - 0.18 * f)
    home = home * (1 + 0.55 * f)
    draw = draw * (1 + 0.15 * f)
  } else {
    // Level: a draw gets likelier as time runs out; both wins drift slightly.
    draw = draw * (1 - 0.18 * t)
    home = home * (1 + 0.08 * t)
    away = away * (1 + 0.08 * t)
  }
  return {
    home: floor(home),
    draw: draw > 0 ? floor(draw) : 0,
    away: floor(away),
  }
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/** "M:SS" from a total second count, e.g. 4880 → "81:20". */
function clockFromSeconds(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = Math.floor(totalSec % 60)
  return `${m}:${pad2(s)}`
}

export interface LiveClock {
  /** Display label: "81:20", "HT", "FT", or "" when not live/unknown. */
  label: string
  /** True while the match should be shown as live. */
  live: boolean
}

/**
 * A real-time, second-ticking match clock derived from the kickoff timestamp —
 * the data feed only gives whole minutes, so seconds come from wall-clock here.
 * Football mirrors a real match (0:00→45:00, "HT" for the 15-min break,
 * 45:00→90:00); other sports count up to their regulation length. Call this
 * every second from a client component to animate the clock.
 */
export function liveClockLabel(
  startTimeISO: string | undefined,
  sport: string | undefined,
  now: Date = new Date(),
): LiveClock {
  if (!startTimeISO) return { label: '', live: false }
  const k = Date.parse(startTimeISO)
  if (Number.isNaN(k)) return { label: '', live: false }
  const elapsedSec = (now.getTime() - k) / 1000
  if (elapsedSec < 0) return { label: '', live: false }

  const football = (sport ?? 'football').toLowerCase() === 'football'
  if (!football) {
    const reg = REGULATION_MINUTES[(sport ?? '').toLowerCase()] ?? 90
    if (elapsedSec > LIVE_WINDOW_MINUTES * 60) return { label: 'FT', live: false }
    return { label: clockFromSeconds(Math.min(elapsedSec, reg * 60)), live: true }
  }

  const firstHalfSec = FIRST_HALF_MIN * 60
  const breakSec = HALF_TIME_BREAK_MIN * 60
  const fullWallSec = FOOTBALL_FULL_WALL * 60
  if (elapsedSec < firstHalfSec) return { label: clockFromSeconds(elapsedSec), live: true } // 0:00→44:59
  if (elapsedSec < firstHalfSec + breakSec) return { label: 'HT', live: true } // half-time break
  if (elapsedSec < fullWallSec) return { label: clockFromSeconds(elapsedSec - breakSec), live: true } // 45:00→89:59
  return { label: 'FT', live: false }
}

/**
 * Whether a derived-live football match is currently in its half-time break
 * (clock held at 45'). Lets the UI show "HT" instead of a frozen 45'.
 */
export function isHalfTime(match: Match, now: Date = new Date()): boolean {
  if (match.isLive) return false // the feed drives the clock; trust its minute
  if (!isFootball(match)) return false
  const k = kickoffTime(match)
  if (k === null) return false
  const elapsed = (now.getTime() - k) / 60000
  return elapsed >= FIRST_HALF_MIN && elapsed < FIRST_HALF_MIN + HALF_TIME_BREAK_MIN
}

/**
 * For a live football match with minute "85'", returns 5 (90 - 85). For sports
 * without a fixed regulation length we can't compute this and return null.
 */
export function minutesUntilEnd(match: Match): number | null {
  if (!match.isLive) return null
  const sport = (match.sport ?? 'football').toLowerCase()
  const regulation = REGULATION_MINUTES[sport]
  if (!regulation) return null
  const elapsed = parseLeadingNumber(match.minute)
  if (elapsed === null) return null
  return Math.max(0, regulation - elapsed)
}

export interface BettingState {
  closed: boolean
  reason: 'starting-soon' | 'started' | 'finished' | 'admin-locked' | 'postponed' | null
  /** Minutes remaining until the cutoff event (start or end). 0 = already cut off. */
  minutesRemaining: number | null
}

/**
 * Decide whether to accept new bets on a given match.
 * Rules:
 *   • Admin manually locked it (custom matches only) → closed.
 *   • Match is live → closed (no in-play betting; lock stays until match
 *     finishes and the admin sets isLive=false).
 *   • Upcoming match within BETTING_CUTOFF_MINUTES of its start time → closed.
 *   • Match's start time has passed but isLive isn't flipped yet → closed
 *     (started — admin still has to mark it live or final).
 */
export function getBettingState(match: Match, now: Date = new Date()): BettingState {
  if (match.postponed) {
    return { closed: true, reason: 'postponed', minutesRemaining: 0 }
  }

  if (match.locked) {
    return { closed: true, reason: 'admin-locked', minutesRemaining: 0 }
  }

  if (match.isLive) {
    // Any live match is locked. If the elapsed minute already exceeds the
    // regulation length we report it as finished; otherwise it's mid-game.
    const left = minutesUntilEnd(match)
    if (left !== null && left <= 0) {
      return { closed: true, reason: 'finished', minutesRemaining: 0 }
    }
    return { closed: true, reason: 'started', minutesRemaining: left }
  }

  // Kicked off but the feed hasn't flipped isLive yet — close betting anyway.
  // Uses the ISO timestamp, so it's correct even hours after kickoff (the
  // HH:MM check below can't distinguish "started" from "tomorrow").
  if (hasKickedOff(match, now)) {
    return { closed: true, reason: 'started', minutesRemaining: 0 }
  }

  const untilStart = minutesUntilStart(match.startTime, now)
  if (untilStart === null) {
    return { closed: false, reason: null, minutesRemaining: null }
  }
  if (untilStart <= 0) {
    return { closed: true, reason: 'started', minutesRemaining: 0 }
  }
  if (untilStart <= BETTING_CUTOFF_MINUTES) {
    return { closed: true, reason: 'starting-soon', minutesRemaining: untilStart }
  }
  return { closed: false, reason: null, minutesRemaining: untilStart }
}

export function isBettingClosed(match: Match): boolean {
  return getBettingState(match).closed
}
