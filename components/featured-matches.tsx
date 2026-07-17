'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react'
import { BETSLIP_EVENT, getSelections, toggleSelection } from '@/lib/betslip'
import type { UiMatch } from '@/lib/ui-match'

interface FeaturedMatchesProps {
  matches: UiMatch[]
  onMatchClick?: (match: UiMatch) => void
}

const OUTCOME_LABEL: Record<string, string> = { home: 'Home', draw: 'Draw', away: 'Away' }

/** Horizontal, snap-scrolling carousel of highlighted matches — the clean
 *  "trending" strip at the top of the home feed. Odds tap straight into the
 *  bet slip. */
export function FeaturedMatches({ matches, onMatchClick }: FeaturedMatchesProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const [picks, setPicks] = useState<Set<string>>(new Set())

  useEffect(() => {
    const sync = () => setPicks(new Set(getSelections().map((s) => `${s.matchId}:${s.outcomeKey}`)))
    sync()
    window.addEventListener(BETSLIP_EVENT, sync)
    return () => window.removeEventListener(BETSLIP_EVENT, sync)
  }, [])

  if (matches.length === 0) return null

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

  const scroll = (dir: number) => scroller.current?.scrollBy({ left: dir * 300, behavior: 'smooth' })

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Flame className="w-5 h-5 text-accent" /> Trending
        </h2>
        <div className="hidden sm:flex gap-1">
          <button onClick={() => scroll(-1)} className="p-1.5 rounded-lg border border-border text-muted-foreground hover:border-accent hover:text-foreground transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => scroll(1)} className="p-1.5 rounded-lg border border-border text-muted-foreground hover:border-accent hover:text-foreground transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={scroller}
        className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {matches.map((m) => {
          const showScore = m.state === 'LIVE' || m.hasScore
          return (
            <div
              key={m.id}
              className="snap-start shrink-0 w-64 sm:w-72 rounded-2xl border border-border bg-gradient-to-br from-secondary/60 to-card overflow-hidden"
            >
              <button onClick={() => onMatchClick?.(m)} className="w-full text-left p-4 pb-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground truncate">
                    {m.league}
                  </span>
                  {m.state === 'LIVE' ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-destructive shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" /> {m.time}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground shrink-0">{m.time}</span>
                  )}
                </div>
                <div className="space-y-2">
                  <FeatTeam name={m.homeTeam} flag={m.homeFlagUrl} score={showScore ? m.homeScore : undefined} />
                  <FeatTeam name={m.awayTeam} flag={m.awayFlagUrl} score={showScore ? m.awayScore : undefined} />
                </div>
              </button>
              <div className="grid grid-cols-3 gap-1.5 px-3 pb-3">
                <FeatOdd label="1" value={m.odds.home} selected={picks.has(`${m.id}:home`)} locked={m.locked} onClick={() => pick(m, 'home', m.odds.home)} />
                <FeatOdd label="X" value={m.odds.draw} selected={picks.has(`${m.id}:draw`)} locked={m.locked} onClick={() => m.odds.draw && pick(m, 'draw', m.odds.draw)} />
                <FeatOdd label="2" value={m.odds.away} selected={picks.has(`${m.id}:away`)} locked={m.locked} onClick={() => pick(m, 'away', m.odds.away)} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function FeatTeam({ name, flag, score }: { name: string; flag?: string; score?: number }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {flag ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={flag} alt="" className="w-5 h-5 object-contain shrink-0" />
      ) : (
        <span className="w-5 h-5 rounded-full bg-secondary shrink-0" />
      )}
      <span className="text-sm font-medium text-foreground truncate flex-1">{name}</span>
      {score !== undefined && <span className="text-sm font-bold tabular-nums text-foreground shrink-0">{score}</span>}
    </div>
  )
}

function FeatOdd({
  label,
  value,
  selected,
  locked,
  onClick,
}: {
  label: string
  value?: number
  selected?: boolean
  locked?: boolean
  onClick?: () => void
}) {
  if (value === undefined || value === null) {
    return <span className="h-11 rounded-lg bg-secondary/40 flex items-center justify-center text-muted-foreground text-xs">–</span>
  }
  return (
    <button
      onClick={onClick}
      disabled={locked}
      className={`h-11 rounded-lg flex flex-col items-center justify-center leading-none transition-colors disabled:opacity-40 ${
        selected ? 'bg-accent text-accent-foreground' : 'bg-secondary text-foreground hover:bg-accent/80 hover:text-accent-foreground'
      }`}
    >
      <span className={`text-[9px] ${selected ? 'text-accent-foreground/80' : 'text-muted-foreground'}`}>{label}</span>
      <span className="text-sm font-bold tabular-nums">{value.toFixed(2)}</span>
    </button>
  )
}
