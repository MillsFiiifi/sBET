'use client'

import { useEffect, useState } from 'react'
import { Trash2, Plus, Radio, Lock, LockOpen } from 'lucide-react'
import type { CustomMatch } from '@/lib/custom-matches-store'

const SPORTS = ['soccer', 'basketball', 'tennis', 'hockey', 'american-football', 'baseball', 'volleyball']

const emptyForm = {
  sport: 'soccer',
  league: '',
  country: '',
  homeTeam: '',
  awayTeam: '',
  oddsHome: '',
  oddsDraw: '',
  oddsAway: '',
  homeScore: '',
  awayScore: '',
  minute: '',
  startTime: '',
  isLive: false,
}

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<CustomMatch[]>([])
  const [form, setForm] = useState({ ...emptyForm })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const res = await fetch('/api/admin/matches', { cache: 'no-store' })
    if (res.ok) setMatches((await res.json()).matches ?? [])
  }

  useEffect(() => {
    void load()
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/admin/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add match')
      setForm({ ...emptyForm })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const patch = async (id: string, body: Record<string, unknown>) => {
    await fetch(`/api/admin/matches/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    await load()
  }

  const remove = async (id: string) => {
    await fetch(`/api/admin/matches/${id}`, { method: 'DELETE' })
    await load()
  }

  const field = (k: keyof typeof form, label: string, type = 'text', placeholder = '') => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        type={type}
        value={String(form[k])}
        placeholder={placeholder}
        onChange={(e) => setForm({ ...form, [k]: e.target.value })}
        className="px-3 py-2 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  )

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-title font-bold tracking-tight">Matches</h1>
        <p className="text-sm text-muted-foreground">
          Add and manage the real matches players bet on. Stored in Supabase.
        </p>
      </div>

      {/* Add match form */}
      <form onSubmit={submit} className="bg-card border border-border rounded-xl p-4 shadow-card space-y-4">
        <h2 className="font-semibold text-title flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" /> New match
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Sport</span>
            <select
              value={form.sport}
              onChange={(e) => setForm({ ...form, sport: e.target.value })}
              className="px-3 py-2 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring capitalize"
            >
              {SPORTS.map((s) => (
                <option key={s} value={s}>{s.replace('-', ' ')}</option>
              ))}
            </select>
          </label>
          {field('league', 'League', 'text', 'Premier League')}
          {field('country', 'Country', 'text', 'England')}
          {field('homeTeam', 'Home team', 'text', 'Man United')}
          {field('awayTeam', 'Away team', 'text', 'Liverpool')}
          {field('startTime', 'Start time', 'text', 'Today 20:00')}
          {field('oddsHome', 'Odds — Home (1)', 'number', '1.85')}
          {field('oddsDraw', 'Odds — Draw (X)', 'number', '3.40')}
          {field('oddsAway', 'Odds — Away (2)', 'number', '4.20')}
          {field('homeScore', 'Home score', 'number', '0')}
          {field('awayScore', 'Away score', 'number', '0')}
          {field('minute', 'Minute (if live)', 'text', "45")}
        </div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.isLive}
              onChange={(e) => setForm({ ...form, isLive: e.target.checked })}
              className="w-4 h-4 accent-primary"
            />
            <span>Mark as live now</span>
          </label>
          {error && <span className="text-sm text-destructive">{error}</span>}
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Adding…' : 'Add match'}
          </button>
        </div>
      </form>

      {/* Match list */}
      <div className="bg-card border border-border rounded-xl shadow-card">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-title">All matches ({matches.length})</h2>
        </div>
        {matches.length === 0 ? (
          <div className="m-4 border border-dashed border-border rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">No matches yet. Add one above.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {matches.map((m) => (
              <li key={m.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <span className="uppercase font-semibold text-accent">{m.league}</span>
                    {m.isLive && (
                      <span className="inline-flex items-center gap-1 text-destructive font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" /> LIVE {m.minute ? `${m.minute}'` : ''}
                      </span>
                    )}
                    {m.locked && <span className="text-muted-foreground">· locked</span>}
                  </div>
                  <p className="text-sm font-medium truncate">
                    {m.homeTeam} {m.isLive ? `${m.homeScore ?? 0} - ${m.awayScore ?? 0}` : 'vs'} {m.awayTeam}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    1: {m.oddsHome.toFixed(2)} {m.oddsDraw > 0 ? `· X: ${m.oddsDraw.toFixed(2)}` : ''} · 2: {m.oddsAway.toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => patch(m.id, { isLive: !m.isLive })}
                    title={m.isLive ? 'Set upcoming' : 'Set live'}
                    className={`p-2 rounded-lg transition-colors ${m.isLive ? 'text-destructive hover:bg-destructive/10' : 'text-muted-foreground hover:bg-secondary'}`}
                  >
                    <Radio className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => patch(m.id, { locked: !m.locked })}
                    title={m.locked ? 'Unlock betting' : 'Lock betting'}
                    className="p-2 rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
                  >
                    {m.locked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => remove(m.id)}
                    title="Delete"
                    className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
