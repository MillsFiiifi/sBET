'use client'

import { useCallback, useEffect, useState } from 'react'
import { Heart, Trash2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { FAVORITES_EVENT, getFavorites, removeFavorite } from '@/lib/favorites'
import type { UiMatch } from '@/lib/ui-match'

interface FavoritesPageProps {
  onMatchClick?: (match: UiMatch) => void
}

export function FavoritesPage({ onMatchClick }: FavoritesPageProps) {
  const [matches, setMatches] = useState<UiMatch[] | null>(null)
  const [favIds, setFavIds] = useState<string[]>([])

  const syncFavs = useCallback(() => setFavIds(getFavorites()), [])

  useEffect(() => {
    syncFavs()
    window.addEventListener(FAVORITES_EVENT, syncFavs)
    return () => window.removeEventListener(FAVORITES_EVENT, syncFavs)
  }, [syncFavs])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/matches', { cache: 'no-store' })
        const data = await res.json()
        if (!cancelled) setMatches(data.matches ?? [])
      } catch {
        if (!cancelled) setMatches([])
      }
    }
    void load()
    const t = setInterval(load, 20_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  const favMatches = (matches ?? []).filter((m) => favIds.includes(m.id))

  return (
    <main className="flex-1 overflow-auto">
      <div className="p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <Heart className="w-7 h-7 text-accent fill-accent" />
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Favorites</h1>
          </div>
          <p className="text-sm text-muted-foreground">Matches you starred. Tap the ★ on any match to add it.</p>
        </div>

        {matches === null ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : favMatches.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
            <Heart className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No favorites yet</h3>
            <p className="text-sm text-muted-foreground">Star a match from Sports or Schedule and it&apos;ll appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {favMatches.map((m) => (
              <div
                key={m.id}
                className="bg-card border border-border rounded-xl p-4 hover:border-accent transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => onMatchClick?.(m)}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-semibold text-muted-foreground uppercase truncate">{m.league}</span>
                      {m.state === 'LIVE' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-destructive">
                          <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" /> LIVE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                      <span className="truncate">{m.homeTeam}</span>
                      <span className="text-muted-foreground text-xs shrink-0">vs</span>
                      <span className="truncate">{m.awayTeam}</span>
                    </div>
                    <div className="flex gap-1.5 text-xs tabular-nums">
                      <span className="px-2.5 py-1 bg-secondary rounded font-semibold text-foreground">1 · {m.odds.home.toFixed(2)}</span>
                      {m.odds.draw ? <span className="px-2.5 py-1 bg-secondary rounded font-semibold text-foreground">X · {m.odds.draw.toFixed(2)}</span> : null}
                      <span className="px-2.5 py-1 bg-secondary rounded font-semibold text-foreground">2 · {m.odds.away.toFixed(2)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFavorite(m.id)}
                    className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
                    aria-label="Remove from favorites"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
