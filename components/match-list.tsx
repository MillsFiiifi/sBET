'use client'

import { useEffect, useState } from 'react'
import { ChevronRight, Star } from 'lucide-react'
import { FAVORITES_EVENT, getFavorites, toggleFavorite } from '@/lib/favorites'
import { BETSLIP_EVENT, getSelections, toggleSelection } from '@/lib/betslip'
import type { UiMatch } from '@/lib/ui-match'

interface MatchListProps {
  matches: UiMatch[]
  onMatchClick?: (match: UiMatch) => void
}

const OUTCOME_LABEL: Record<string, string> = { home: 'Home', draw: 'Draw', away: 'Away' }

/** SportyBet-style match rows: grouped by league, with team logos, live
 *  minute/score and a 1 · X · 2 odds strip. Works the same on mobile + desktop. */
export function MatchList({ matches, onMatchClick }: MatchListProps) {
  const [favs, setFavs] = useState<string[]>([])
  const [picks, setPicks] = useState<Set<string>>(new Set())

  useEffect(() => {
    const sync = () => setFavs(getFavorites())
    sync()
    window.addEventListener(FAVORITES_EVENT, sync)
    return () => window.removeEventListener(FAVORITES_EVENT, sync)
  }, [])

  useEffect(() => {
    const sync = () =>
      setPicks(new Set(getSelections().map((s) => `${s.matchId}:${s.outcomeKey}`)))
    sync()
    window.addEventListener(BETSLIP_EVENT, sync)
    return () => window.removeEventListener(BETSLIP_EVENT, sync)
  }, [])

  const pick = (m: UiMatch, outcome: 'home' | 'draw' | 'away', odds: number) =>
    toggleSelection({
      key: `${m.id}:1x2`,
      matchId: m.id,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      league: m.league,
      marketKey: '1x2',
      marketLabel: 'Match Result',
      outcomeKey: outcome,
      outcomeLabel: OUTCOME_LABEL[outcome],
      odds,
    })

  // Group by league, preserving order of first appearance.
  const groups: { league: string; items: UiMatch[] }[] = []
  const index = new Map<string, number>()
  for (const m of matches) {
    if (!index.has(m.league)) {
      index.set(m.league, groups.length)
      groups.push({ league: m.league, items: [] })
    }
    groups[index.get(m.league)!].items.push(m)
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.league} className="bg-card border border-border rounded-xl overflow-hidden">
          {/* League header + column labels */}
          <div className="flex items-center gap-2 px-3 py-2 bg-secondary/60 border-b border-border">
            <span className="flex-1 min-w-0 text-xs font-bold uppercase tracking-wide text-muted-foreground truncate">
              {g.league}
            </span>
            <div className="flex gap-1 shrink-0">
              {['1', 'X', '2'].map((l) => (
                <span key={l} className="w-11 sm:w-14 text-center text-[11px] font-semibold text-muted-foreground">
                  {l}
                </span>
              ))}
            </div>
            <span className="w-5 shrink-0" />
          </div>

          {/* Rows */}
          <ul className="divide-y divide-border">
            {g.items.map((m) => {
              const isLive = m.state === 'LIVE'
              const showScore = isLive || m.hasScore
              const isFav = favs.includes(m.id)
              return (
                <li key={m.id} className="flex items-stretch hover:bg-secondary/30 transition-colors">
                  {/* Left rail: star + time/minute */}
                  <div className="w-12 shrink-0 flex flex-col items-center justify-center gap-1 py-2 pl-1">
                    <button
                      onClick={() => toggleFavorite(m.id)}
                      className={`transition-colors ${isFav ? 'text-accent' : 'text-muted-foreground/50 hover:text-accent'}`}
                      aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                    </button>
                    {isLive ? (
                      <span className="text-[11px] font-bold text-success leading-tight text-center">{m.time}</span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground leading-tight text-center">{m.time}</span>
                    )}
                  </div>

                  {/* Teams */}
                  <button
                    onClick={() => onMatchClick?.(m)}
                    className="flex-1 min-w-0 flex flex-col justify-center gap-1.5 py-2 pr-1 text-left"
                  >
                    <TeamRow name={m.homeTeam} flag={m.homeFlagUrl} score={showScore ? m.homeScore : undefined} />
                    <TeamRow name={m.awayTeam} flag={m.awayFlagUrl} score={showScore ? m.awayScore : undefined} />
                  </button>

                  {/* Odds strip — tap to add to bet slip */}
                  <div className="flex items-center gap-1 shrink-0 py-2">
                    <Odd label="1" value={m.odds.home} locked={m.locked} selected={picks.has(`${m.id}:home`)} onClick={() => pick(m, 'home', m.odds.home)} />
                    <Odd label="X" value={m.odds.draw} locked={m.locked} selected={picks.has(`${m.id}:draw`)} onClick={() => m.odds.draw && pick(m, 'draw', m.odds.draw)} />
                    <Odd label="2" value={m.odds.away} locked={m.locked} selected={picks.has(`${m.id}:away`)} onClick={() => pick(m, 'away', m.odds.away)} />
                  </div>

                  {/* More markets */}
                  <button
                    onClick={() => onMatchClick?.(m)}
                    className="w-5 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label="More markets"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

function TeamRow({ name, flag, score }: { name: string; flag?: string; score?: number }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {flag ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={flag} alt="" className="w-4 h-4 object-contain shrink-0" />
      ) : (
        <span className="w-4 h-4 rounded-full bg-secondary shrink-0" />
      )}
      <span className="text-sm text-foreground truncate flex-1">{name}</span>
      {score !== undefined && (
        <span className="text-sm font-bold tabular-nums text-foreground shrink-0 pr-1">{score}</span>
      )}
    </div>
  )
}

function Odd({
  label,
  value,
  locked,
  selected,
  onClick,
}: {
  label: string
  value?: number
  locked?: boolean
  selected?: boolean
  onClick?: () => void
}) {
  if (value === undefined || value === null) {
    return <span className="w-11 sm:w-14 h-9 rounded bg-secondary/40 flex items-center justify-center text-muted-foreground text-xs">–</span>
  }
  return (
    <button
      onClick={onClick}
      disabled={locked}
      className={`w-11 sm:w-14 h-9 rounded flex flex-col items-center justify-center leading-none transition-colors disabled:opacity-40 ${
        selected
          ? 'bg-accent text-accent-foreground'
          : 'bg-secondary text-foreground hover:bg-accent/80 hover:text-accent-foreground'
      }`}
    >
      <span className={`text-[9px] ${selected ? 'text-accent-foreground/80' : 'text-muted-foreground'}`}>{label}</span>
      <span className="text-sm font-bold tabular-nums">{value.toFixed(2)}</span>
    </button>
  )
}
