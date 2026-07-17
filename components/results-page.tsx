'use client'

import { useEffect, useMemo, useState } from 'react'
import { Trophy } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { UiMatch } from '@/lib/ui-match'

interface ResultsPageProps {
  onMatchClick?: (match: UiMatch) => void
}

const SPORT_FILTERS = ['All Sports', 'soccer', 'basketball', 'tennis']

export function ResultsPage({ onMatchClick }: ResultsPageProps) {
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

  const finished = useMemo(
    () => (matches ?? []).filter((m) => m.state === 'FINISHED'),
    [matches],
  )
  const filtered = sport === 'All Sports' ? finished : finished.filter((m) => m.sport === sport)
  const sports = Array.from(new Set(finished.map((m) => m.sport)))
  const chips = ['All Sports', ...SPORT_FILTERS.slice(1).filter((s) => sports.includes(s))]

  return (
    <main className="flex-1 overflow-auto">
      <div className="p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <Trophy className="w-7 h-7 text-accent" />
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Results</h1>
          </div>
          <p className="text-sm text-muted-foreground">Recent match results and scores</p>
        </div>

        {/* Filter chips */}
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
              {c === 'All Sports' ? c : c}
            </button>
          ))}
        </div>

        {matches === null ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
            <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No results yet</h3>
            <p className="text-sm text-muted-foreground">Finished matches with a final score show up here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((m) => {
              const homeWin = m.homeScore > m.awayScore
              const awayWin = m.awayScore > m.homeScore
              return (
                <div
                  key={m.id}
                  onClick={() => onMatchClick?.(m)}
                  className="bg-card border border-border rounded-xl p-4 sm:p-5 hover:border-accent transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground uppercase truncate">{m.league}</p>
                      {m.startTime && <p className="text-xs text-muted-foreground">{m.startTime}</p>}
                    </div>
                    <span className="shrink-0 px-3 py-1 bg-success/20 text-success text-xs font-semibold rounded-full">
                      Final
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className={`font-bold truncate ${homeWin ? 'text-foreground' : 'text-muted-foreground'}`}>{m.homeTeam}</p>
                      <p className={`font-bold truncate ${awayWin ? 'text-foreground' : 'text-muted-foreground'}`}>{m.awayTeam}</p>
                    </div>
                    <div className="flex flex-col items-center gap-1 px-4 py-2 bg-secondary rounded-lg shrink-0">
                      <span className={`text-xl font-extrabold tabular-nums ${homeWin ? 'text-accent' : 'text-foreground'}`}>{m.homeScore}</span>
                      <span className={`text-xl font-extrabold tabular-nums ${awayWin ? 'text-accent' : 'text-foreground'}`}>{m.awayScore}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
