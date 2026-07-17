'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/matches', label: 'Matches' },
  { href: '/admin/promotions', label: 'Promotions' },
  { href: '/admin/transactions', label: 'Wallet requests' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  // The login page renders standalone (it has its own full-screen card).
  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              ₹
            </span>
            <span className="font-display font-bold tracking-wide text-foreground">SBET</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-accent border border-accent/40 bg-accent/10 rounded-full px-2 py-0.5">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-muted-foreground hover:text-accent transition-colors">
              ← Back to site
            </Link>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
        <nav className="px-6 flex items-center gap-1 border-t border-border overflow-x-auto">
          {NAV.map((item) => {
            const active =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </header>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
