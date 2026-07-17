'use client'

import { useEffect, useMemo, useState } from 'react'
import { Calendar } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { UiMatch } from '@/lib/ui-match'

interface SchedulePageProps {
  onMatchClick?: (match: UiMatch) => void
}

export function SchedulePage({ onMatchClick }: SchedulePageProps) {
  const [matches, setMatches] = useState<UiMatch[] | null>(null)
  const [sport, setSport] = useState('All Sports')

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

  const upcoming = useMemo(
    () => (matches ?? []).filter((m) => m.state === 'UPCOMING'),
    [matches],
  )
  const sports = Array.from(new Set(upcoming.map((m) => m.sport)))
  const chips = ['All Sports', ...sports]
  const filtered = sport === 'All Sports' ? upcoming : upcoming.filter((m) => m.sport === sport)

  return (
    <main className="flex-1 overflow-auto">
      <div className="p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <Calendar className="w-7 h-7 text-accent" />
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Schedule</h1>
          </div>
          <p className="text-sm text-muted-foreground">Upcoming matches and events</p>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {chips.map((c) => (
            <button
              key={c}
              onClick={() => setSport(c)}
              className={`px-4 py-2 rounded-full text-sm font-semibold capitalize transition-colors ${
                sport === c
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-card border border-border text-foreground hover:border-accent'
              }`}
            >
              {c === 'All Sports' ? c : c.replace('-', ' ')}
            </button>
          ))}
        </div>

        {matches === null ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
            <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <h3 className="text-lg font-semibold text-foreground mb-1">Nothing scheduled</h3>
            <p className="text-sm text-muted-foreground">Upcoming matches added by the admin appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((m) => (
              <div
                key={m.id}
                onClick={() => onMatchClick?.(m)}
                className="bg-card border border-border rounded-xl p-4 hover:border-accent transition-colors cursor-pointer flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1 truncate">{m.league}</p>
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <span className="truncate">{m.homeTeam}</span>
                    <span className="text-muted-foreground text-xs shrink-0">vs</span>
                    <span className="truncate">{m.awayTeam}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-accent">{m.startTime || 'TBD'}</p>
                  <div className="mt-1 flex gap-1.5 justify-end text-xs tabular-nums">
                    <span className="px-2 py-1 bg-secondary rounded font-semibold">{m.odds.home.toFixed(2)}</span>
                    {m.odds.draw ? <span className="px-2 py-1 bg-secondary rounded font-semibold">{m.odds.draw.toFixed(2)}</span> : null}
                    <span className="px-2 py-1 bg-secondary rounded font-semibold">{m.odds.away.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
