import type { PlacedBet } from '@/lib/types'

// Cash-out value for a still-running (pending) bet.
//
// We don't run a live-odds engine, so we approximate the book's offer from how
// long the bet has been live: it starts a little BELOW the stake (a fresh bet
// can't be cashed out for a risk-free profit) and grows toward the potential
// win as the match plays out, with a margin the house keeps.
//
//   value = (stake + (potentialWin - stake) * progress) * MARGIN
//   progress = clamp(minutesSincePlaced / MATCH_MINUTES, 0 .. PROGRESS_CAP)
//
// Deterministic, so the client preview and the server settlement always agree.

const MATCH_MINUTES = 90
const PROGRESS_CAP = 0.95 // never offer the full potential — the result isn't in
const HOUSE_MARGIN = 0.9 // house keeps ~10%

/** Cash-out progress 0..PROGRESS_CAP from how long the bet has been running. */
export function cashoutProgress(placedAt: string, now: number): number {
  const elapsedMin = (now - new Date(placedAt).getTime()) / 60_000
  if (!Number.isFinite(elapsedMin) || elapsedMin <= 0) return 0
  return Math.max(0, Math.min(PROGRESS_CAP, elapsedMin / MATCH_MINUTES))
}

/**
 * The amount we'd pay to cash this bet out right now. Returns 0 for bets that
 * are already settled (nothing to cash out). Pass `now` so client and server
 * can compute an identical value at the same instant.
 */
export function computeCashout(
  bet: Pick<PlacedBet, 'status' | 'stake' | 'potentialWin' | 'placedAt'>,
  now: number,
): number {
  if (bet.status !== 'pending') return 0
  const stake = Number(bet.stake) || 0
  const potential = Number(bet.potentialWin) || 0
  if (potential <= 0) return 0
  const progress = cashoutProgress(bet.placedAt, now)
  const raw = (stake + (potential - stake) * progress) * HOUSE_MARGIN
  return Math.max(0, +raw.toFixed(2))
}
