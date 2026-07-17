'use client'

import { useEffect, useState } from 'react'
import { Trash2, Plus, Eye, EyeOff } from 'lucide-react'
import type { Promotion, PromotionStatus } from '@/lib/promotions-store'

const STATUSES: PromotionStatus[] = ['active', 'available', 'claimed']

const emptyForm = {
  title: '',
  description: '',
  bonus: '',
  percentage: '',
  requirements: '',
  expiresIn: '',
  status: 'active' as PromotionStatus,
  badge: '',
}

export default function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [form, setForm] = useState({ ...emptyForm })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const res = await fetch('/api/admin/promotions', { cache: 'no-store' })
    if (res.ok) setPromotions((await res.json()).promotions ?? [])
  }

  useEffect(() => {
    void load()
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/admin/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add promotion')
      setForm({ ...emptyForm })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const patch = async (id: string, body: Record<string, unknown>) => {
    await fetch(`/api/admin/promotions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    await load()
  }

  const remove = async (id: string) => {
    await fetch(`/api/admin/promotions/${id}`, { method: 'DELETE' })
    await load()
  }

  const field = (k: keyof typeof form, label: string, placeholder = '') => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        value={String(form[k])}
        placeholder={placeholder}
        onChange={(e) => setForm({ ...form, [k]: e.target.value })}
        className="px-3 py-2 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  )

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-title font-bold tracking-tight">Promotions</h1>
        <p className="text-sm text-muted-foreground">
          These appear on the player Promotions page. Stored in Supabase.
        </p>
      </div>

      <form onSubmit={submit} className="bg-card border border-border rounded-xl p-4 shadow-card space-y-4">
        <h2 className="font-semibold text-title flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" /> New promotion
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {field('title', 'Title', 'Welcome Bonus')}
          {field('bonus', 'Bonus', '+500.00')}
          {field('percentage', 'Percentage', '100%')}
          {field('requirements', 'Requirements', '5x rollover')}
          {field('expiresIn', 'Expires in', '7 days')}
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Status</span>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as PromotionStatus })}
              className="px-3 py-2 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring capitalize"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Description</span>
          <textarea
            value={form.description}
            placeholder="Get 100% match bonus on your first deposit up to 500"
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="px-3 py-2 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring min-h-20"
          />
        </label>
        <div className="flex items-center justify-between gap-3">
          {error ? <span className="text-sm text-destructive">{error}</span> : <span />}
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Adding…' : 'Add promotion'}
          </button>
        </div>
      </form>

      <div className="bg-card border border-border rounded-xl shadow-card">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-title">All promotions ({promotions.length})</h2>
        </div>
        {promotions.length === 0 ? (
          <div className="m-4 border border-dashed border-border rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">No promotions yet. Add one above.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {promotions.map((p) => (
              <li key={p.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <span className="uppercase font-semibold text-accent">{p.status}</span>
                    {!p.active && <span>· hidden</span>}
                    {p.bonus && <span>· {p.bonus}</span>}
                  </div>
                  <p className="text-sm font-medium truncate">{p.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.description}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => patch(p.id, { active: !p.active })}
                    title={p.active ? 'Hide from players' : 'Show to players'}
                    className="p-2 rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
                  >
                    {p.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => remove(p.id)}
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
