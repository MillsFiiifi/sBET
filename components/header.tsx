'use client'

import { useEffect, useState } from 'react'
import { Search, Bell, MessageCircle, Settings, User } from 'lucide-react'
import { getUserId, getUserName } from '@/lib/user-session'
import { formatMoneyWithCurrency } from '@/lib/format-money'

interface HeaderProps {
  onSettingsClick?: () => void
}

export function Header({ onSettingsClick }: HeaderProps) {
  const [balance, setBalance] = useState<number | null>(null)
  const [currency, setCurrency] = useState<string | undefined>(undefined)
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    const userId = getUserId()
    setName(getUserName())
    if (!userId) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/users/wallet?userId=${userId}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setBalance(data.balance ?? 0)
        setCurrency(data.currency)
        if (data.name) setName(data.name)
      } catch {
        /* ignore */
      }
    }
    void load()
    const t = setInterval(load, 15_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  return (
    <header className="bg-card border-b border-border sticky top-0 z-50">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex-1">
          <div className="max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search matches, teams..."
                className="w-full pl-10 pr-4 py-2 bg-secondary text-foreground rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent placeholder-muted-foreground"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 ml-6">
          {/* Wallet Info */}
          <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg">
            <span className="text-sm text-muted-foreground">Balance:</span>
            <span className="text-base font-bold text-foreground tabular-nums">
              {balance === null ? '—' : formatMoneyWithCurrency(balance, currency)}
            </span>
          </div>

          <a
            href="/login"
            className="px-4 py-2 bg-accent text-accent-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            {name ? 'Deposit' : 'Log in'}
          </a>

          <button className="relative p-2 hover:bg-secondary rounded-lg transition-colors">
            <Bell className="w-5 h-5 text-foreground" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
          </button>

          <button className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <MessageCircle className="w-5 h-5 text-foreground" />
          </button>

          <button onClick={onSettingsClick} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <Settings className="w-5 h-5 text-foreground" />
          </button>

          <button className="flex items-center gap-2 px-3 py-2 hover:bg-secondary rounded-lg transition-colors">
            <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-accent-foreground" />
            </div>
            <span className="text-sm font-medium text-foreground">{name ?? 'Guest'}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
