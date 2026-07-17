'use client'

import { useEffect, useState } from 'react'
import { Check, X, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { formatMoney } from '@/lib/format-money'
import type { Transaction } from '@/lib/transactions-store'

type Row = Transaction & { userName: string | null; userEmail: string | null }

export default function AdminTransactionsPage() {
  const [scope, setScope] = useState<'pending' | 'all'>('pending')
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const load = async (s: 'pending' | 'all' = scope) => {
    const res = await fetch(`/api/admin/transactions?scope=${s}`, { cache: 'no-store' })
    if (res.ok) setRows((await res.json()).transactions ?? [])
  }

  useEffect(() => {
    void load(scope)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope])

  const act = async (id: string, action: 'approve' | 'decline') => {
    setBusy(id)
    try {
      await fetch(`/api/admin/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      await load()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-title font-bold tracking-tight">Wallet requests</h1>
          <p className="text-sm text-muted-foreground">
            Approve to credit deposits / debit withdrawals. Balances update in Supabase.
          </p>
        </div>
        <div className="flex bg-secondary rounded-lg p-1">
          {(['pending', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
                scope === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-card">
        {rows.length === 0 ? (
          <div className="m-4 border border-dashed border-border rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {scope === 'pending' ? 'No pending requests.' : 'No transactions yet.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((t) => {
              const isCredit = t.type === 'deposit' || t.type === 'bet_win' || t.type === 'bonus'
              return (
                <li key={t.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      isCredit ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                    }`}
                  >
                    {isCredit ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium capitalize truncate">
                      {t.type.replace('_', ' ')} · {t.method}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.userName ?? 'Unknown'} {t.userEmail ? `· ${t.userEmail}` : ''} ·{' '}
                      {new Date(t.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold tabular-nums ${isCredit ? 'text-success' : 'text-destructive'}`}>
                      {isCredit ? '+' : '-'}{formatMoney(t.amount, t.currency)}
                    </p>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t.status}</p>
                  </div>
                  {t.status === 'pending' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        disabled={busy === t.id}
                        onClick={() => act(t.id, 'approve')}
                        title="Approve"
                        className="p-2 rounded-lg text-success hover:bg-success/10 transition-colors disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        disabled={busy === t.id}
                        onClick={() => act(t.id, 'decline')}
                        title="Decline"
                        className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
