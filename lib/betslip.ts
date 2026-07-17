'use client'

// Global bet slip: selections the user has tapped from any match. One
// selection per match+market (tapping another outcome replaces it; tapping the
// same one removes it). Persisted to localStorage; components subscribe to
// BETSLIP_EVENT to re-render.

export interface Selection {
  /** Unique per match+market so a new outcome replaces the old pick. */
  key: string
  matchId: string
  homeTeam: string
  awayTeam: string
  league: string
  country?: string
  marketKey: string
  marketLabel: string
  outcomeKey: string
  outcomeLabel: string
  odds: number
}

const KEY = 'sbet_betslip'
export const BETSLIP_EVENT = 'sbet-betslip-changed'
export const BALANCE_EVENT = 'sbet-balance-changed'

export function getSelections(): Selection[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function save(list: Selection[]): void {
  localStorage.setItem(KEY, JSON.stringify(list))
  window.dispatchEvent(new Event(BETSLIP_EVENT))
}

export function isSelected(matchId: string, marketKey: string, outcomeKey: string): boolean {
  return getSelections().some(
    (s) => s.matchId === matchId && s.marketKey === marketKey && s.outcomeKey === outcomeKey,
  )
}

/** Add the pick, replace a different outcome on the same match+market, or
 *  remove it if the exact same pick is tapped again. */
export function toggleSelection(sel: Selection): void {
  if (typeof window === 'undefined') return
  const list = getSelections()
  const sameKey = list.find((s) => s.key === sel.key)
  if (sameKey && sameKey.outcomeKey === sel.outcomeKey) {
    save(list.filter((s) => s.key !== sel.key)) // tapped same → remove
    return
  }
  save([...list.filter((s) => s.key !== sel.key), sel]) // add or replace
}

export function removeSelection(key: string): void {
  if (typeof window === 'undefined') return
  save(getSelections().filter((s) => s.key !== key))
}

export function clearSlip(): void {
  if (typeof window === 'undefined') return
  save([])
}
