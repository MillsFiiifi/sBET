'use client'

import { useCallback, useEffect, useState } from 'react'
import { getUserId } from '@/lib/user-session'
import { formatMoneyWithCurrency } from '@/lib/format-money'
import type { Transaction } from '@/lib/transactions-store'
import {
  CreditCard,
  Download,
  Upload,
  Eye,
  EyeOff,
  ArrowUpRight,
  ArrowDownLeft,
  Zap,
  TrendingUp,
} from 'lucide-react'

interface WalletData {
  name: string
  balance: number
  currency: string
  totalDeposited: number
  totalWithdrawn: number
  withdrawalApproved: boolean
  pendingWithdrawals: number
  totalWagers: number
  totalWins: number
  transactions: Transaction[]
}

const CREDIT_TYPES = new Set(['deposit', 'bet_win', 'bonus'])

export function WalletPage() {
  const [showBalance, setShowBalance] = useState(true)
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [loggedOut, setLoggedOut] = useState(false)
  const [dialog, setDialog] = useState<null | 'deposit' | 'withdrawal'>(null)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const userId = getUserId()
    if (!userId) {
      setLoggedOut(true)
      return
    }
    const res = await fetch(`/api/users/wallet?userId=${userId}`, { cache: 'no-store' })
    if (res.ok) setWallet(await res.json())
    else if (res.status === 404) setLoggedOut(true)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const submitRequest = async () => {
    const userId = getUserId()
    if (!userId || !dialog) return
    const value = parseFloat(amount)
    if (!Number.isFinite(value) || value <= 0) {
      setMsg('Enter a valid amount')
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/users/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, type: dialog, amount: value }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Request failed')
      setDialog(null)
      setAmount('')
      setMsg('Request submitted — pending admin approval.')
      await load()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (loggedOut) {
    return (
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-md mx-auto text-center mt-16">
          <CreditCard className="w-12 h-12 text-accent mx-auto mb-4 opacity-70" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Sign in to view your wallet</h1>
          <p className="text-muted-foreground mb-6">Your real balance, deposits and withdrawals live here.</p>
          <a href="/login" className="inline-block bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity">
            Log in
          </a>
        </div>
      </main>
    )
  }

  const cur = wallet?.currency
  const fmt = (n: number) => formatMoneyWithCurrency(n, cur)

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Wallet</h1>
          <p className="text-muted-foreground">Manage your balance, deposits, and withdrawals</p>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-primary to-primary/80 rounded-lg p-6 text-primary-foreground col-span-1 md:col-span-2">
            <div className="flex justify-between items-start mb-8">
              <div>
                <p className="text-primary-foreground/80 text-sm font-medium mb-1">Total Balance</p>
                <div className="flex items-center gap-3">
                  <h2 className="text-4xl font-bold">
                    {wallet ? (showBalance ? fmt(wallet.balance) : '••••••') : '—'}
                  </h2>
                  <button onClick={() => setShowBalance(!showBalance)} className="hover:opacity-80 transition-opacity">
                    {showBalance ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <CreditCard className="w-8 h-8 opacity-80" />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setDialog('deposit'); setMsg(null); setAmount('') }}
                className="flex-1 bg-primary-foreground text-primary font-medium py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> Deposit
              </button>
              <button
                onClick={() => { setDialog('withdrawal'); setMsg(null); setAmount('') }}
                className="flex-1 bg-primary-foreground/20 text-primary-foreground font-medium py-2 rounded-lg hover:bg-primary-foreground/30 transition-colors flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" /> Withdraw
              </button>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-muted-foreground text-sm">Pending</p>
              <Zap className="w-4 h-4 text-accent" />
            </div>
            <p className="text-2xl font-bold text-foreground mb-1">{wallet ? fmt(wallet.pendingWithdrawals) : '—'}</p>
            <p className="text-xs text-muted-foreground">Withdrawals processing</p>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-muted-foreground text-sm">Total Wagers</p>
              <TrendingUp className="w-4 h-4 text-accent" />
            </div>
            <p className="text-2xl font-bold text-foreground mb-1">{wallet ? fmt(wallet.totalWagers) : '—'}</p>
            <p className="text-xs text-muted-foreground">All time</p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-muted-foreground text-sm mb-2">Total Deposited</p>
            <span className="text-3xl font-bold text-foreground">{wallet ? fmt(wallet.totalDeposited) : '—'}</span>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-muted-foreground text-sm mb-2">Total Wins</p>
            <span className="text-3xl font-bold text-success">{wallet ? fmt(wallet.totalWins) : '—'}</span>
          </div>
        </div>

        {/* Transaction History */}
        <div>
          <h2 className="text-lg font-bold text-foreground mb-4">Transaction History</h2>
          {!wallet || wallet.transactions.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-lg p-10 text-center">
              <p className="text-sm text-muted-foreground">
                {wallet ? 'No transactions yet. Make a deposit to get started.' : 'Loading…'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {wallet.transactions.map((t) => {
                const isCredit = CREDIT_TYPES.has(t.type)
                return (
                  <div key={t.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between hover:border-accent transition-colors">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${isCredit ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                        {isCredit ? <ArrowDownLeft className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground capitalize">{t.type.replace('_', ' ')}</p>
                        <p className="text-sm text-muted-foreground">{t.method || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className={`font-semibold ${isCredit ? 'text-success' : 'text-foreground'}`}>
                          {isCredit ? '+' : '-'}{fmt(t.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(t.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="w-24 text-right">
                        <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                          t.status === 'completed' ? 'bg-success/20 text-success'
                          : t.status === 'pending' ? 'bg-accent/20 text-accent'
                          : 'bg-muted text-muted-foreground'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Deposit / Withdraw dialog */}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !busy && setDialog(null)}>
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground capitalize">{dialog}</h3>
            <p className="text-sm text-muted-foreground">
              {dialog === 'deposit'
                ? 'Enter the amount to deposit. An admin confirms it and credits your balance.'
                : 'Enter the amount to withdraw. It goes to admin for approval.'}
            </p>
            <input
              type="number"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              className="w-full px-3 py-2 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {msg && <p className="text-sm text-destructive">{msg}</p>}
            <div className="flex gap-3">
              <button onClick={() => setDialog(null)} disabled={busy} className="flex-1 border border-border py-2 rounded-lg text-foreground hover:bg-secondary transition-colors">
                Cancel
              </button>
              <button onClick={submitRequest} disabled={busy} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {busy ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
      {msg && !dialog && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg px-4 py-2 text-sm text-foreground shadow-popover">
          {msg}
        </div>
      )}
    </main>
  )
}
