'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Receipt, Trophy, ChevronRight } from 'lucide-react'
import { MobileNav } from '@/components/mobile-nav'
import { MeSubpageHeader } from '@/components/me-subpage-header'
import { Skeleton } from '@/components/ui/skeleton'
import { BetTicketDetails } from '@/components/bet-ticket-details'
import { getUserId, getUserName } from '@/lib/user-session'
import { formatMoney } from '@/lib/format-money'
import type { PlacedBet } from '@/lib/types'

type Filter = 'all' | 'pending' | 'won' | 'lost'

export default function BetHistoryPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [bets, setBets] = useState<PlacedBet[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [openBet, setOpenBet] = useState<PlacedBet | null>(null)

  useEffect(() => {
    const uid = getUserId()
    setUserId(uid)
    if (!uid) {
      setBets([])
      return
    }
    let cancelled = false
    void fetch(`/api/bets?userId=${uid}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(`HTTP ${res.status}`)))
      .then((data) => {
        if (cancelled) return
        setBets((data.bets ?? []) as PlacedBet[])
      })
      .catch((e) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [])

  if (!userId) {
    return (
      <div className="min-h-screen bg-background flex flex-col pb-20 max-w-lg mx-auto w-full">
        <MeSubpageHeader title="Bet History" />
        <SignInGate />
        <MobileNav selectedBets={[]} activeTab="bets" />
      </div>
    )
  }

  const filtered = (bets ?? []).filter((b) => filter === 'all' || b.status === filter)
  const counts = {
    all: bets?.length ?? 0,
    pending: (bets ?? []).filter((b) => b.status === 'pending').length,
    won: (bets ?? []).filter((b) => b.status === 'won').length,
    lost: (bets ?? []).filter((b) => b.status === 'lost').length,
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20 max-w-lg mx-auto w-full">
      <MeSubpageHeader title="Bet History" />

      <div className="px-3 sm:px-4 pt-4 flex gap-1.5 overflow-x-auto scrollbar-hide">
        {(['all', 'pending', 'won', 'lost'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap capitalize transition-all ${
              filter === f
                ? 'bg-primary text-primary-foreground shadow-card'
                : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/70'
            }`}
          >
            {f} ({counts[f]})
          </button>
        ))}
      </div>

      <main className="flex-1 px-3 sm:px-4 pt-3">
        {error ? (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive font-medium shadow-card">
            {error}
          </div>
        ) : bets === null ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-xl p-8 text-center">
            <Receipt className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="font-semibold text-sm text-foreground">No bets to show</p>
            <p className="text-xs text-muted-foreground mt-1">
              {filter === 'all'
                ? 'Place a bet from the home page to see it here.'
                : `No ${filter} bets yet.`}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((b) => (
              <BetRow key={b.id} bet={b} onOpen={() => setOpenBet(b)} />
            ))}
          </ul>
        )}
      </main>

      <MobileNav selectedBets={[]} activeTab="bets" />

      {openBet && (
        <BetTicketDetails
          bet={openBet}
          open={!!openBet}
          onClose={() => setOpenBet(null)}
          userName={getUserName() ?? undefined}
        />
      )}
    </div>
  )
}

function BetRow({ bet, onOpen }: { bet: PlacedBet; onOpen: () => void }) {
  const isWon = bet.status === 'won'
  const isLost = bet.status === 'lost'
  const isPending = bet.status === 'pending'
  const kind = bet.selections.length > 1 ? 'Multiple' : 'Singles'
  const totalReturn = isWon ? (bet.payout ?? bet.potentialWin) : isPending ? bet.potentialWin : 0
  const firstMatch = bet.selections[0]
    ? `${bet.selections[0].match.homeTeam} v ${bet.selections[0].match.awayTeam}`
    : 'Bet'
  const more = bet.selections.length > 1 ? ` +${bet.selections.length - 1} more` : ''

  // Status header bar colour — green won / grey lost / dark open.
  const headerCls = isWon
    ? 'bg-success text-white'
    : isLost
      ? 'bg-zinc-500 text-white'
      : 'bg-zinc-800 text-white'
  const statusLabel = isWon ? 'Won' : isLost ? 'Lost' : 'Open'
  const returnTone = isWon ? 'text-success' : isLost ? 'text-muted-foreground' : 'text-foreground'

  return (
    <li className="rounded-xl overflow-hidden border border-border bg-card shadow-card lift-on-hover">
      {/* Status header bar */}
      <button
        type="button"
        onClick={onOpen}
        className={`w-full flex items-center justify-between px-3 py-2 font-bold text-sm ${headerCls}`}
      >
        <span>{kind}</span>
        <span className="flex items-center gap-1">
          {isWon && <Trophy className="w-4 h-4" />}
          {statusLabel}
          <ChevronRight className="w-4 h-4" />
        </span>
      </button>

      {/* Stake + return */}
      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between text-sm py-0.5">
          <span className="text-muted-foreground">Total Stake ({bet.currency})</span>
          <span className="font-semibold tabular-nums">{formatMoney(bet.stake, bet.currency)}</span>
        </div>
        <div className="flex items-center justify-between text-sm py-0.5">
          <span className="text-muted-foreground">Total Return</span>
          <span className={`text-base font-extrabold tabular-nums ${returnTone}`}>
            {formatMoney(totalReturn, bet.currency)}
          </span>
        </div>

        {/* Match summary + action */}
        <div className="mt-2 pt-2 border-t border-border/60 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground truncate min-w-0">{firstMatch}{more}</p>
          <button
            type="button"
            onClick={onOpen}
            className="shrink-0 h-8 px-3 rounded-md bg-success text-white text-xs font-bold hover:bg-success/90 transition-colors cursor-pointer"
          >
            View Bet
          </button>
        </div>
      </div>
    </li>
  )
}

function SignInGate() {
  return (
    <main className="flex-1 px-6 pt-12 pb-16 text-center max-w-sm mx-auto w-full">
      <div className="relative w-20 h-20 mx-auto mb-5">
        <div aria-hidden className="absolute inset-0 rounded-full bg-primary/15 blur-xl" />
        <div className="relative w-20 h-20 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center shadow-card">
          <Receipt className="w-9 h-9 text-primary" />
        </div>
      </div>
      <h2 className="text-title font-bold mb-1.5">Sign in to view your bets</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Your bet history is private to your account.
      </p>
      <div className="flex gap-3">
        <Link href="/login" className="flex-1 h-12 inline-flex items-center justify-center rounded-xl border-2 border-primary text-primary font-bold hover:bg-primary/10 transition-colors">Login</Link>
        <Link href="/register" className="flex-1 h-12 inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all shadow-card hover:shadow-card-hover hover:-translate-y-0.5">Register</Link>
      </div>
    </main>
  )
}
