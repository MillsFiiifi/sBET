'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  Loader2,
  ArrowLeft,
  Zap,
  Coins,
  Copy,
  Check,
  CheckCircle2,
  Hourglass,
  UploadCloud,
  X,
  AlertTriangle,
  Smartphone,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/format-money'
import {
  DEFAULT_COUNTRY,
  DEFAULT_CURRENCY,
  getMinFirstDeposit,
  isCountryCode,
  isCurrencyCode,
  type CountryCode,
  type CurrencyCode,
} from '@/lib/countries'

// The BEP20 (BNB Smart Chain) wallet USDT deposits are sent to. Set this in the
// environment so the address can be rotated without a code change — and so the
// method stays safely disabled (no fake address shown) until it's configured.
const USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_BEP20_ADDRESS?.trim() || ''

// Quick-pick amounts, matching the deposit UX players expect.
const AMOUNT_CHIPS = [300, 500, 1000, 1500, 2000, 3000, 5000]

const MAX_SCREENSHOT_BYTES = 5_000_000

// Mobile-money networks for the Instant tab. `provider` is the key the
// Flutterwave start route forwards to the hosted checkout as a hint.
const NETWORKS: { provider: 'mtn' | 'vod' | 'atl'; short: string; label: string }[] = [
  { provider: 'mtn', short: 'MTN', label: 'MTN MoMo' },
  { provider: 'vod', short: 'TELECEL', label: 'Telecel Cash' },
  { provider: 'atl', short: 'AT', label: 'AirtelTigo' },
]

type Method = 'flutterwave' | 'usdt'

interface UserProfile {
  id: string
  name: string
  email?: string
  phone?: string | null
  country?: string
  currency?: string
  totalDeposited: number
  totalWithdrawn: number
  balance: number
  firstDepositAt?: string | null
}

