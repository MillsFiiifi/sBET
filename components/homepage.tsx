'use client'

import { useEffect, useState } from 'react'
import { MatchList } from './match-list'
import { SPORT_ICONS } from '@/components/sport-icons'
import { Skeleton } from '@/components/ui/skeleton'
import { getFavorites } from '@/lib/favorites'
import type { UiMatch } from '@/lib/ui-match'
import { TrendingUp, Calendar, Trophy, Radio, Ticket, X, Copy, Check } from 'lucide-react'

interface HomepageProps {
  onMatchClick?: (match: UiMatch) => void
}

export function Homepage({ onMatchClick }: HomepageProps) {
  const [matches, setMatches] = useState<UiMatch[] | null>(null)

  // ── Booking code (SportyBet-style) ──
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
      if (!res.ok) {
        setBookingMsg(data.error ?? 'Could not load that code')
        return
      }
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
    if (ids.length === 0) {
      setBookingMsg('Star some matches first, then create a booking code.')
      return
    }
    setBookingBusy(true)
    setBookingMsg(null)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchIds: ids }),
      })
      const data = await res.json()
      if (!res.ok) {
        setBookingMsg(data.error ?? 'Could not create a booking')
        return
      }
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
    } catch {
      /* clipboard blocked — user can copy manually */
    }
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
        {/* Booking code — compact chip that expands on press */}
        {!bookingOpen ? (
          <div className="flex justify-end">
            <button
              onClick={() => setBookingOpen(true)}
              className="inline-flex items-center gap-2 bg-card border border-border rounded-full px-4 py-2 text-sm font-semibold text-foreground hover:border-accent transition-colors"
            >
              <Ticket className="w-4 h-4 text-accent" /> Booking code
            </button>
          </div>
        ) : (
        <section className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-accent" />
              <h2 className="font-bold text-foreground">Load a booking code</h2>
            </div>
            <button
              onClick={() => setBookingOpen(false)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
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
            <button
              onClick={bookFavorites}
              disabled={bookingBusy}
              className="text-xs font-medium text-accent hover:underline disabled:opacity-60"
            >
              Create a code from my ★ favorites
            </button>
            {bookingMsg && <span className="text-xs text-destructive">{bookingMsg}</span>}
          </div>
          {createdCode && (
            <div className="mt-3 flex items-center justify-between gap-3 bg-secondary rounded-lg px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Your booking code — share it</p>
                <p className="text-xl font-extrabold tracking-widest text-foreground">{createdCode}</p>
              </div>
              <button
                onClick={copyCode}
                className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-3 py-2 rounded-lg hover:opacity-90 transition-opacity shrink-0"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}
        </section>
        )}

        {/* Loaded booking — the games from a pasted code */}
        {loadedMatches && loadedCode && (
          <section className="border border-accent/40 bg-accent/5 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-foreground flex items-center gap-2">
                <Ticket className="w-5 h-5 text-accent" />
                Booking {loadedCode}
                <span className="text-sm font-normal text-muted-foreground">
                  ({loadedMatches.length} {loadedMatches.length === 1 ? 'game' : 'games'})
                </span>
              </h2>
              <button
                onClick={() => { setLoadedMatches(null); setLoadedCode(null) }}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                aria-label="Clear booking"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <MatchList matches={loadedMatches} onMatchClick={onMatchClick} />
          </section>
        )}

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
            <h2 className="text-xl font-bold text-foreground mb-4">Popular Sports</h2>
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
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" /> Live Matches
            </h2>
            <MatchList matches={live} onMatchClick={onMatchClick} />
          </section>
        )}

        {/* Upcoming Matches */}
        {upcoming.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-foreground mb-4">Upcoming Matches</h2>
            <MatchList matches={upcoming} onMatchClick={onMatchClick} />
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
