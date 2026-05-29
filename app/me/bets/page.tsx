'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Receipt, Trophy, XCircle, CircleDot, Eye } from 'lucide-react'
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
        <MobileNav selectedBets={[]} activeTab="me" />
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

      <MobileNav selectedBets={[]} activeTab="me" />

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
  const totalReturn = isWon ? (bet.payout ?? bet.potentialWin) : 0
  const firstMatch = bet.selections[0]
    ? `${bet.selections[0].match.homeTeam} vs ${bet.selections[0].match.awayTeam}`
    : 'Bet'
  const more = bet.selections.length > 1 ? ` (+${bet.selections.length - 1} more)` : ''

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left bg-card border border-border rounded-xl p-3 flex items-center gap-3 shadow-card lift-on-hover"
      >
        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
          {isWon ? (
            <Trophy className="w-4 h-4 text-success" />
          ) : isLost ? (
            <XCircle className="w-4 h-4 text-destructive" />
          ) : (
            <CircleDot className="w-4 h-4 text-amber-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{firstMatch}{more}</p>
          <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5">
            <span className="font-mono opacity-80">{bet.code}</span>
            <span className="opacity-40">·</span>
            <span>{new Date(bet.placedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            <span className="opacity-40">·</span>
            <span className={`px-1.5 py-0.5 rounded-full border text-[9px] uppercase font-bold ${
              isWon ? 'bg-success/15 text-success border-success/30' :
              isLost ? 'bg-destructive/15 text-destructive border-destructive/30' :
              'bg-amber-500/15 text-amber-500 border-amber-500/30'
            }`}>
              {bet.status}
            </span>
          </p>
        </div>
        <div className="text-right shrink-0">
          {isWon ? (
            <p className="text-sm font-extrabold tabular-nums text-success">
              +{bet.currency} {formatMoney(totalReturn, bet.currency)}
            </p>
          ) : (
            <p className="text-sm font-bold tabular-nums">
              {bet.currency} {formatMoney(bet.stake, bet.currency)}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground tabular-nums">@ {bet.totalOdds.toFixed(2)}</p>
        </div>
        <Eye className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      </button>
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