function DepositForm() {
  const router = useRouter()
  const params = useSearchParams()
  const userId = params.get('userId') ?? ''
  const purposeParam = params.get('purpose')
  const purpose: 'deposit' | 'verification' =
    purposeParam === 'verification' ? 'verification' : 'deposit'

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(Boolean(userId))

  const [method, setMethod] = useState<Method>('flutterwave')
  const [amount, setAmount] = useState<number | ''>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Instant (mobile-money) prefill state — the actual payment + OTP happen on
  // Flutterwave's hosted checkout page after redirect.
  const [network, setNetwork] = useState<'mtn' | 'vod' | 'atl'>('mtn')
  const [phone, setPhone] = useState('')

  // USDT screenshot upload state.
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // USDT terminal screen.
  const [manualSubmitted, setManualSubmitted] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    fetch(`/api/users/${userId}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && !data.error) {
          setProfile(data as UserProfile)
          if (data.phone) setPhone(String(data.phone))
        }
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const country: CountryCode = isCountryCode(profile?.country) ? profile!.country : DEFAULT_COUNTRY
  const currency: CurrencyCode = isCurrencyCode(profile?.currency)
    ? profile!.currency
    : DEFAULT_CURRENCY
  const minDeposit = useMemo(() => getMinFirstDeposit(country), [country])

  const amountValue = typeof amount === 'number' ? amount : 0

  function selectFile(f: File | null) {
    setError(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    if (!f) {
      setFile(null)
      setPreviewUrl(null)
      return
    }
    if (f.size > MAX_SCREENSHOT_BYTES) {
      setError('Screenshot is too large (max 5 MB).')
      return
    }
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(USDT_ADDRESS)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked — the address is still visible to copy by hand */
    }
  }

  function validateAmount(): string | null {
    if (!amountValue || amountValue <= 0) return 'Enter or pick an amount.'
    if (amountValue < minDeposit) {
      return `Minimum deposit is ${currency} ${formatMoney(minDeposit, currency)}.`
    }
    return null
  }

  // Instant: send the customer to Flutterwave's own hosted checkout page, where
  // they choose mobile money / card and complete the OTP on Flutterwave's site.
  // On success Flutterwave redirects back to /me and the callback credits.
  async function handleInstant() {
    if (!profile) return
    const amountError = validateAmount()
    if (amountError) {
      setError(amountError)
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/payments/flutterwave/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.id,
          amount: amountValue,
          purpose,
          returnPath: '/me',
          phone: phone.trim() || undefined,
          network,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not open checkout. Try again.')
        return
      }
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl as string
        return
      }
      setError('Could not open checkout. Try again.')
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleUsdt() {
    if (!profile) return
    if (!USDT_ADDRESS) {
      setError('USDT deposits are not available right now. Please contact support.')
      return
    }
    const amountError = validateAmount()
    if (amountError) {
      setError(amountError)
      return
    }
    if (!file) {
      setError('Attach a screenshot of your USDT payment.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const form = new FormData()
      form.set('userId', profile.id)
      form.set('amount', String(amountValue))
      form.set('purpose', purpose)
      form.set('channel', 'usdt')
      form.set('returnPath', '/me')
      form.set('file', file)
      const res = await fetch('/api/payments/manual/start', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not submit your deposit. Try again.')
        return
      }
      setManualSubmitted(true)
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const headingTitle = purpose === 'verification' ? 'Verify your account' : 'Add money'

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/me"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </Link>
          <Link href="/" className="flex items-center" aria-label="PowerStakeBet home">
            <Image
              src="/powerstakebet-logo.svg"
              alt="PowerStakeBet"
              width={360}
              height={104}
              className="logo-img h-7 w-auto"
            />
          </Link>
          <div className="w-12" />
        </div>
      </header>

      <main className="flex-1 flex items-start sm:items-center justify-center p-4 py-8">
        <div className="relative w-full max-w-md">
          <div aria-hidden className="absolute -top-16 -left-12 w-56 h-56 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div aria-hidden className="absolute -bottom-16 -right-12 w-56 h-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

          <div className="relative bg-card rounded-2xl border border-border p-5 sm:p-8 shadow-card">
            {manualSubmitted && profile ? (
              <div className="text-center space-y-4">
                <div className="relative w-16 h-16 mx-auto">
                  <div aria-hidden className="absolute inset-0 rounded-2xl bg-amber-500/20 blur-xl" />
                  <div className="relative w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shadow-card">
                    <Hourglass className="w-8 h-8 text-amber-600" />
                  </div>
                </div>
                <h1 className="text-title font-bold tracking-tight">USDT deposit request submitted!</h1>
                <p className="text-sm text-muted-foreground">
                  Please wait for admin approval. We&apos;ll credit your{' '}
                  <span className="font-bold text-foreground tabular-nums">
                    {currency} {formatMoney(amountValue, currency)}
                  </span>{' '}
                  once the payment is confirmed — usually within a few minutes.
                </p>
                <Button
                  onClick={() => router.push('/me')}
                  className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-card hover:shadow-card-hover hover:-translate-y-0.5 active:translate-y-0 transition-all"
                >
                  View account
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="text-center space-y-1.5">
                  <h1 className="text-title font-bold tracking-tight">{headingTitle}</h1>
                  <p className="text-sm text-muted-foreground">
                    Choose how you&apos;d like to fund your wallet.
                  </p>
                </div>

                {/* Method picker */}
                <div className="grid grid-cols-2 gap-2">
                  <MethodTab
                    active={method === 'flutterwave'}
                    onClick={() => {
                      setError(null)
                      setMethod('flutterwave')
                    }}
                    icon={<Zap className="w-4 h-4" />}
                    title="Instant"
                    subtitle="Card / MoMo"
                  />
                  <MethodTab
                    active={method === 'usdt'}
                    onClick={() => {
                      setError(null)
                      setMethod('usdt')
                    }}
                    icon={<Coins className="w-4 h-4" />}
                    title="USDT"
                    subtitle="BEP20"
                    badge="Recommended"
                  />
                </div>

                {/* USDT: pay-to address */}
                {method === 'usdt' &&
                  (USDT_ADDRESS ? (
                    <div className="space-y-1.5">
                      <p className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">
                        Send USDT via BEP20 to this address
                      </p>
                      <button
                        type="button"
                        onClick={copyAddress}
                        className="w-full flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 p-3 text-left transition-colors"
                      >
                        <span className="flex-1 min-w-0 break-all font-mono text-sm text-foreground">
                          {USDT_ADDRESS}
                        </span>
                        <span className="shrink-0 inline-flex items-center gap-1 text-primary font-semibold text-caption">
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copied ? 'Copied' : 'Copy'}
                        </span>
                      </button>
                      <p className="text-caption text-muted-foreground">
                        Only send USDT on the BEP20 (BNB Smart Chain) network. Sending any other
                        coin or network may be lost.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>USDT deposits aren&apos;t available right now. Please use Instant, or contact support.</span>
                    </div>
                  ))}

                {/* Amount */}
                <div className="space-y-2">
                  <p className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">
                    Select amount ({currency})
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {AMOUNT_CHIPS.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          setError(null)
                          setAmount(v)
                        }}
                        className={`h-11 rounded-xl border font-bold text-sm tabular-nums transition-colors ${
                          amount === v
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-secondary/60 text-foreground hover:bg-secondary'
                        }`}
                      >
                        {formatMoney(v, currency)}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-semibold">
                      {currency}
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={minDeposit}
                      value={amount}
                      onChange={(e) => {
                        setError(null)
                        const n = Number(e.target.value)
                        setAmount(e.target.value === '' ? '' : Number.isFinite(n) ? n : '')
                      }}
                      placeholder="Or enter a custom amount"
                      className="w-full h-12 pl-14 pr-3 rounded-xl border border-border bg-background text-foreground font-semibold tabular-nums outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <p className="text-caption text-muted-foreground">
                    Minimum {currency} {formatMoney(minDeposit, currency)}.
                  </p>
                </div>

                {/* Instant: mobile-money network + phone (prefilled into checkout) */}
                {method === 'flutterwave' && (
                  <>
                    <div className="space-y-2">
                      <p className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">
                        Mobile-money network
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {NETWORKS.map((n) => (
                          <button
                            key={n.provider}
                            type="button"
                            onClick={() => {
                              setError(null)
                              setNetwork(n.provider)
                            }}
                            className={`flex flex-col items-center justify-center gap-0.5 h-14 rounded-xl border transition-colors ${
                              network === n.provider
                                ? 'border-primary bg-primary/10'
                                : 'border-border bg-secondary/60 hover:bg-secondary'
                            }`}
                          >
                            <span className="text-caption font-bold text-muted-foreground">{n.short}</span>
                            <span className="text-xs font-semibold text-foreground">{n.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">
                        Mobile-money phone number
                      </p>
                      <div className="relative">
                        <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="tel"
                          inputMode="tel"
                          value={phone}
                          onChange={(e) => {
                            setError(null)
                            setPhone(e.target.value)
                          }}
                          placeholder="e.g. 0533431086"
                          className="w-full h-12 pl-10 pr-3 rounded-xl border border-border bg-background text-foreground font-semibold outline-none focus:border-primary transition-colors"
                        />
                      </div>
                      <p className="text-caption text-muted-foreground">
                        You&apos;ll finish the payment on Flutterwave&apos;s secure checkout page.
                      </p>
                    </div>
                  </>
                )}

                {/* USDT: screenshot upload */}
                {method === 'usdt' && USDT_ADDRESS && (
                  <div className="space-y-2">
                    <p className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">
                      Upload payment screenshot
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
                    />
                    {file && previewUrl ? (
                      <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/60 p-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl}
                          alt="Payment screenshot preview"
                          className="w-12 h-12 rounded-lg object-cover border border-border"
                        />
                        <span className="flex-1 min-w-0 truncate text-sm text-foreground">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => selectFile(null)}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          aria-label="Remove screenshot"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-secondary/40 hover:bg-secondary/70 py-6 text-center transition-colors"
                      >
                        <UploadCloud className="w-6 h-6 text-primary" />
                        <span className="text-sm font-semibold text-foreground">Click to attach screenshot</span>
                        <span className="text-caption text-muted-foreground">PNG, JPG up to 5MB</span>
                      </button>
                    )}
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Submit */}
                {method === 'flutterwave' ? (
                  <Button
                    onClick={handleInstant}
                    disabled={loading || profileLoading || !profile}
                    className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-card hover:shadow-card-hover hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        {amountValue > 0
                          ? `Deposit ${currency} ${formatMoney(amountValue, currency)}`
                          : 'Continue to payment'}
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleUsdt}
                    disabled={loading || profileLoading || !profile || !USDT_ADDRESS}
                    className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-card hover:shadow-card-hover hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Submit Deposit
                      </>
                    )}
                  </Button>
                )}

                <p className="text-caption text-center text-muted-foreground">
                  Need help? Contact support.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function MethodTab({
  active,
  onClick,
  icon,
  title,
  subtitle,
  badge,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  subtitle: string
  badge?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
        active ? 'border-primary bg-primary/10' : 'border-border bg-secondary/60 hover:bg-secondary'
      }`}
    >
      {badge && (
        <span className="absolute top-2 right-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
          {badge}
        </span>
      )}
      <span
        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${
          active ? 'bg-primary text-primary-foreground' : 'bg-background text-primary'
        }`}
      >
        {icon}
      </span>
      <span className="text-sm font-bold text-foreground">{title}</span>
      <span className="text-caption text-muted-foreground">{subtitle}</span>
    </button>
  )
}

export default function FirstDepositPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <DepositForm />
    </Suspense>
  )
}
