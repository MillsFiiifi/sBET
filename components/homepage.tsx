'use client'

import { useEffect, useState } from 'react'
import { MatchList } from './match-list'
import { PromoBanner } from './promo-banner'
import { FeaturedMatches } from './featured-matches'
import { SPORT_ICONS } from '@/components/sport-icons'
import { Skeleton } from '@/components/ui/skeleton'
import { getFavorites } from '@/lib/favorites'
import type { UiMatch } from '@/lib/ui-match'
import { TrendingUp, Calendar, Radio, Ticket, X, Copy, Check, Star } from 'lucide-react'

interface HomepageProps {
  onMatchClick?: (match: UiMatch) => void
}

type MatchFilter = 'all' | 'live' | 'upcoming'

export function Homepage({ onMatchClick }: HomepageProps) {
  const [matches, setMatches] = useState<UiMatch[] | null>(null)
  const [filter, setFilter] = useState<MatchFilter>('all')

  // ── Booking code ──
  const [bookingOpen, setBookingOpen] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [loadedCode, setLoadedCode] = useState<string | null>(null)
  const [loadedMatches, setLoadedMatches] = useState<UiMatch[] | null>(null)
  const [bookingBusy, setBookingBusy] = useState(false)
  const [bookingMsg, setBookingMsg] = useState<string | null>(null)
  const [createdCode, setCreatedCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const loadBooking = async (raw?: string) => {
    const code = (raw ?? codeInput).trim().toUpperCase()
    if (!code) return
    setBookingBusy(true)
    setBookingMsg(null)
    setCreatedCode(null)
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(code)}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) { setBookingMsg(data.error ?? 'Could not load that code'); return }
      if (!data.matches || data.matches.length === 0) {
        setBookingMsg('That booking has no available games right now.')
        return
      }
      setLoadedCode(data.code)
      setLoadedMatches(data.matches)
      setCodeInput('')
    } catch {
      setBookingMsg('Network error — please try again.')
    } finally {
      setBookingBusy(false)
    }
  }

  const bookFavorites = async () => {
    const ids = getFavorites()
    if (ids.length === 0) { setBookingMsg('Star some matches first, then create a booking code.'); return }
    setBookingBusy(true)
    setBookingMsg(null)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchIds: ids }),
      })
      const data = await res.json()
      if (!res.ok) { setBookingMsg(data.error ?? 'Could not create a booking'); return }
      setCreatedCode(data.code)
      setBookingMsg(null)
    } catch {
      setBookingMsg('Network error — please try again.')
    } finally {
      setBookingBusy(false)
    }
  }

  const copyCode = async () => {
    if (!createdCode) return
    try {
      await navigator.clipboard.writeText(createdCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked */ }
  }

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

  const live = (matches ?? []).filter((m) => m.state === 'LIVE')
  const upcoming = (matches ?? []).filter((m) => m.state === 'UPCOMING')
  const featured = [...live, ...upcoming].slice(0, 8)

  const sportCounts = new Map<string, number>()
  for (const m of matches ?? []) sportCounts.set(m.sport, (sportCounts.get(m.sport) ?? 0) + 1)
  const sportsWithMatches = Array.from(sportCounts.entries()).sort((a, b) => b[1] - a[1])

  const SEGMENTS: { key: MatchFilter; label: string; count: number; live?: boolean }[] = [
    { key: 'all', label: 'All', count: (matches ?? []).length },
    { key: 'live', label: 'Live', count: live.length, live: true },
    { key: 'upcoming', label: 'Upcoming', count: upcoming.length },
  ]

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-6 max-w-6xl mx-auto">
        {/* Hero */}
        <PromoBanner />

        {/* Action bar: segmented filter + booking chip */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex bg-card border border-border rounded-full p-1">
            {SEGMENTS.map((s) => {
              const active = filter === s.key
              return (
                <button
                  key={s.key}
                  onClick={() => setFilter(s.key)}
                  className={`inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                    active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s.live && <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-accent-foreground' : 'bg-destructive'} ${s.live ? 'animate-pulse' : ''}`} />}
                  {s.label}
                  <span className={`text-xs tabular-nums ${active ? 'text-accent-foreground/80' : 'text-muted-foreground/70'}`}>{s.count}</span>
                </button>
              )
            })}
          </div>

          <button
            onClick={() => setBookingOpen((o) => !o)}
            className={`ml-auto inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors border ${
              bookingOpen ? 'border-accent text-accent bg-accent/10' : 'border-border text-foreground hover:border-accent'
            }`}
          >
            <Ticket className="w-4 h-4 text-accent" /> Booking code
          </button>
        </div>

        {/* Booking panel */}
        {bookingOpen && (
          <section className="bg-card border border-border rounded-2xl p-4 shadow-card">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && loadBooking()}
                placeholder="Paste code e.g. K7P2QX"
                className="flex-1 bg-input border border-border rounded-lg px-4 py-2.5 text-base tracking-wider uppercase text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/40 placeholder:text-muted-foreground placeholder:normal-case placeholder:tracking-normal"
              />
              <button
                onClick={() => loadBooking()}
                disabled={bookingBusy}
                className="bg-accent text-accent-foreground font-bold px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {bookingBusy ? 'Loading…' : 'Load'}
              </button>
            </div>
            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2">
              <button onClick={bookFavorites} disabled={bookingBusy} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline disabled:opacity-60">
                Create a code from my <Star className="w-3 h-3 fill-current" /> favorites
              </button>
              {bookingMsg && <span className="text-xs text-destructive">{bookingMsg}</span>}
            </div>
            {createdCode && (
              <div className="mt-3 flex items-center justify-between gap-3 bg-secondary rounded-lg px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Your booking code — share it</p>
                  <p className="text-xl font-extrabold tracking-widest text-foreground">{createdCode}</p>
                </div>
                <button onClick={copyCode} className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-3 py-2 rounded-lg hover:opacity-90 transition-opacity shrink-0">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}
          </section>
        )}

        {/* Loaded booking */}
        {loadedMatches && loadedCode && (
          <section className="border border-accent/40 bg-accent/5 rounded-2xl p-4">
            <SectionHeading
              icon={<Ticket className="w-4 h-4" />}
              title={`Booking ${loadedCode}`}
              sub={`${loadedMatches.length} ${loadedMatches.length === 1 ? 'game' : 'games'}`}
              right={
                <button onClick={() => { setLoadedMatches(null); setLoadedCode(null) }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" aria-label="Clear booking">
                  <X className="w-4 h-4" />
                </button>
              }
            />
            <MatchList matches={loadedMatches} onMatchClick={onMatchClick} />
          </section>
        )}

        {/* Trending (own header inside) */}
        {filter === 'all' && <FeaturedMatches matches={featured} onMatchClick={onMatchClick} />}

        {/* Popular sports */}
        {sportsWithMatches.length > 0 && (
          <section>
            <SectionHeading icon={<TrendingUp className="w-4 h-4" />} title="Popular Sports" />
            <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {sportsWithMatches.map(([sport, count]) => {
                const Icon = SPORT_ICONS[sport]
                return (
                  <button
                    key={sport}
                    className="shrink-0 w-28 bg-card border border-border rounded-2xl p-4 flex flex-col items-center gap-2 hover:border-accent hover:-translate-y-0.5 transition-all"
                  >
                    <span className="w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center">
                      {Icon && <Icon className="w-6 h-6 text-accent" />}
                    </span>
                    <span className="text-sm font-semibold text-foreground capitalize truncate w-full text-center">{sport.replace('-', ' ')}</span>
                    <span className="text-xs text-muted-foreground">{count} {count === 1 ? 'match' : 'matches'}</span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* Loading */}
        {matches === null && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        )}

        {/* Empty */}
        {matches !== null && matches.length === 0 && (
          <div className="bg-card border border-dashed border-border rounded-2xl p-12 text-center">
            <TrendingUp className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No matches yet</h3>
            <p className="text-sm text-muted-foreground">
              An admin can add matches from the dashboard. They&apos;ll appear here in real time.
            </p>
          </div>
        )}

        {/* Live */}
        {filter !== 'upcoming' && live.length > 0 && (
          <section>
            <SectionHeading icon={<Radio className="w-4 h-4" />} title="Live Matches" tone="live" />
            <MatchList matches={live} onMatchClick={onMatchClick} />
          </section>
        )}

        {/* Upcoming */}
        {filter !== 'live' && upcoming.length > 0 && (
          <section>
            <SectionHeading icon={<Calendar className="w-4 h-4" />} title="Upcoming Matches" />
            <MatchList matches={upcoming} onMatchClick={onMatchClick} />
          </section>
        )}

        {/* Filter empty */}
        {matches !== null && matches.length > 0 &&
          ((filter === 'live' && live.length === 0) || (filter === 'upcoming' && upcoming.length === 0)) && (
            <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center">
              <p className="text-sm text-muted-foreground">
                No {filter} matches right now.{' '}
                <button onClick={() => setFilter('all')} className="text-accent font-medium hover:underline">Show all</button>
              </p>
            </div>
          )}
      </div>
    </div>
  )
}

function SectionHeading({
  icon,
  title,
  sub,
  right,
  tone,
}: {
  icon: React.ReactNode
  title: string
  sub?: string
  right?: React.ReactNode
  tone?: 'live'
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tone === 'live' ? 'bg-destructive/15 text-destructive' : 'bg-accent/15 text-accent'}`}>
          {icon}
        </span>
        <h2 className="text-lg font-bold text-foreground truncate flex items-center gap-1.5">
          {tone === 'live' && <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />}
          {title}
        </h2>
        {sub && <span className="text-sm text-muted-foreground shrink-0">{sub}</span>}
      </div>
      {right}
    </div>
  )
}
