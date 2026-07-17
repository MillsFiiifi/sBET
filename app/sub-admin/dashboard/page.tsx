'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Copy, Check, LogOut, Users, Wallet, Clock } from 'lucide-react'
import { formatMoney } from '@/lib/format-money'

interface MeResponse {
  subAdmin: {
    id: string
    name: string
    email: string
    referralCode: string
    approved: boolean
    createdAt: string
  }
  stats: { referrals: number; withDeposit: number; pending: number; commissionsCount: number }
  referredUsers: {
    id: string
    name: string
    email: string
    currency: string
    createdAt: string
    firstDepositAt?: string
    totalDeposited: number
  }[]
}

export default function SubAdminDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<MeResponse | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/sub-admin/me', { cache: 'no-store' })
    if (res.status === 401) {
      router.push('/sub-admin/login')
      return
    }
    if (res.ok) setData(await res.json())
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  async function logout() {
    await fetch('/api/sub-admin/logout', { method: 'POST' })
    router.push('/sub-admin/login')
    router.refresh()
  }

  function copyCode() {
    if (!data) return
    navigator.clipboard.writeText(data.subAdmin.referralCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (!data) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background text-muted-foreground">
        Loading…
      </div>
    )
  }

  const { subAdmin, stats, referredUsers } = data

  return (
    <div className="min-h-dvh bg-background">
      <header className="bg-card border-b border-border">
        <div className="px-6 h-14 flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              ₹
            </span>
            <span className="font-display font-bold tracking-wide text-foreground">SBET</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-accent border border-accent/40 bg-accent/10 rounded-full px-2 py-0.5">
              Partner
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-muted-foreground hover:text-accent transition-colors">
              ← Site
            </Link>
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Welcome, {subAdmin.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {subAdmin.approved ? 'Your partner account is active.' : 'Pending approval.'}
          </p>
        </div>

        {/* Referral code */}
        <div className="bg-gradient-to-br from-primary/20 to-accent/10 border border-accent/30 rounded-2xl p-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            Your referral code
          </p>
          <div className="flex items-center gap-3">
            <span className="font-display text-3xl font-bold tracking-widest text-accent">
              {subAdmin.referralCode}
            </span>
            <button
              onClick={copyCode}
              className="inline-flex items-center gap-1.5 text-sm bg-card border border-border rounded-lg px-3 py-1.5 hover:border-accent transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Players who enter this code at signup are linked to you.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Stat icon={<Users className="w-5 h-5 text-accent" />} label="Referrals" value={stats.referrals} />
          <Stat icon={<Wallet className="w-5 h-5 text-accent" />} label="With deposit" value={stats.withDeposit} />
          <Stat icon={<Clock className="w-5 h-5 text-accent" />} label="Pending" value={stats.pending} />
        </div>

        {/* Referred users */}
        <div className="bg-card border border-border rounded-xl">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-foreground">Referred players</h2>
          </div>
          {referredUsers.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">
              No referrals yet. Share your code to get started.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {referredUsers.map((u) => (
                <li key={u.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground tabular-nums">
                      {formatMoney(u.totalDeposited, u.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {u.firstDepositAt ? 'Deposited' : 'No deposit'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <span className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
    </div>
  )
}
