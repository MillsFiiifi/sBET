'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Moon, Sun, Menu, X, Wallet, Bell, LayoutDashboard } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getUserId } from '@/lib/user-session'
import { formatMoney } from '@/lib/format-money'
import { spinxpressHref } from '@/lib/spinxpress'

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [currency, setCurrency] = useState<string>('GHS')
  const [unread, setUnread] = useState(0)
  const [isSubAdmin, setIsSubAdmin] = useState(false)

  useEffect(() => {
    setUserId(getUserId())
    setIsDark(document.documentElement.classList.contains('dark'))

    // Separate cookie from the player session, and httpOnly — the only way to
    // know is to ask. Costs nothing for ordinary players: with no cookie to
    // parse the route answers before it reaches the database.
    let cancelled = false
    void fetch('/api/sub-admin/session', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.isSubAdmin) setIsSubAdmin(true)
      })
      .catch(() => {
        /* not a partner, or offline — either way, no link */
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!userId) {
      setBalance(null)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/users/${userId}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) {
          setBalance(typeof data.balance === 'number' ? data.balance : 0)
          if (typeof data.currency === 'string') setCurrency(data.currency)
        }
      } catch {
        /* ignore */
      }
    }
    // Badge count only — the bodies are the notifications page's job.
    const loadUnread = async () => {
      try {
        const res = await fetch(`/api/users/${userId}/notifications?countOnly=1`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setUnread(typeof data.unread === 'number' ? data.unread : 0)
      } catch {
        /* ignore */
      }
    }

    void load()
    void loadUnread()
    const onFocus = () => {
      void load()
      void loadUnread()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
    }
  }, [userId])

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
  }

  const depositHref = userId
    ? `/users/first-deposit?userId=${userId}`
    : '/register'

  return (
    <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border shadow-sm shadow-primary/5">
      <nav className="max-w-[1400px] mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center" aria-label="PowerStakeBet home">
            <Image
              src="/powerstakebet-logo.svg"
              alt="PowerStakeBet"
              width={360}
              height={104}
              priority
              className="logo-img h-7 sm:h-8 w-auto"
            />
          </Link>

          <div className="hidden md:flex items-center gap-1">
            <Link
              href="/sports"
              className="px-4 py-2 rounded-lg text-foreground hover:bg-secondary transition-colors font-medium"
            >
              Sports
            </Link>
            <Link
              href="/football"
              className="px-4 py-2 rounded-lg text-foreground hover:bg-secondary transition-colors font-medium"
            >
              Football
            </Link>
            <Link
              href="/live"
              className="px-4 py-2 rounded-lg text-foreground hover:bg-secondary transition-colors font-medium flex items-center gap-2"
            >
              <span className="w-2 h-2 bg-live rounded-full animate-pulse-live" />
              Live
            </Link>
            <Link
              href="/leagues"
              className="px-4 py-2 rounded-lg text-foreground hover:bg-secondary transition-colors font-medium"
            >
              Leagues
            </Link>
            <a
              href={spinxpressHref(userId)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg text-foreground hover:bg-secondary transition-colors font-medium flex items-center gap-1.5"
            >
              Tower Rush
              <span className="text-[9px] font-bold uppercase bg-[#ffd54a] text-[#3a2a00] px-1 py-0.5 rounded leading-none">New</span>
            </a>
            <Link
              href="/me"
              className="px-4 py-2 rounded-lg text-foreground hover:bg-secondary transition-colors font-medium"
            >
              Me
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {/* Compact balance pill — shown on mobile (the desktop chip below
                is hidden on small screens). Sits next to the logo/icons. */}
            {userId && (
              <Link
                href="/me"
                className="flex sm:hidden items-center gap-1 px-2.5 py-1 rounded-full bg-[#2ecc71]/10 border border-[#2ecc71]/40"
                aria-label="View account balance"
              >
                <Wallet className="w-3.5 h-3.5 text-[#2ecc71] shrink-0" />
                <span className="text-xs font-bold text-foreground tabular-nums whitespace-nowrap">
                  {balance === null ? '—' : `${currency} ${formatMoney(balance, currency)}`}
                </span>
              </Link>
            )}

            {isSubAdmin && (
              // Visible on mobile too, not just desktop: burying the only way
              // into the dashboard inside the hamburger meant partners on
              // phones could not find it at all.
              <Link
                href="/sub-admin/dashboard"
                aria-label="Partner dashboard"
                className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 sm:py-1 rounded-full bg-primary/10 border border-primary/40 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
              >
                <LayoutDashboard className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="hidden sm:inline">Partner</span>
              </Link>
            )}

            {userId && (
              <Link
                href="/me/notifications"
                className="relative p-2 rounded-lg hover:bg-secondary transition-colors"
                aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
              >
                <Bell className="w-5 h-5" />
                {unread > 0 && (
                  <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-4 text-center">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Link>
            )}

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {userId ? (
              <>
                <Link
                  href="/me"
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2ecc71]/10 border border-[#2ecc71]/40 hover:bg-[#2ecc71]/20 transition-colors"
                  aria-label="View account balance"
                >
                  <Wallet className="w-4 h-4 text-[#2ecc71]" />
                  <span className="text-xs text-muted-foreground">Balance</span>
                  <span className="text-sm font-bold text-foreground tabular-nums">
                    {balance === null ? '—' : `${currency} ${formatMoney(balance, currency)}`}
                  </span>
                </Link>
                <Link href={depositHref} className="hidden sm:block">
                  <Button
                    size="sm"
                    className="bg-[#2ecc71] hover:bg-[#27ae60] text-white font-bold gap-1.5"
                  >
                    <Wallet className="w-4 h-4" />
                    Deposit
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="outline" className="hidden sm:flex">
                    Login
                  </Button>
                </Link>
                <Link href="/register">
                  <Button className="hidden sm:flex bg-primary text-primary-foreground hover:bg-primary/90">
                    Register
                  </Button>
                </Link>
              </>
            )}

            <button
              className="md:hidden p-2 rounded-lg hover:bg-secondary transition-colors"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col gap-2">
              <Link
                href="/sports"
                className="px-4 py-2 rounded-lg hover:bg-secondary transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Sports
              </Link>
              <Link
                href="/football"
                className="px-4 py-2 rounded-lg hover:bg-secondary transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Football
              </Link>
              <Link
                href="/live"
                className="px-4 py-2 rounded-lg hover:bg-secondary transition-colors flex items-center gap-2"
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="w-2 h-2 bg-live rounded-full animate-pulse-live" />
                Live
              </Link>
              <Link
                href="/leagues"
                className="px-4 py-2 rounded-lg hover:bg-secondary transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Leagues
              </Link>
              <a
                href={spinxpressHref(userId)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg hover:bg-secondary transition-colors flex items-center gap-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Tower Rush
                <span className="text-[9px] font-bold uppercase bg-[#ffd54a] text-[#3a2a00] px-1 py-0.5 rounded leading-none">New</span>
              </a>
              <Link
                href="/me"
                className="px-4 py-2 rounded-lg hover:bg-secondary transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Me
              </Link>
              {isSubAdmin && (
                <Link
                  href="/sub-admin/dashboard"
                  className="px-4 py-2 rounded-lg hover:bg-secondary transition-colors flex items-center gap-2 text-primary font-semibold"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Partner dashboard
                </Link>
              )}
              {userId ? (
                <div className="flex gap-2 mt-2 px-4">
                  <Link href={depositHref} className="flex-1" onClick={() => setIsMenuOpen(false)}>
                    <Button className="w-full bg-[#2ecc71] hover:bg-[#27ae60] text-white font-bold">
                      Deposit
                    </Button>
                  </Link>
                  <Link href="/me" className="flex-1" onClick={() => setIsMenuOpen(false)}>
                    <Button variant="outline" className="w-full border-[#2ecc71] text-[#2ecc71]">
                      Account
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="flex gap-2 mt-2 px-4">
                  <Link href="/login" className="flex-1" onClick={() => setIsMenuOpen(false)}>
                    <Button variant="outline" className="w-full">Login</Button>
                  </Link>
                  <Link href="/register" className="flex-1" onClick={() => setIsMenuOpen(false)}>
                    <Button className="w-full bg-primary text-primary-foreground">Register</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
