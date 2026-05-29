'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Lock, Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { BetSlip } from '@/components/bet-slip'
import { MobileNav } from '@/components/mobile-nav'
import { MarketsPanel } from '@/components/markets-panel'
import { TeamCrest } from '@/components/team-crest'
import { getBettingState } from '@/lib/match-betting'
import {
  make1X2Selection,
  removeSelectionById,
  toggleSelection,
  isSelected,
  MARKET_1X2,
} from '@/lib/bet-slip-utils'
import type { BetSelection, Match } from '@/lib/types'

export default function MatchDetailPage() {
  const params = useParams<{ id: string }>()
  const matchId = params?.id ?? ''
  const [selections, setSelections] = useState<BetSelection[]>([])
  const [match, setMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Single-match lookup. The previous version pulled all football matches
  // and filtered by id — but the URL is hit from every sport, so anything
  // non-football was reported "Match not found." /api/matches/[id] tries
  // each sport on the server so the page resolves for any feed.
  useEffect(() => {
    if (!matchId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetch(`/api/matches/${matchId}`, { cache: 'no-store' })
      .then(async (res) => {
        if (res.status === 404) {
          if (!cancelled) {
            setMatch(null)
            setError('not-found')
          }
          return
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as { match: Match }
        if (!cancelled) setMatch(data.match ?? null)
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [matchId])

  const handleToggle = (sel: BetSelection) =>
    setSelections((prev) => toggleSelection(prev, sel))

  const handleRemove = (id: string) =>
    setSelections((prev) => removeSelectionById(prev, id))

  const handleClear = () => setSelections([])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 space-y-4">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center bg-card border border-dashed border-border rounded-xl p-8 max-w-sm shadow-card">
          <p className="font-semibold text-sm">
            {error === 'not-found'
              ? 'Match not found.'
              : 'Could not load this match.'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            It may have finished, been removed by an admin, or never existed.
          </p>
          <Link
            href="/football"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to football
          </Link>
        </div>
      </div>
    )
  }

  const betting = getBettingState(match)
  const closed = betting.closed
  const isHalftime = match.isLive && match.minute === 'HT'

  return (
    <div className="min-h-screen bg-background pb-20 xl:pb-0">
      <header className="sticky top-0 z-50 bg-card border-b border-border shadow-card">
        <div className="max-w-[1400px] mx-auto px-4">
          <div className="flex items-center h-14 gap-4">
            <Link
              href="/football"
              className="p-2 -ml-2 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-base sm:text-lg font-bold text-foreground truncate tracking-tight">
              {match.homeTeam} vs {match.awayTeam}
            </h1>
            <div className="ml-auto flex items-center gap-2">
              <Link href="/login">
                <Button variant="outline" size="sm" className="hidden sm:flex">
                  Login
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="hidden sm:flex bg-primary text-primary-foreground shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
                  Register
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 py-4">
        <div className="flex gap-6">
          <main className="flex-1 min-w-0 space-y-4">
            {/* Match header */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-card">
              <div className="flex items-center justify-between mb-3 text-xs">
                <span className="text-eyebrow text-muted-foreground">
                  {match.league}
                  {match.country ? ` · ${match.country}` : ''}
                </span>
                {match.isLive ? (
                  isHalftime ? (
                    <span className="font-bold uppercase tracking-wide text-amber-500 text-[10px] px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10">
                      HALFTIME
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 font-bold text-live text-[10px] px-1.5 py-0.5 rounded-full border border-live/30 bg-live/10 animate-live-glow">
                      <Radio className="w-2.5 h-2.5" />
                      LIVE {match.minute}
                    </span>
                  )
                ) : (
                  <span className="text-muted-foreground font-medium tabular-nums">{match.startTime}</span>
                )}
              </div>

              <div className="flex items-center justify-between gap-4 py-2">
                <TeamBadge name={match.homeTeam} flagUrl={match.homeFlagUrl} />
                <div className="text-center">
                  {match.isLive ? (
                    <p className="text-3xl sm:text-4xl font-black tabular-nums tracking-tight">
                      {match.homeScore ?? 0}
                      <span className="text-muted-foreground mx-2">:</span>
                      {match.awayScore ?? 0}
                    </p>
                  ) : (
                    <p className="text-2xl font-bold text-muted-foreground">vs</p>
                  )}
                </div>
                <TeamBadge name={match.awayTeam} flagUrl={match.awayFlagUrl} align="right" />
              </div>

              {closed && (
                <div className="mt-3 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-1.5 font-medium">
                  <Lock className="w-3 h-3" />
                  Betting closed —{' '}
                  {betting.reason === 'finished'
                    ? 'match finished.'
                    : betting.reason === 'starting-soon'
                      ? `kick-off in ${betting.minutesRemaining ?? 0} min.`
                      : betting.reason === 'admin-locked'
                        ? 'locked by admin.'
                        : 'match has started.'}
                </div>
              )}
            </div>

            {/* 1X2 — Match Result */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-card">
              <h2 className="text-eyebrow text-muted-foreground mb-3">Match Result</h2>
              <div className="grid grid-cols-3 gap-2">
                {(['home', 'draw', 'away'] as const).map((k) => {
                  const odds = match.odds[k]
                  const label = k === 'home' ? '1' : k === 'draw' ? 'X' : '2'
                  const teamLabel =
                    k === 'home' ? match.homeTeam : k === 'away' ? match.awayTeam : 'Draw'
                  const selected = isSelected(selections, match.id, MARKET_1X2, k)
                  const disabled = closed || odds <= 0
                  return (
                    <button
                      key={k}
                      onClick={() => handleToggle(make1X2Selection(match, k))}
                      disabled={disabled}
                      aria-pressed={selected}
                      className={`flex flex-col items-center py-3 rounded-lg font-semibold transition-all duration-150 ${
                        disabled
                          ? 'bg-secondary/40 text-muted-foreground cursor-not-allowed opacity-60'
                          : selected
                            ? 'bg-primary text-primary-foreground shadow-card-pressed scale-[0.98]'
                            : 'bg-secondary text-foreground hover:bg-secondary/70 hover:-translate-y-0.5 hover:shadow-card active:scale-95'
                      }`}
                    >
                      <span className={`text-[10px] uppercase tracking-wider font-bold mb-0.5 ${selected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                        {label} · {teamLabel}
                      </span>
                      <span className="text-base font-extrabold tabular-nums leading-none">{odds.toFixed(2)}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* All other markets */}
            <MarketsPanel
              match={match}
              selections={selections}
              onToggle={handleToggle}
              closed={closed}
            />
          </main>

          <aside className="hidden lg:block w-80 shrink-0">
            <div className="sticky top-20">
              <BetSlip
                selections={selections}
                onRemoveSelection={handleRemove}
                onClearAll={handleClear}
                onLoadSelections={setSelections}
              />
            </div>
          </aside>
        </div>
      </div>

      <MobileNav
        selectedBets={selections}
        onRemoveSelection={handleRemove}
        onClearAll={handleClear}
        onLoadSelections={setSelections}
      />
    </div>
  )
}

function TeamBadge({
  name,
  flagUrl,
  align,
}: {
  name: string
  flagUrl?: string
  align?: 'right'
}) {
  return (
    <div className={`flex-1 flex flex-col items-center gap-2 min-w-0 ${align === 'right' ? '' : ''}`}>
      <TeamCrest name={name} url={flagUrl} size={56} />
      <span className="font-bold text-sm text-center truncate w-full">
        {name}
      </span>
    </div>
  )
}
