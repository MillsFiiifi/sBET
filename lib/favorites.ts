'use client'

// Client-side favourites: a set of match ids stored in localStorage. Kept
// simple and device-local (no server round-trip). Components subscribe to the
// 'sbet-favorites-changed' event to re-render when the set changes.

const KEY = 'sbet_favorites'
export const FAVORITES_EVENT = 'sbet-favorites-changed'

export function getFavorites(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function isFavorite(id: string): boolean {
  return getFavorites().includes(id)
}

function save(ids: string[]): void {
  localStorage.setItem(KEY, JSON.stringify(ids))
  window.dispatchEvent(new Event(FAVORITES_EVENT))
}

export function toggleFavorite(id: string): string[] {
  if (typeof window === 'undefined') return []
  const current = getFavorites()
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
  save(next)
  return next
}

export function removeFavorite(id: string): string[] {
  if (typeof window === 'undefined') return []
  const next = getFavorites().filter((x) => x !== id)
  save(next)
  return next
}
