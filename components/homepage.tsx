'use client'

import { useEffect, useState } from 'react'
import { MatchCard } from './match-card'
import { SPORT_ICONS } from '@/components/sport-icons'
import { Skeleton } from '@/components/ui/skeleton'
import type { UiMatch } from '@/lib/ui-match'
import { TrendingUp, Calendar, Trophy, Radio } from 'lucide-react'

interface HomepageProps {
  onMatchClick?: (match: UiMatch) => void
}

export function Homepage({ onMatchClick }: HomepageProps) {
  const [matches, setMatches] = useState<UiMatch[] | null>(null)

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
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  const live = (matches ?? []).filter((m) => m.state === 'LIVE')
  const upcoming = (matches ?? []).filter((m) => m.state === 'UPCOMING')

  // Sports overview counts derived from real matches.
  const sportCounts = new Map<string, number>()
  for (const m of matches ?? []) {
    sportCounts.set(m.sport, (sportCounts.get(m.sport) ?? 0) + 1)
  }
  const sportsWithMatches = Array.from(sportCounts.entries()).sort((a, b) => b[1] - a[1])

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-6 lg:space-y-8">
        {/* Quick Stats — real */}
        <section>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Live Matches" value={live.length} icon={<Radio className="w-8 h-8 text-destructive opacity-70" />} />
            <StatCard label="Upcoming" value={upcoming.length} icon={<Calendar className="w-8 h-8 text-accent opacity-60" />} />
            <StatCard label="Total Matches" value={(matches ?? []).length} icon={<Trophy className="w-8 h-8 text-accent opacity-60" />} />
          </div>
        </section>

        {/* Sports Overview */}
        {sportsWithMatches.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">Popular Sports</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {sportsWithMatches.map(([sport, count]) => {
                const Icon = SPORT_ICONS[sport]
                return (
                  <div
                    key={sport}
                    className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:border-accent hover:shadow-lg transition-all"
                  >
                    {Icon && <Icon className="w-9 h-9 mb-2 text-accent" />}
                    <h3 className="font-semibold text-foreground mb-1 capitalize">{sport.replace('-', ' ')}</h3>
                    <p className="text-sm text-muted-foreground">{count} {count === 1 ? 'match' : 'matches'}</p>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Loading skeletons */}
        {matches === null && (
          <section>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-56 rounded-lg" />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {matches !== null && matches.length === 0 && (
          <section>
            <div className="bg-card border border-dashed border-border rounded-lg p-12 text-center">
              <TrendingUp className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <h3 className="text-lg font-semibold text-foreground mb-1">No matches yet</h3>
              <p className="text-sm text-muted-foreground">
                An admin can add matches from the dashboard. They&apos;ll appear here in real time.
              </p>
            </div>
          </section>
        )}

        {/* Live Matches */}
        {live.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" /> Live Matches
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {live.map((match) => (
                <MatchCard key={match.id} match={match} onClick={() => onMatchClick?.(match)} />
              ))}
            </div>
          </section>
        )}

        {/* Upcoming Matches */}
        {upcoming.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">Upcoming Matches</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {upcoming.map((match) => (
                <MatchCard key={match.id} match={match} onClick={() => onMatchClick?.(match)} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
        </div>
        {icon}
      </div>
    </div>
  )
}
