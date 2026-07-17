'use client'

import { useEffect, useState } from 'react'
import { Receipt, Trophy, X, ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { getUserId } from '@/lib/user-session'
import { formatMoneyWithCurrency } from '@/lib/format-money'
import type { PlacedBet } from '@/lib/domain-types'

type Filter = 'all' | 'pending' | 'won' | 'lost'

export function MyBetsPage() {
  const [bets, setBets] = useState<PlacedBet[] | null>(null)
  const [loggedOut, setLoggedOut] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState<PlacedBet | null>(null)

  useEffect(() => {
    const uid = getUserId()
    if (!uid) { setLoggedOut(true); return }
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/bets?userId=${uid}`, { cache: 'no-store' })
        const data = await res.json()
        if (!cancelled) setBets((data.bets ?? []) as PlacedBet[])
      } catch {
        if (!cancelled) setBets([])
      }
    }
    void load()
    const t = setInterval(load, 20_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  if (loggedOut) {
    return (
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-md mx-auto text-center mt-16">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-4">
            <Receipt className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Sign in to view your bets</h1>
          <p className="text-muted-foreground mb-6">Your bet history is private to your account.</p>
          <a href="/login" className="inline-block bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity">
            Log in
          </a>
        </div>
      </main>
    )
  }

  const all = bets ?? []
  const counts: Record<Filter, number> = {
    all: all.length,
    pending: all.filter((b) => b.status === 'pending').length,
    won: all.filter((b) => b.status === 'won').length,
    lost: all.filter((b) => b.status === 'lost').length,
  }
  const filtered = all.filter((b) => filter === 'all' || b.status === filter)

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 max-w-3xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 flex items-center gap-3">
          <Receipt className="w-7 h-7 text-accent" /> My Bets
        </h1>

        {/* Filter chips */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(['all', 'pending', 'won', 'lost'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap capitalize transition-colors ${
                filter === f ? 'bg-accent text-accent-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'pending' ? 'Open' : f} ({counts[f]})
            </button>
          ))}
        </div>

        {bets === null ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center">
            <Receipt className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="font-semibold text-foreground">No bets to show</p>
            <p className="text-sm text-muted-foreground mt-1">
              {filter === 'all' ? 'Place a bet from the home page to see it here.' : `No ${filter === 'pending' ? 'open' : filter} bets yet.`}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((b) => <BetCard key={b.id} bet={b} onOpen={() => setOpen(b)} />)}
          </ul>
        )}
      </div>

      {open && <BetTicket bet={open} onClose={() => setOpen(null)} />}
    </main>
  )
}

function statusMeta(bet: PlacedBet) {
  const isWon = bet.status === 'won'
  const isLost = bet.status === 'lost'
  const isPending = bet.status === 'pending'
  const toReturn = isWon ? (bet.payout ?? bet.potentialWin) : isPending ? bet.potentialWin : 0
  return { isWon, isLost, isPending, toReturn }
}

function BetCard({ bet, onOpen }: { bet: PlacedBet; onOpen: () => void }) {
  const { isWon, isLost, isPending, toReturn } = statusMeta(bet)
  const kind = bet.selections.length > 1 ? `Multiple (${bet.selections.length})` : 'Single'

  return (
    <li className={`rounded-2xl overflow-hidden border bg-card shadow-card ${isWon ? 'border-success/50' : 'border-border'}`}>
      {/* Status strip for won bets — the "winning" banner */}
      {isWon && (
        <div className="flex items-center gap-2 px-4 py-2 bg-success/15 text-success">
          <Trophy className="w-4 h-4" />
          <span className="font-bold text-sm">Winner!</span>
          <span className="ml-auto font-extrabold tabular-nums">+{formatMoneyWithCurrency(toReturn, bet.currency)}</span>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="font-bold text-sm truncate">
            <span className={isLost ? 'text-muted-foreground' : 'text-foreground'}>{kind}</span>
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
              isWon ? 'bg-success/15 text-success'
              : isLost ? 'bg-destructive/15 text-destructive'
              : 'bg-accent/15 text-accent'
            }`}>
              {isPending ? 'Open' : bet.status}
            </span>
            <button onClick={onOpen} className="flex items-center gap-0.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
              View <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Selections (first 3) */}
        <div className="space-y-2">
          {bet.selections.slice(0, 3).map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  s.status === 'won' ? 'bg-success' : s.status === 'lost' ? 'bg-destructive' : 'bg-accent'
                }`} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{s.outcomeLabel}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{s.match.homeTeam} v {s.match.awayTeam}</p>
                </div>
              </div>
              <span className="text-sm font-bold text-foreground tabular-nums shrink-0">{s.odds.toFixed(2)}</span>
            </div>
          ))}
          {bet.selections.length > 3 && (
            <p className="text-[11px] text-muted-foreground pl-4">+{bet.selections.length - 3} more</p>
          )}
        </div>

        {/* Stake / To Return */}
        <div className="mt-3 pt-3 border-t border-border/60 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Stake</p>
            <p className="text-sm font-bold tabular-nums">{formatMoneyWithCurrency(bet.stake, bet.currency)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              {isLost ? 'Returned' : isWon ? 'Won' : 'To Return'}
            </p>
            <p className={`text-sm font-extrabold tabular-nums ${isWon ? 'text-success' : isLost ? 'text-muted-foreground' : 'text-foreground'}`}>
              {formatMoneyWithCurrency(toReturn, bet.currency)}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="font-mono tracking-wider text-accent">{bet.code}</span>
          <span className="tabular-nums">
            {new Date(bet.placedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </li>
  )
}

function BetTicket({ bet, onClose }: { bet: PlacedBet; onClose: () => void }) {
  const { isWon, isLost, isPending, toReturn } = statusMeta(bet)
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-card border border-border w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-accent" />
            <span className="font-bold text-foreground">Bet ticket</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono tracking-wider text-accent text-sm">{bet.code}</span>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
              isWon ? 'bg-success/15 text-success' : isLost ? 'bg-destructive/15 text-destructive' : 'bg-accent/15 text-accent'
            }`}>
              {isWon && <Trophy className="w-3 h-3 inline mr-0.5 -mt-0.5" />}
              {isPending ? 'Open' : bet.status}
            </span>
          </div>

          <ul className="divide-y divide-border">
            {bet.selections.map((s) => (
              <li key={s.id} className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-foreground text-sm">{s.outcomeLabel}</p>
                  <span className="text-sm font-bold tabular-nums text-foreground">{s.odds.toFixed(2)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{s.match.homeTeam} v {s.match.awayTeam}</p>
                <p className="text-[11px] text-muted-foreground uppercase">{s.marketLabel}{s.match.league ? ` · ${s.match.league}` : ''}</p>
              </li>
            ))}
          </ul>

          <div className="mt-3 pt-3 border-t border-border space-y-1.5 text-sm">
            <Row label="Total odds" value={bet.totalOdds.toFixed(2)} />
            <Row label="Stake" value={formatMoneyWithCurrency(bet.stake, bet.currency)} />
            <Row label={isWon ? 'Won' : 'Potential win'} value={formatMoneyWithCurrency(toReturn, bet.currency)} strong tone={isWon ? 'success' : undefined} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'success' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${strong ? 'font-extrabold' : 'font-semibold'} ${tone === 'success' ? 'text-success' : 'text-foreground'}`}>{value}</span>
    </div>
  )
}
