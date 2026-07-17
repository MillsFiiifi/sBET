'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { saveUserSession } from '@/lib/user-session'
import { Eye, EyeOff, ChevronLeft, ShieldCheck, Zap, Trophy } from 'lucide-react'

const COUNTRIES = [
  { code: 'GH', flag: '🇬🇭', dial: '233', name: 'Ghana' },
  { code: 'NG', flag: '🇳🇬', dial: '234', name: 'Nigeria' },
  { code: 'KE', flag: '🇰🇪', dial: '254', name: 'Kenya' },
  { code: 'ZA', flag: '🇿🇦', dial: '27', name: 'South Africa' },
]

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'phone' | 'email'>('phone')
  const [dial, setDial] = useState('233')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const identifier =
        mode === 'phone'
          ? `+${dial}${phone.replace(/\D/g, '').replace(/^0+/, '')}`
          : email.trim()
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Login failed')
        return
      }
      saveUserSession(data.user.id, data.user.name)
      router.push('/')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex bg-background">
      {/* Left promo panel — desktop only */}
      <aside className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-accent">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_40%),radial-gradient(circle_at_80%_60%,white_0,transparent_35%)]" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-primary-foreground text-primary flex items-center justify-center font-extrabold">
              S
            </span>
            <span className="font-display text-2xl font-bold tracking-wide">SBET</span>
          </div>
          <div className="space-y-6">
            <h2 className="text-4xl font-extrabold leading-tight">
              Bet on the games<br />you love.
            </h2>
            <ul className="space-y-4 text-primary-foreground/90">
              <li className="flex items-center gap-3">
                <Zap className="w-5 h-5" /> Fast payouts & live in-play betting
              </li>
              <li className="flex items-center gap-3">
                <Trophy className="w-5 h-5" /> Thousands of markets every day
              </li>
              <li className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5" /> Safe, secure & licensed
              </li>
            </ul>
          </div>
          <p className="text-sm text-primary-foreground/70">© {'2026'} SBET. Play responsibly. 18+</p>
        </div>
      </aside>

      {/* Right form panel */}
      <main className="flex-1 flex flex-col">
        <div className="p-4 sm:p-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-accent transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back to home
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-4 pb-10">
          <div className="w-full max-w-[400px]">
            {/* Brand — mobile */}
            <div className="lg:hidden flex items-center gap-2 mb-6">
              <span className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-extrabold">
                S
              </span>
              <span className="font-display text-2xl font-bold tracking-wide text-foreground">SBET</span>
            </div>

            <h1 className="text-2xl font-extrabold text-foreground mb-1">Log In</h1>
            <p className="text-sm text-muted-foreground mb-6">Welcome back — let&apos;s get you playing.</p>

            {/* Phone / Email tabs */}
            <div className="grid grid-cols-2 bg-secondary rounded-xl p-1 mb-5">
              {(['phone', 'email'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setError(null) }}
                  className={`py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
                    mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m === 'phone' ? 'Phone number' : 'Email'}
                </button>
              ))}
            </div>

            {error && (
              <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3.5 py-2.5">
                {error}
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              {mode === 'phone' ? (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Phone number</label>
                  <div className="flex gap-2">
                    <div className="relative shrink-0">
                      <select
                        value={dial}
                        onChange={(e) => setDial(e.target.value)}
                        className="h-full appearance-none bg-input border border-border rounded-xl pl-3 pr-8 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/40"
                        aria-label="Country code"
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.dial}>
                            {c.flag} +{c.dial}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      className="flex-1 bg-input border border-border rounded-xl px-4 py-3 text-base text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/40 placeholder:text-muted-foreground"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="24 123 4567"
                      autoComplete="tel"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Email address</label>
                  <input
                    type="email"
                    className="w-full bg-input border border-border rounded-xl px-4 py-3 text-base text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/40 placeholder:text-muted-foreground"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="username"
                    required
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-muted-foreground">Password</label>
                  <button type="button" className="text-xs font-medium text-accent hover:underline">
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    className="w-full bg-input border border-border rounded-xl px-4 py-3 pr-11 text-base text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/40 placeholder:text-muted-foreground"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent text-accent-foreground font-bold text-base py-3.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Logging in…' : 'Log In'}
              </button>
            </form>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">New to SBET?</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <Link
              href="/register"
              className="block w-full text-center border border-primary text-primary font-bold py-3.5 rounded-xl hover:bg-primary/10 transition-colors"
            >
              Register
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
