'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, Bell, Settings, User, Menu, Wallet, LogOut, LogIn, ChevronRight } from 'lucide-react'
import { clearUserSession, getUserId, getUserName } from '@/lib/user-session'
import { formatMoneyWithCurrency } from '@/lib/format-money'

interface HeaderProps {
  onSettingsClick?: () => void
  onMenuClick?: () => void
  /** Jump to the wallet and open the deposit dialog. */
  onDeposit?: () => void
  /** Jump to the wallet page. */
  onWallet?: () => void
}

export function Header({ onSettingsClick, onMenuClick, onDeposit, onWallet }: HeaderProps) {
  const [balance, setBalance] = useState<number | null>(null)
  const [currency, setCurrency] = useState<string | undefined>(undefined)
  const [name, setName] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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

  // Close the account menu on outside click.
  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  const loggedIn = !!name
  const logout = () => {
    clearUserSession()
    setName(null)
    setBalance(null)
    setMenuOpen(false)
    window.location.reload()
  }

  return (
    <header className="bg-card border-b border-border sticky top-0 z-50">
      <div className="px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-1 hover:bg-secondary rounded-lg transition-colors shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-foreground" />
          </button>

          <div className="hidden sm:block max-w-md flex-1">
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

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Balance */}
          <button
            onClick={onWallet}
            className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 bg-secondary rounded-lg hover:bg-secondary/70 transition-colors"
          >
            <span className="hidden sm:inline text-sm text-muted-foreground">Balance:</span>
            <span className="text-sm sm:text-base font-bold text-foreground tabular-nums whitespace-nowrap">
              {balance === null ? (loggedIn ? '—' : '0.00') : formatMoneyWithCurrency(balance, currency)}
            </span>
          </button>

          {/* Deposit (logged in) / Log in (guest) */}
          {loggedIn ? (
            <button
              onClick={onDeposit}
              className="px-3 sm:px-4 py-2 bg-accent text-accent-foreground rounded-lg font-medium hover:opacity-90 transition-opacity text-sm whitespace-nowrap"
            >
              Deposit
            </button>
          ) : (
            <a
              href="/login"
              className="px-3 sm:px-4 py-2 bg-accent text-accent-foreground rounded-lg font-medium hover:opacity-90 transition-opacity text-sm whitespace-nowrap"
            >
              Log in
            </a>
          )}

          <button className="hidden sm:block relative p-2 hover:bg-secondary rounded-lg transition-colors">
            <Bell className="w-5 h-5 text-foreground" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
          </button>

          <button onClick={onSettingsClick} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <Settings className="w-5 h-5 text-foreground" />
          </button>

          {/* Profile / account menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 px-2 sm:px-3 py-2 hover:bg-secondary rounded-lg transition-colors"
              aria-label="Account menu"
            >
              <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-accent-foreground" />
              </div>
              <span className="hidden md:inline text-sm font-medium text-foreground">{name ?? 'Guest'}</span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-popover border border-border rounded-xl shadow-popover overflow-hidden z-50">
                <div className="p-4 border-b border-border">
                  <p className="text-sm font-semibold text-foreground truncate">{loggedIn ? name : 'Guest'}</p>
                  {loggedIn ? (
                    <p className="text-lg font-bold text-accent tabular-nums">
                      {balance === null ? '—' : formatMoneyWithCurrency(balance, currency)}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not signed in</p>
                  )}
                </div>

                {loggedIn ? (
                  <div className="py-1">
                    <MenuItem icon={<Wallet className="w-4 h-4" />} label="Wallet" onClick={() => { setMenuOpen(false); onWallet?.() }} />
                    <MenuItem icon={<Wallet className="w-4 h-4" />} label="Deposit" onClick={() => { setMenuOpen(false); onDeposit?.() }} />
                    <MenuItem icon={<Settings className="w-4 h-4" />} label="Settings" onClick={() => { setMenuOpen(false); onSettingsClick?.() }} />
                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-secondary transition-colors"
                    >
                      <LogOut className="w-4 h-4" /> Log out
                    </button>
                  </div>
                ) : (
                  <div className="py-1">
                    <a href="/login" className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors">
                      <LogIn className="w-4 h-4" /> Log in
                    </a>
                    <a href="/register" className="flex items-center justify-between px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors">
                      <span className="flex items-center gap-3"><User className="w-4 h-4" /> Register</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </a>
                    <MenuItem icon={<Settings className="w-4 h-4" />} label="Settings" onClick={() => { setMenuOpen(false); onSettingsClick?.() }} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
    >
      {icon} {label}
    </button>
  )
}
