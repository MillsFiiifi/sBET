'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Info,
  Receipt,
} from 'lucide-react'
import { MobileNav } from '@/components/mobile-nav'
import { MeSubpageHeader } from '@/components/me-subpage-header'
import { Skeleton } from '@/components/ui/skeleton'
import { getUserId } from '@/lib/user-session'

type Kind = 'withdrawal' | 'deposit' | 'bet' | 'system'

interface Item {
  id: string
  kind: Kind
  title: string
  body: string
  readAt: string | null
  createdAt: string
}

const ICONS: Record<Kind, React.ReactNode> = {
  deposit: <ArrowDownLeft className="w-4 h-4 text-primary" />,
  withdrawal: <ArrowUpRight className="w-4 h-4 text-amber-500" />,
  bet: <Receipt className="w-4 h-4 text-muted-foreground" />,
  system: <Info className="w-4 h-4 text-muted-foreground" />,
}

/** "2 hours ago" — close enough, and it never needs a locale. */
function timeAgo(iso: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString()
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const userId = getUserId()
    if (!userId) {
      setItems([])
      return
    }
    try {
      const res = await fetch(`/api/users/${userId}/notifications`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { notifications: Item[] }
      setItems(data.notifications ?? [])

      // Opening the page is reading them. Fire-and-forget: the badge clearing
      // a moment late is not worth blocking the render on.
      if ((data.notifications ?? []).some((n) => !n.readAt)) {
        void fetch(`/api/users/${userId}/notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setItems([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="min-h-screen bg-background pb-20">
      <MeSubpageHeader title="Notifications" />

      <main className="px-3 sm:px-4 py-4 max-w-2xl mx-auto space-y-2">
        {items === null ? (
          <>
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </>
        ) : items.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <Bell className="w-10 h-10 mx-auto text-muted-foreground/50" />
            <p className="font-semibold">Nothing yet</p>
            <p className="text-sm text-muted-foreground">
              {error
                ? 'We could not load your notifications. Pull down to try again.'
                : 'Deposits, withdrawals and account updates will show up here.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => (
              <li
                key={n.id}
                className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                  n.readAt
                    ? 'border-border bg-card'
                    : 'border-primary/30 bg-primary/5'
                }`}
              >
                <span className="mt-0.5 shrink-0">{ICONS[n.kind] ?? ICONS.system}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold text-sm truncate">{n.title}</p>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-snug">{n.body}</p>
                </div>
                {!n.readAt && (
                  <span
                    aria-label="Unread"
                    className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </main>

      <MobileNav selectedBets={[]} activeTab="me" />
    </div>
  )
}
