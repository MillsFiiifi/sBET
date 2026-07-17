'use client'

import { useEffect, useState } from 'react'
import { Users2, ShieldCheck, KeyRound } from 'lucide-react'

interface StatusResponse {
  env: { odds_api_key: boolean; admin_password: boolean; node_env: string }
}

export default function AdminOverviewPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null)

  useEffect(() => {
    fetch('/api/admin/status', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [])

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          You are signed in to the SBET admin console.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          icon={<ShieldCheck className="w-5 h-5 text-accent" />}
          label="Admin gate"
          value="Active"
          sub="Session valid · 12h"
        />
        <Card
          icon={<KeyRound className="w-5 h-5 text-accent" />}
          label="Environment"
          value={status?.env.node_env ?? '…'}
          sub={status?.env.admin_password ? 'ADMIN_PASSWORD set' : 'ADMIN_PASSWORD missing'}
        />
        <Card
          icon={<Users2 className="w-5 h-5 text-accent" />}
          label="Partners"
          value="Referrals"
          sub="Sub-admins self-register at /sub-admin/register"
        />
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-2">Auth is live</h2>
        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1.5">
          <li>Players register/sign in at <code className="text-accent">/register</code> and <code className="text-accent">/login</code>.</li>
          <li>Referral codes on signup credit the owning sub-admin.</li>
          <li>Sub-admins (partners) manage their referrals at <code className="text-accent">/sub-admin/dashboard</code>.</li>
        </ul>
      </div>
    </div>
  )
}

function Card({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <span className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
          {icon}
        </span>
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  )
}
