'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { saveUserSession } from '@/lib/user-session'
import { listCountries, getCountry, DEFAULT_COUNTRY } from '@/lib/countries'
import { Eye, EyeOff, ChevronLeft, Gift, Zap, ShieldCheck } from 'lucide-react'

const inputClass =
  'w-full bg-input border border-border rounded-xl px-4 py-3 text-base text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/40 placeholder:text-muted-foreground'

export default function RegisterPage() {
  const router = useRouter()
  const countries = useMemo(() => listCountries(), [])

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState<string>(DEFAULT_COUNTRY)
  const [kyc, setKyc] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const cfg = getCountry(country)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          phone,
          country,
          kyc: cfg.requiresKyc ? kyc : undefined,
          referralCode: referralCode || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Registration failed')
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

  const label = 'block text-xs font-semibold text-muted-foreground mb-1.5'

  return (
    <div className="min-h-dvh flex bg-background">
      {/* Left promo panel — desktop only */}
      <aside className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-accent">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_40%),radial-gradient(circle_at_80%_60%,white_0,transparent_35%)]" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-primary-foreground text-primary flex items-center justify-center font-extrabold">
              P
            </span>
            <span className="font-display text-2xl font-bold tracking-wide">PowerStakeBet</span>
          </div>
          <div className="space-y-6">
            <h2 className="text-4xl font-extrabold leading-tight">
              Join PowerStakeBet<br />in under a minute.
            </h2>
            <ul className="space-y-4 text-primary-foreground/90">
              <li className="flex items-center gap-3">
                <Gift className="w-5 h-5" /> Welcome bonus on your first deposit
              </li>
              <li className="flex items-center gap-3">
                <Zap className="w-5 h-5" /> Live betting & fast payouts
              </li>
              <li className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5" /> Secure, licensed & responsible
              </li>
            </ul>
          </div>
          <p className="text-sm text-primary-foreground/70">© 2026 PowerStakeBet. Play responsibly. 18+</p>
        </div>
      </aside>

      {/* Right form panel */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-4 sm:p-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-accent transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back to home
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-4 pb-10">
          <div className="w-full max-w-[420px]">
            {/* Brand — mobile */}
            <div className="lg:hidden flex items-center gap-2 mb-6">
              <span className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-extrabold">
                P
              </span>
              <span className="font-display text-2xl font-bold tracking-wide text-foreground">PowerStakeBet</span>
            </div>

            <h1 className="text-2xl font-extrabold text-foreground mb-1">Create account</h1>
            <p className="text-sm text-muted-foreground mb-6">Register and start betting in minutes.</p>

            {error && (
              <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3.5 py-2.5">
                {error}
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className={label}>Full name</label>
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Kwame Mensah" required />
              </div>

              <div>
                <label className={label}>Email address</label>
                <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Country</label>
                  <select className={inputClass} value={country} onChange={(e) => setCountry(e.target.value)}>
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label}>Phone</label>
                  <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={`0…  (+${cfg.dialCode})`} inputMode="numeric" required />
                </div>
              </div>

              {cfg.requiresKyc && (
                <div>
                  <label className={label}>{cfg.kycLabel}</label>
                  <input className={inputClass} value={kyc} onChange={(e) => setKyc(e.target.value)} placeholder={cfg.kycPlaceholder} required />
                </div>
              )}

              <div>
                <label className={label}>Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    className={`${inputClass} pr-11`}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    minLength={6}
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

              <div>
                <label className={label}>Referral code <span className="font-normal normal-case text-muted-foreground">(optional)</span></label>
                <input
                  className={`${inputClass} uppercase`}
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="e.g. PSB7X"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent text-accent-foreground font-bold text-base py-3.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Already have an account?{' '}
              <Link href="/login" className="text-accent font-semibold hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
