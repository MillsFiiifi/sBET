import type { PlacedBet } from '@/lib/types'

// Cash-out value = a small fixed fraction of the potential return: 0.1%.
// Deliberately token-only. Without a live-odds engine a larger cash-out could
// be gamed (e.g. cashing out a bet that's already losing), so we keep it tiny.
// `now` is accepted for call-site compatibility but the value is time-independent.
const CASHOUT_RATE = 0.001 // 0.1% of potential win

/**
 * The amount we'd pay to cash this bet out right now. 0 for settled bets.
 */
export function computeCashout(
  bet: Pick<PlacedBet, 'status' | 'stake' | 'potentialWin' | 'placedAt'>,
  _now?: number,
): number {
  if (bet.status !== 'pending') return 0
  const potential = Number(bet.potentialWin) || 0
  if (potential <= 0) return 0
  return +(potential * CASHOUT_RATE).toFixed(2)
}
