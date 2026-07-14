'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Receipt, Trophy, ChevronRight, Zap, Loader2 } from 'lucide-react'
import { MobileNav } from '@/components/mobile-nav'
import { MeSubpageHeader } from '@/components/me-subpage-header'
import { Skeleton } from '@/components/ui/skeleton'
import { BetTicketDetails } from '@/components/bet-ticket-details'
import { getUserId, getUserName } from '@/lib/user-session'
import { formatMoney } from '@/lib/format-money'
import { computeCashout } from '@/lib/cashout'
import type { PlacedBet } from '@/lib/types'

type Filter = 'all' | 'pending' | 'won' | 'lost'

export default function BetHistoryPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [bets, setBets] = useState<PlacedBet[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [openBet, setOpenBet] = useState<PlacedBet | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [settlingId, setSettlingId] = useState<string | null>(null)
  const [cashingId, setCashingId] = useState<string | null>(null)
  // Ticks so the live cash-out value refreshes without a manual reload.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])

  const handleCashOut = async (id: string) => {
    setCashingId(id)
    setError(null)
    try {
      const res = await fetch(`/api/bets/${id}/cashout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: getUserId() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setBets((prev) => (prev ?? []).map((b) => (b.id === id ? (data.bet as PlacedBet) : b)))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCashingId(null)
    }
  }

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
    // Only admins get the settle (Won/Lost) controls on open bets.
    void fetch('/api/admin/me', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { admin: false }))
      .then((d) => !cancelled && setIsAdmin(d?.admin === true))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const handleSettle = async (id: string, status: 'won' | 'lost') => {
    setSettlingId(id)
    setError(null)
    try {
      const res = await fetch(`/api/bets/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setBets((prev) => (prev ?? []).map((b) => (b.id === id ? (data.bet as PlacedBet) : b)))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSettlingId(null)
    }
  }

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
              <BetRow
                key={b.id}
                bet={b}
                onOpen={() => setOpenBet(b)}
                isAdmin={isAdmin}
                settling={settlingId === b.id}
                onSettle={(status) => handleSettle(b.id, status)}
                cashoutValue={computeCashout(b, now)}
                cashingOut={cashingId === b.id}
                onCashOut={() => handleCashOut(b.id)}
              />
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

function BetRow({
  bet,
  onOpen,
  isAdmin = false,
  settling = false,
  onSettle,
  cashoutValue = 0,
  cashingOut = false,
  onCashOut,
}: {
  bet: PlacedBet
  onOpen: () => void
  isAdmin?: boolean
  settling?: boolean
  onSettle?: (status: 'won' | 'lost') => void
  cashoutValue?: number
  cashingOut?: boolean
  onCashOut?: () => void
}) {
  const isWon = bet.status === 'won'
  const isLost = bet.status === 'lost'
  const isPending = bet.status === 'pending'
  const kind = bet.selections.length > 1 ? `Multiple (${bet.selections.length})` : 'Single'
  const totalReturn = isWon ? (bet.payout ?? bet.potentialWin) : isPending ? bet.potentialWin : 0
  const stakeTone = isLost ? 'text-muted-foreground' : 'text-success'
  const statusLabel = isWon ? 'Won' : isLost ? 'Lost' : null

  return (
    <li className="rounded-2xl overflow-hidden border border-border bg-card shadow-card">
      <div className="p-3.5">
        {/* Header: stake + kind · view */}
        <div className="flex items-center justify-between gap-2">
          <p className="font-bold text-sm min-w-0 truncate">
            <span className={stakeTone}>
              {bet.currency} {formatMoney(bet.stake, bet.currency)}
            </span>{' '}
            <span className="text-foreground">{kind}</span>
          </p>
          <div className="flex items-center gap-2 shrink-0">
            {statusLabel && (
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  isWon ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
                }`}
              >
                {isWon && <Trophy className="w-3 h-3 inline mr-0.5 -mt-0.5" />}
                {statusLabel}
              </span>
            )}
            <button
              type="button"
              onClick={onOpen}
              className="flex items-center gap-0.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              View <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Selections */}
        <div className="mt-2.5 space-y-2">
          {bet.selections.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{s.outcomeLabel}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{s.marketLabel}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {s.match.homeTeam} vs {s.match.awayTeam}
                  </p>
                </div>
              </div>
              <span className="text-sm font-bold text-success tabular-nums shrink-0">
                {s.odds.toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Stake / To Return */}
        <div className="mt-3 pt-3 border-t border-border/60 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              Stake
            </p>
            <p className="text-sm font-bold tabular-nums">
              {bet.currency} {formatMoney(bet.stake, bet.currency)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              To Return
            </p>
            <p className={`text-sm font-extrabold tabular-nums ${isWon ? 'text-success' : 'text-foreground'}`}>
              {bet.currency} {formatMoney(totalReturn, bet.currency)}
            </p>
          </div>
        </div>

        {/* Cash Out — running bets only */}
        {isPending && onCashOut && cashoutValue > 0 && (
          <button
            type="button"
            onClick={onCashOut}
            disabled={cashingOut}
            className="mt-3 w-full h-12 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 text-black font-extrabold flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition-transform disabled:opacity-60"
          >
            {cashingOut ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Zap className="w-4 h-4" fill="currentColor" />
                Cash Out
                <span className="px-2 py-0.5 rounded-md bg-black/10 text-sm tabular-nums">
                  {bet.currency} {formatMoney(cashoutValue, bet.currency)}
                </span>
              </>
            )}
          </button>
        )}

        {/* Admin-only settle controls for open bets */}
        {isAdmin && isPending && onSettle && (
          <div className="mt-2.5 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold shrink-0">
              Settle
            </span>
            <button
              type="button"
              onClick={() => onSettle('won')}
              disabled={settling}
              className="flex-1 h-8 rounded-md bg-success/10 border border-success/40 text-success text-xs font-bold hover:bg-success/20 disabled:opacity-50"
            >
              {settling ? '…' : 'Won'}
            </button>
            <button
              type="button"
              onClick={() => onSettle('lost')}
              disabled={settling}
              className="flex-1 h-8 rounded-md bg-destructive/10 border border-destructive/40 text-destructive text-xs font-bold hover:bg-destructive/20 disabled:opacity-50"
            >
              {settling ? '…' : 'Lost'}
            </button>
          </div>
        )}

        {/* Booking code + date */}
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="font-mono tracking-wide">{bet.code}</span>
          <span className="tabular-nums">
            {new Date(bet.placedAt).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
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
