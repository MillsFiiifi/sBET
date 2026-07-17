'use client'

import { useEffect, useState } from 'react'
import { Receipt, X, Trash2, Check } from 'lucide-react'
import {
  BETSLIP_EVENT,
  BALANCE_EVENT,
  clearSlip,
  getSelections,
  removeSelection,
  type Selection,
} from '@/lib/betslip'
import { getUserId } from '@/lib/user-session'

export function BetSlip() {
  const [sels, setSels] = useState<Selection[]>([])
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'single' | 'multiple'>('multiple')
  const [multiStake, setMultiStake] = useState('10')
  const [singleStakes, setSingleStakes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [done, setDone] = useState<string[] | null>(null)

  useEffect(() => {
    const sync = () => setSels(getSelections())
    sync()
    window.addEventListener(BETSLIP_EVENT, sync)
    return () => window.removeEventListener(BETSLIP_EVENT, sync)
  }, [])

  // Auto-open the sheet when the first pick is added.
  useEffect(() => {
    if (sels.length > 0) setDone(null)
  }, [sels.length])

  if (sels.length === 0 && !done) return null

  const totalOdds = sels.reduce((p, s) => p * s.odds, 1)
  const stakeNum = parseFloat(multiStake) || 0
  const potWin = +(stakeNum * totalOdds).toFixed(2)

  const singleTotal = sels.reduce((sum, s) => sum + (parseFloat(singleStakes[s.key] || '0') || 0), 0)

  const placeBet = async () => {
    const userId = getUserId()
    if (!userId) {
      setMsg('Please log in to place a bet.')
      return
    }
    let bets: { stake: number; selections: unknown[] }[]
    if (tab === 'multiple') {
      if (stakeNum <= 0) { setMsg('Enter a stake.'); return }
      bets = [{ stake: stakeNum, selections: sels }]
    } else {
      bets = sels
        .map((s) => ({ stake: parseFloat(singleStakes[s.key] || '0') || 0, selections: [s] }))
        .filter((b) => b.stake > 0)
      if (bets.length === 0) { setMsg('Enter a stake on at least one selection.'); return }
    }
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, bets }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg(data.error ?? 'Could not place bet'); return }
      setDone((data.bets ?? []).map((b: { code: string }) => b.code))
      clearSlip()
      setMultiStake('10')
      setSingleStakes({})
      window.dispatchEvent(new Event(BALANCE_EVENT))
    } catch {
      setMsg('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {/* Floating trigger — above the mobile bottom nav */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-20 lg:bottom-6 z-40 inline-flex items-center gap-2 bg-accent text-accent-foreground font-bold px-4 py-3 rounded-full shadow-popover"
        >
          <Receipt className="w-5 h-5" />
          Bet slip
          <span className="min-w-6 h-6 px-1.5 rounded-full bg-accent-foreground/20 text-sm flex items-center justify-center">
            {sels.length}
          </span>
        </button>
      )}

      {/* Sheet */}
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setOpen(false)} />
          <div className="fixed z-50 bottom-0 inset-x-0 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96 bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-popover max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-accent" />
                <span className="font-bold text-foreground">Bet slip</span>
                <span className="text-sm text-muted-foreground">({sels.length})</span>
              </div>
              <div className="flex items-center gap-3">
                {sels.length > 0 && (
                  <button onClick={() => clearSlip()} className="text-xs font-medium text-destructive hover:underline">
                    Remove all
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Success state */}
            {done && (
              <div className="p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-success/15 text-success flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <p className="font-semibold text-foreground">Bet placed!</p>
                <p className="text-sm text-muted-foreground">
                  {done.length > 1 ? `${done.length} tickets` : 'Ticket'} code{done.length > 1 ? 's' : ''}:{' '}
                  <span className="font-mono font-bold text-foreground tracking-wider">{done.join(', ')}</span>
                </p>
                <button
                  onClick={() => { setDone(null); setOpen(false) }}
                  className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity"
                >
                  Done
                </button>
              </div>
            )}

            {!done && (
              <>
                {/* Tabs */}
                <div className="grid grid-cols-2 gap-1 p-2">
                  {(['single', 'multiple'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
                        tab === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {/* Selections */}
                <div className="flex-1 overflow-y-auto px-3 divide-y divide-border">
                  {sels.map((s) => (
                    <div key={s.key} className="py-3 flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-foreground text-sm truncate">{s.outcomeLabel}</p>
                          <span className="text-sm font-bold tabular-nums text-foreground shrink-0">{s.odds.toFixed(2)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{s.homeTeam} v {s.awayTeam}</p>
                        <p className="text-[11px] text-muted-foreground uppercase">{s.marketLabel}</p>
                        {tab === 'single' && (
                          <input
                            type="number"
                            value={singleStakes[s.key] ?? ''}
                            onChange={(e) => setSingleStakes((p) => ({ ...p, [s.key]: e.target.value }))}
                            placeholder="Stake"
                            className="mt-1.5 w-full px-2 py-1.5 text-sm bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        )}
                      </div>
                      <button
                        onClick={() => removeSelection(s.key)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                        aria-label="Remove selection"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {sels.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Tap an odd on any match to add it here.
                    </p>
                  )}
                </div>

                {/* Footer */}
                {sels.length > 0 && (
                  <div className="border-t border-border p-3 space-y-2">
                    {tab === 'multiple' ? (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Total odds</span>
                          <span className="font-bold tabular-nums text-foreground">{totalOdds.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground shrink-0">Stake</span>
                          <input
                            type="number"
                            value={multiStake}
                            onChange={(e) => setMultiStake(e.target.value)}
                            className="flex-1 px-3 py-2 bg-input border border-border rounded-lg text-right font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Potential win</span>
                          <span className="font-extrabold text-accent tabular-nums">{potWin.toFixed(2)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Total stake</span>
                        <span className="font-bold tabular-nums text-foreground">{singleTotal.toFixed(2)}</span>
                      </div>
                    )}

                    {msg && <p className="text-xs text-destructive">{msg}</p>}

                    <button
                      onClick={placeBet}
                      disabled={busy}
                      className="w-full bg-accent text-accent-foreground font-bold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
                    >
                      {busy ? 'Placing…' : 'Place Bet'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}
