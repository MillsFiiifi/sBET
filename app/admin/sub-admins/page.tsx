'use client'

import { useEffect, useState } from 'react'
import { Users, Trash2, Check, Wallet } from 'lucide-react'
import { formatMoney } from '@/lib/format-money'

interface SubAdmin {
  id: string
  name: string
  email: string
  referralCode: string
  approved: boolean
  createdAt: string
  commissionBalances: Record<string, number>
  totalCommissionEarnedBy: Record<string, number>
  referredUsers: number
  depositedUsers: number
}

export default function AdminSubAdminsPage() {
  const [subs, setSubs] = useState<SubAdmin[]>([])
  const [rate, setRate] = useState(0.65)
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    const res = await fetch('/api/admin/sub-admins', { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      setSubs(data.subAdmins ?? [])
      if (typeof data.rate === 'number') setRate(data.rate)
    }
  }

  useEffect(() => { void load() }, [])

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusy(id)
    try {
      await fetch(`/api/admin/sub-admins/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      await load()
    } finally { setBusy(null) }
  }

  const remove = async (id: string) => {
    setBusy(id)
    try {
      await fetch(`/api/admin/sub-admins/${id}`, { method: 'DELETE' })
      await load()
    } finally { setBusy(null) }
  }

  const money = (map: Record<string, number>) =>
    Object.entries(map || {}).filter(([, v]) => v > 0)

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-title font-bold tracking-tight flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" /> Sub-admins
        </h1>
        <p className="text-sm text-muted-foreground">
          Partner accounts &amp; referral commissions. Rate: <span className="font-semibold text-foreground">{Math.round(rate * 100)}%</span> of each referred user&apos;s first deposit.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-card">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-title">All sub-admins ({subs.length})</h2>
        </div>
        {subs.length === 0 ? (
          <div className="m-4 border border-dashed border-border rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">No sub-admins yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {subs.map((s) => {
              const balances = money(s.commissionBalances)
              const lifetime = money(s.totalCommissionEarnedBy)
              return (
                <li key={s.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground truncate">{s.name}</p>
                        <span className="font-mono text-xs tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded">{s.referralCode}</span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${s.approved ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>
                          {s.approved ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {s.referredUsers} referred · {s.depositedUsers} deposited
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => patch(s.id, { action: 'approve', approved: !s.approved })}
                        disabled={busy === s.id}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                          s.approved ? 'border-border text-muted-foreground hover:text-foreground' : 'border-success/40 text-success hover:bg-success/10'
                        }`}
                      >
                        {s.approved ? 'Disable' : 'Approve'}
                      </button>
                      <button
                        onClick={() => remove(s.id)}
                        disabled={busy === s.id}
                        className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="bg-secondary/40 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Wallet className="w-4 h-4 text-accent" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Owed now</span>
                    </div>
                    {balances.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nothing owed.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {balances.map(([cur, amt]) => (
                          <div key={cur} className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5">
                            <span className="text-sm font-bold tabular-nums text-foreground">{cur} {formatMoney(amt, cur)}</span>
                            <button
                              onClick={() => patch(s.id, { action: 'mark-paid', currency: cur })}
                              disabled={busy === s.id}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-success hover:underline disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" /> Mark paid
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {lifetime.length > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-2">
                        Lifetime earned: {lifetime.map(([cur, amt]) => `${cur} ${formatMoney(amt, cur)}`).join(' · ')}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
