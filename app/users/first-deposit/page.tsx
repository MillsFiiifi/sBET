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
import { MANUAL_MOMO, isManualMomoEnabled } from '@/lib/manual-momo'

// The BEP20 (BNB Smart Chain) wallet USDT deposits are sent to. Set this in the
// environment so the address can be rotated without a code change — and so the
// method stays safely disabled (no fake address shown) until it's configured.
const USDT_ADDRESS =
  process.env.NEXT_PUBLIC_USDT_BEP20_ADDRESS?.trim() ||
  '0xe8c97b578d6c50f7dd5e5ace58fb3e6479a01038'

// Quick-pick amounts, matching the deposit UX players expect.
const AMOUNT_CHIPS = [300, 500, 1000, 1500, 2000, 3000, 5000]

// Shared field styling, in one place so the inputs stay in step.
//
// text-base is load-bearing on mobile, not cosmetic: iOS Safari zooms the whole
// page when it focuses an input rendering below 16px, and the player then has
// to pinch back out to see the rest of the form.
const SECTION_LABEL =
  'text-[11px] font-bold uppercase tracking-[0.08em] text-foreground/70'
const FIELD =
  'w-full h-12 rounded-xl border border-border bg-background text-foreground text-base font-semibold outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25'

const MAX_SCREENSHOT_BYTES = 5_000_000

// Mobile-money networks for the Instant tab. `provider` is the key the
// gateway's start route expects (mtn / vod / atl). Both gateways accept these
// same three keys and map them to their own network codes server-side.
const NETWORKS: { provider: 'mtn' | 'vod' | 'atl'; short: string; label: string }[] = [
  { provider: 'mtn', short: 'MTN', label: 'MTN MoMo' },
  { provider: 'vod', short: 'TELECEL', label: 'Telecel Cash' },
  { provider: 'atl', short: 'AT', label: 'AirtelTigo' },
]

// Which gateway backs the "Instant" tab (on-phone MoMo charge).
//
//   null          tab hidden — players pay our MoMo number or send USDT and an
//                 admin approves the receipt.
//   'flutterwave' the original flow, including the "pay with card" fallback.
//   'akwapay'     AkwaPay mobile money — the current setup. Needs
//                 AKWAPAY_SECRET_KEY set on the deployment, or /start answers
//                 503 and the tab is a dead end. Test with sk_test_ first: a
//                 live key sends a real prompt to a real phone.
//
// The OTP and polling steps are identical either way — the two gateways expose
// the same request and response shapes on purpose, so this is the only line
// that needs to change.
//
// Written `null as InstantGateway | null` rather than a bare `null`: with a
// bare one TypeScript narrows the const to the literal, decides the gateway
// lookup below is unreachable, and types it `never` — so turning the tab off
// breaks the compile of the code that only runs when it is on.
type InstantGateway = 'flutterwave' | 'akwapay'
const INSTANT_GATEWAY = 'akwapay' as InstantGateway | null

// `card` is whether the gateway can also take a hosted card payment. The
// checkout redirect is a Flutterwave product; AkwaPay is mobile money only, so
// the "pay with card instead" fallback hides and the tab stops advertising a
// card it cannot take.
interface GatewayConfig {
  start: string
  otp: string
  status: string
  card: boolean
}

const GATEWAY_ROUTES: Record<InstantGateway, GatewayConfig> = {
  flutterwave: {
    start: '/api/payments/flutterwave/momo/start',
    otp: '/api/payments/flutterwave/momo/otp',
    status: '/api/payments/flutterwave/status',
    card: true,
  },
  akwapay: {
    start: '/api/payments/akwapay/start',
    otp: '/api/payments/akwapay/otp',
    status: '/api/payments/akwapay/status',
    card: false,
  },
}

const GATEWAY: GatewayConfig | null = INSTANT_GATEWAY ? GATEWAY_ROUTES[INSTANT_GATEWAY] : null
// Falls back to the Flutterwave paths when the tab is off so the handlers below
// still typecheck; nothing calls them while GATEWAY is null.
const ROUTES = GATEWAY ?? GATEWAY_ROUTES.flutterwave
const FLUTTERWAVE_ENABLED: boolean = GATEWAY !== null
const CARD_FALLBACK_ENABLED: boolean = GATEWAY?.card ?? false
const INSTANT_SUBTITLE = CARD_FALLBACK_ENABLED ? 'Card / MoMo' : 'MoMo prompt'

// 'flutterwave' is the id of the Instant tab, whichever gateway INSTANT_GATEWAY
// currently points at — the name predates AkwaPay.
type Method = 'flutterwave' | 'momo' | 'usdt'

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

// Statuses the client should stop polling on (terminal), with pending meaning
// "keep waiting for the customer to approve on their phone".
const TERMINAL_FAIL = new Set([
  'failed',
  'cancelled',
  'abandoned',
  'amount-mismatch',
  'credit-failed',
  'verify-failed',
  'unknown-reference',
  'missing-reference',
  'no-user',
])

function DepositForm() {
  const router = useRouter()
  const params = useSearchParams()
  const userId = params.get('userId') ?? ''
  const purposeParam = params.get('purpose')
  const purpose: 'deposit' | 'verification' =
    purposeParam === 'verification' ? 'verification' : 'deposit'

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(Boolean(userId))

  // Instant is the landing tab whenever a gateway is behind it — paying in the
  // app is the route we want players on, with pay-and-upload as the fallback
  // rather than the default. The effect below moves them off it only if the
  // tab is switched off entirely.
  const [method, setMethod] = useState<Method>(FLUTTERWAVE_ENABLED ? 'flutterwave' : 'momo')
  const [amount, setAmount] = useState<number | ''>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<'address' | 'momo' | null>(null)

  // Instant (mobile-money) state.
  const [network, setNetwork] = useState<'mtn' | 'vod' | 'atl'>('mtn')
  const [phone, setPhone] = useState('')
  const [pinPrompt, setPinPrompt] = useState<string | null>(null)
  // Whether a blocking confirmation is in flight. Deliberately separate from
  // pinPrompt: that is the line of text on screen, and while the OTP box is
  // open it holds an *instruction* ("enter the code"), not a busy state. Wiring
  // the buttons to pinPrompt disabled Confirm the instant the box appeared.
  const [waiting, setWaiting] = useState(false)
  const [otpReference, setOtpReference] = useState<string | null>(null)
  const [otp, setOtp] = useState('')

  // USDT screenshot upload state.
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // reference → the poll loop currently running for it, so callers share one.
  const pollsRef = useRef<Map<string, Promise<string>>>(new Map())

  // Terminal screens.
  const [manualSubmitted, setManualSubmitted] = useState(false)
  const [depositSuccess, setDepositSuccess] = useState(false)

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

  // Revoke object URLs so previews don't leak.
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
  const activeNetwork = NETWORKS.find((n) => n.provider === network) ?? NETWORKS[0]
  // Manual MoMo is Ghana-only — the receiving account is a Ghanaian line.
  const momoAvailable = isManualMomoEnabled(country)
  // USDT is always offered; the other two are conditional.
  const tabCount = 1 + (FLUTTERWAVE_ENABLED ? 1 : 0) + (momoAvailable ? 1 : 0)

  // Keep the selected rail on something the user can actually pay through: a
  // non-GH profile loading in rules out MoMo, and Instant may be switched off.
  useEffect(() => {
    if (method === 'momo' && !momoAvailable) {
      setMethod(FLUTTERWAVE_ENABLED ? 'flutterwave' : 'usdt')
    } else if (method === 'flutterwave' && !FLUTTERWAVE_ENABLED) {
      setMethod(momoAvailable ? 'momo' : 'usdt')
    }
  }, [method, momoAvailable])

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

  async function copyValue(field: 'address' | 'momo', value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 1800)
    } catch {
      /* clipboard blocked — the value is still visible to copy by hand */
    }
  }

  function validateAmount(): string | null {
    if (!amountValue || amountValue <= 0) return 'Enter or pick an amount.'
    if (amountValue < minDeposit) {
      return `Minimum deposit is ${currency} ${formatMoney(minDeposit, currency)}.`
    }
    return null
  }

  // Poll the charge status until it settles. Resolves to the final status.
  //
  // One loop per reference, shared by every caller. The OTP box starts a quiet
  // background poll and pressing Confirm wants one too — without this they run
  // two independent timers against the same charge and race to report it.
  function pollChargeStatus(reference: string): Promise<string> {
    const inFlight = pollsRef.current.get(reference)
    if (inFlight) return inFlight
    const run = runPoll(reference)
    pollsRef.current.set(reference, run)
    void run.finally(() => pollsRef.current.delete(reference))
    return run
  }

  async function runPoll(reference: string): Promise<string> {
    const DEADLINE = Date.now() + 3 * 60 * 1000 // 3 minutes
    while (Date.now() < DEADLINE) {
      try {
        const res = await fetch(
          `${ROUTES.status}?reference=${encodeURIComponent(reference)}`,
          { cache: 'no-store' },
        )
        const data = await res.json()
        const status = String(data.status ?? 'pending')
        if (data.done === true || status === 'success' || status === 'already-credited') {
          return 'success'
        }
        // `failed` is the gateway's own verdict, so a charge it has already
        // given up on stops here instead of spinning out the full deadline.
        if (data.failed === true || TERMINAL_FAIL.has(status)) return status
      } catch {
        /* transient — keep polling */
      }
      await new Promise((r) => setTimeout(r, 3000))
    }
    return 'timeout'
  }

  // Poll quietly while the OTP box is shown, so a phone-approval that needs no
  // code still completes on its own. Doesn't surface errors — the user can
  // still type the OTP or fall back to card if this doesn't land.
  async function backgroundPoll(reference: string) {
    const final = await pollChargeStatus(reference)
    if (final === 'success') {
      try {
        const me = await fetch(`/api/users/${profile!.id}`, { cache: 'no-store' })
        if (me.ok) setProfile((await me.json()) as UserProfile)
      } catch {
        /* non-fatal */
      }
      setPinPrompt(null)
      setOtpReference(null)
      setDepositSuccess(true)
    } else {
      // Clear the message but leave the OTP box open — the quiet poll giving up
      // says nothing about the code, which the player can still enter. It never
      // touches `waiting`, so Confirm stays pressable throughout.
      setPinPrompt(null)
    }
  }

  /** Waits out the on-phone approval. Returns the final status. */
  async function finishAfterCharge(reference: string): Promise<string> {
    setPinPrompt('Approve the prompt on your phone to complete the payment…')
    setWaiting(true)
    let final: string
    try {
      final = await pollChargeStatus(reference)
    } finally {
      setWaiting(false)
      setPinPrompt(null)
    }
    if (final === 'success') {
      // Refresh balance for the success screen.
      try {
        const me = await fetch(`/api/users/${profile!.id}`, { cache: 'no-store' })
        if (me.ok) setProfile((await me.json()) as UserProfile)
      } catch {
        /* non-fatal */
      }
      setDepositSuccess(true)
    } else if (final === 'timeout') {
      setError('Still waiting for approval. If you approved it, your balance will update shortly.')
    } else {
      setError(friendlyStatus(final))
    }
    return final
  }

  // Instant: trigger a mobile-money charge (on-phone PIN/approval).
  async function handleInstantMomo() {
    if (!profile) return
    const amountError = validateAmount()
    if (amountError) {
      setError(amountError)
      return
    }
    if (!phone.trim()) {
      setError('Enter the mobile-money phone number.')
      return
    }
    setError(null)
    setOtpReference(null)
    setOtp('')
    setLoading(true)
    try {
      const res = await fetch(ROUTES.start, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.id,
          amount: amountValue,
          phone: phone.trim(),
          provider: network,
          purpose,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not start the payment. Try again.')
        return
      }
      const reference = data.reference as string
      // The gateway's own wording for the prompt, when it sends one. Shown as
      // it arrived: it is written by whichever gateway took the charge, so our
      // own copy would go stale the next time the routing changes.
      const instruction =
        typeof data.instruction === 'string' && data.instruction.trim()
          ? data.instruction.trim()
          : null
      // Flutterwave returns authorization mode 'otp' — the network texts the
      // customer a code they enter HERE on our page (validated via /momo/otp).
      // We never hand off to Flutterwave's hosted page (blank on this account).
      if (data.otpRequired) {
        setOtpReference(reference)
        setPinPrompt(instruction ?? 'Enter the code sent to your phone to complete the payment.')
        // Also poll in the background in case it clears via a phone approval.
        void backgroundPoll(reference)
        return
      }
      // Voucher/redirect networks (rare) still finish on Flutterwave's page.
      if (data.redirect) {
        window.location.href = data.redirect as string
        return
      }
      // No OTP and no redirect — just wait for the on-phone approval.
      setOtpReference(reference)
      setPinPrompt(instruction ?? 'Approve the prompt on your phone to complete the payment…')
      void backgroundPoll(reference)
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function submitOtp() {
    if (!otpReference) return
    if (!otp.trim()) {
      setError('Enter the code you received.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(ROUTES.otp, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: otpReference, otp: otp.trim() }),
      })
      const data = await res.json()
      const status = String(data.status ?? '')
      if (!res.ok) {
        setError(data.error || 'That code didn\'t work. Try again.')
        return
      }
      // Wrong/expired code — keep the OTP box open so the user can retry.
      if (status === 'otp-invalid') {
        setError(data.error || 'Incorrect or expired code. Please try again.')
        return
      }
      if (status === 'failed') {
        setError(data.error || 'Payment could not be completed. Please start again.')
        setOtpReference(null)
        setOtp('')
        return
      }
      // Code accepted. The charge now needs the on-phone approval, so hide the
      // code box and wait on the prompt.
      const ref = otpReference
      setOtpReference(null)
      setOtp('')
      const final = await finishAfterCharge(ref)
      // The approval never landed — put the code box back rather than stranding
      // them on an error with no way forward. The charge is still open, so it
      // can still complete; the error above says what happened.
      if (final !== 'success') setOtpReference(ref)
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  // "Pay with card instead" — Flutterwave hosted checkout (redirect).
  async function handleCard() {
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

  // Shared submit for the pay-then-upload rails (USDT and manual MoMo). Both
  // land as a pending payment an admin approves on /admin/deposits.
  async function handleManual(channel: 'usdt' | 'momo') {
    if (!profile) return
    if (channel === 'usdt' && !USDT_ADDRESS) {
      setError('USDT deposits are not available right now. Please contact support.')
      return
    }
    if (channel === 'momo' && !momoAvailable) {
      setError('MoMo deposits are not available right now. Please contact support.')
      return
    }
    const amountError = validateAmount()
    if (amountError) {
      setError(amountError)
      return
    }
    if (!file) {
      setError(
        channel === 'momo'
          ? 'Attach a screenshot of your MoMo payment.'
          : 'Attach a screenshot of your USDT payment.',
      )
      return
    }
    setError(null)
    setLoading(true)
    try {
      const form = new FormData()
      form.set('userId', profile.id)
      form.set('amount', String(amountValue))
      form.set('purpose', purpose)
      form.set('channel', channel)
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
  const busy = loading || waiting

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Skip</span>
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

      <main className="flex-1 flex items-start sm:items-center justify-center px-3 sm:px-4 py-6 sm:py-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="relative w-full max-w-md">
          <div aria-hidden className="absolute -top-16 -left-12 w-56 h-56 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div aria-hidden className="absolute -bottom-16 -right-12 w-56 h-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

          <div className="relative bg-card rounded-2xl border border-border p-4 sm:p-8 shadow-card">
            {depositSuccess && profile ? (
              <div className="text-center space-y-4">
                <div className="relative w-16 h-16 mx-auto">
                  <div aria-hidden className="absolute inset-0 rounded-2xl bg-success/20 blur-xl" />
                  <div className="relative w-16 h-16 rounded-2xl bg-success/15 border border-success/30 flex items-center justify-center shadow-card">
                    <CheckCircle2 className="w-8 h-8 text-success" />
                  </div>
                </div>
                <h1 className="text-title font-bold tracking-tight">Payment received!</h1>
                <div className="bg-secondary/60 border border-border rounded-xl p-4 text-left space-y-2">
                  <Row label="Total deposited" value={`${currency} ${formatMoney(profile.totalDeposited, currency)}`} />
                  <Row label="New balance" value={`${currency} ${formatMoney(profile.balance, currency)}`} tone="good" bold />
                </div>
                <Button
                  onClick={() => router.push('/')}
                  className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_8px_24px_-10px_var(--primary)] font-bold shadow-card hover:shadow-card-hover hover:-translate-y-0.5 active:translate-y-0 transition-all"
                >
                  Continue to home
                </Button>
              </div>
            ) : manualSubmitted && profile ? (
              <div className="text-center space-y-4">
                <div className="relative w-16 h-16 mx-auto">
                  <div aria-hidden className="absolute inset-0 rounded-2xl bg-amber-500/20 blur-xl" />
                  <div className="relative w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shadow-card">
                    <Hourglass className="w-8 h-8 text-amber-600" />
                  </div>
                </div>
                <h1 className="text-title font-bold tracking-tight">
                  {method === 'momo' ? 'MoMo' : 'USDT'} deposit request submitted!
                </h1>
                <p className="text-sm text-muted-foreground">
                  Please wait for admin approval. We&apos;ll credit your{' '}
                  <span className="font-bold text-foreground tabular-nums">
                    {currency} {formatMoney(amountValue, currency)}
                  </span>{' '}
                  once the payment is confirmed — usually within a few minutes.
                </p>
                <Button
                  onClick={() => router.push('/')}
                  className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_8px_24px_-10px_var(--primary)] font-bold shadow-card hover:shadow-card-hover hover:-translate-y-0.5 active:translate-y-0 transition-all"
                >
                  Continue to home
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
                <div className={`grid gap-2 ${tabCount === 3 ? 'grid-cols-3' : tabCount === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {FLUTTERWAVE_ENABLED && (
                    <MethodTab
                      active={method === 'flutterwave'}
                      onClick={() => {
                        setError(null)
                        setMethod('flutterwave')
                      }}
                      icon={<Zap className="w-4 h-4" />}
                      title="Instant"
                      subtitle={INSTANT_SUBTITLE}
                    />
                  )}
                  {momoAvailable && (
                    <MethodTab
                      active={method === 'momo'}
                      onClick={() => {
                        setError(null)
                        setMethod('momo')
                      }}
                      icon={<Smartphone className="w-4 h-4" />}
                      title="MoMo"
                      subtitle="Pay & upload"
                    />
                  )}
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

                {/* MoMo: pay-to account */}
                {method === 'momo' && momoAvailable && (
                  <div className="space-y-1.5">
                    <p className={SECTION_LABEL}>
                      Send {MANUAL_MOMO.network} MoMo to this number
                    </p>
                    <button
                      type="button"
                      onClick={() => copyValue('momo', MANUAL_MOMO.number)}
                      className="w-full flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 p-3 text-left transition-colors"
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block font-mono text-base font-bold tracking-wide text-foreground">
                          {MANUAL_MOMO.number}
                        </span>
                        <span className="block text-caption text-muted-foreground">
                          {MANUAL_MOMO.name} · {MANUAL_MOMO.network}
                        </span>
                      </span>
                      <span className="shrink-0 inline-flex items-center gap-1 text-primary font-semibold text-caption">
                        {copiedField === 'momo' ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                        {copiedField === 'momo' ? 'Copied' : 'Copy'}
                      </span>
                    </button>
                    <p className="text-caption text-muted-foreground">
                      Dial your MoMo menu or use the app to send the exact amount below, then
                      attach the confirmation screenshot. Check the name reads{' '}
                      <span className="font-semibold text-foreground">{MANUAL_MOMO.name}</span>{' '}
                      before you approve.
                    </p>
                  </div>
                )}

                {/* USDT: pay-to address */}
                {method === 'usdt' &&
                  (USDT_ADDRESS ? (
                    <div className="space-y-1.5">
                      <p className={SECTION_LABEL}>
                        Send USDT via BEP20 to this address
                      </p>
                      <button
                        type="button"
                        onClick={() => copyValue('address', USDT_ADDRESS)}
                        className="w-full flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 p-3 text-left transition-colors"
                      >
                        <span className="flex-1 min-w-0 break-all font-mono text-sm text-foreground">
                          {USDT_ADDRESS}
                        </span>
                        <span className="shrink-0 inline-flex items-center gap-1 text-primary font-semibold text-caption">
                          {copiedField === 'address' ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                          {copiedField === 'address' ? 'Copied' : 'Copy'}
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
                      <span>
                        USDT deposits aren&apos;t available right now. Please use{' '}
                        {momoAvailable ? 'MoMo' : FLUTTERWAVE_ENABLED ? 'Instant' : 'another method'},
                        or contact support.
                      </span>
                    </div>
                  ))}

                {/* Amount */}
                <div className="space-y-2">
                  <p className={SECTION_LABEL}>
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
                        className={`h-12 rounded-xl border font-bold text-sm tabular-nums transition-all active:scale-[0.97] ${
                          amount === v
                            ? 'border-primary bg-primary text-primary-foreground ring-2 ring-primary/30'
                            : 'border-border bg-secondary/60 text-foreground hover:bg-secondary hover:border-primary/40'
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
                      className={`${FIELD} pl-14 pr-3 tabular-nums`}
                    />
                  </div>
                  <p className="text-caption text-muted-foreground">
                    Minimum {currency} {formatMoney(minDeposit, currency)}.
                  </p>
                </div>

                {/* Instant: mobile-money network + phone */}
                {method === 'flutterwave' && !otpReference && (
                  <>
                    <div className="space-y-2">
                      <p className={SECTION_LABEL}>
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
                            className={`flex flex-col items-center justify-center gap-0.5 h-14 rounded-xl border px-1 transition-all active:scale-[0.97] ${
                              network === n.provider
                                ? 'border-primary bg-primary/15 ring-2 ring-primary/30'
                                : 'border-border bg-secondary/60 hover:bg-secondary hover:border-primary/40'
                            }`}
                          >
                            <span
                              className={`text-[10px] font-bold tracking-wide ${
                                network === n.provider ? 'text-primary' : 'text-muted-foreground'
                              }`}
                            >
                              {n.short}
                            </span>
                            <span className="text-[11px] sm:text-xs font-semibold text-foreground leading-tight text-center">
                              {n.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className={SECTION_LABEL}>
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
                          className={`${FIELD} pl-10 pr-3`}
                        />
                      </div>
                      {amountValue > 0 && (
                        <p className="text-caption text-muted-foreground">
                          You&apos;ll get a prompt on this phone to approve {currency}{' '}
                          {formatMoney(amountValue, currency)}.
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* Instant: OTP step */}
                {method === 'flutterwave' && otpReference && (
                  <div className="space-y-1.5">
                    <p className={SECTION_LABEL}>
                      Enter the code sent to your phone
                    </p>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={otp}
                      onChange={(e) => {
                        setError(null)
                        setOtp(e.target.value)
                      }}
                      placeholder="6-digit code"
                      className={`${FIELD} px-3 text-center tracking-[0.4em]`}
                    />
                  </div>
                )}

                {/* Manual rails: screenshot upload */}
                {((method === 'usdt' && USDT_ADDRESS) || (method === 'momo' && momoAvailable)) && (
                  <div className="space-y-2">
                    <p className={SECTION_LABEL}>
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

                {pinPrompt && (
                  <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-foreground">
                    {/* Spin only while something is actually in flight. "Enter
                        the code" is a prompt for the player to act on, and a
                        spinner beside it reads as "the app is busy, wait". */}
                    {waiting ? (
                      <Loader2 className="w-4 h-4 mt-0.5 shrink-0 animate-spin text-primary" />
                    ) : (
                      <Smartphone className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                    )}
                    <span>{pinPrompt}</span>
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
                  otpReference ? (
                    <div className="space-y-2">
                      <Button
                        onClick={submitOtp}
                        disabled={busy || !profile}
                        className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_8px_24px_-10px_var(--primary)] font-bold shadow-card hover:shadow-card-hover transition-all disabled:opacity-60"
                      >
                        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm code'}
                      </Button>
                      <button
                        type="button"
                        onClick={() => {
                          setOtpReference(null)
                          setOtp('')
                          setPinPrompt(null)
                          setError(null)
                        }}
                        className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Start over
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Button
                        onClick={handleInstantMomo}
                        disabled={busy || profileLoading || !profile}
                        className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_8px_24px_-10px_var(--primary)] font-bold shadow-card hover:shadow-card-hover hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-60 disabled:hover:translate-y-0"
                      >
                        {busy ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <Smartphone className="w-4 h-4" />
                            {amountValue > 0
                              ? `Pay ${currency} ${formatMoney(amountValue, currency)} with ${activeNetwork.short}`
                              : `Pay with ${activeNetwork.short}`}
                          </>
                        )}
                      </Button>
                      {CARD_FALLBACK_ENABLED && (
                        <button
                          type="button"
                          onClick={handleCard}
                          disabled={busy || profileLoading || !profile}
                          className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
                        >
                          Pay with card instead
                        </button>
                      )}
                    </div>
                  )
                ) : (
                  <Button
                    onClick={() => handleManual(method === 'momo' ? 'momo' : 'usdt')}
                    disabled={
                      busy ||
                      profileLoading ||
                      !profile ||
                      (method === 'momo' ? !momoAvailable : !USDT_ADDRESS)
                    }
                    className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_8px_24px_-10px_var(--primary)] font-bold shadow-card hover:shadow-card-hover hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    {busy ? (
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

function friendlyStatus(status: string): string {
  switch (status) {
    case 'failed':
    case 'declined':
      return 'The charge was declined. Check your balance and try again.'
    case 'expired':
      return 'The payment request expired before it was approved. Try again.'
    case 'cancelled':
    case 'abandoned':
      return 'The payment was cancelled before it was approved. Try again.'
    case 'amount-mismatch':
      return 'The amount received didn\'t match. Contact support with your reference.'
    case 'verify-failed':
      return 'We couldn\'t reach the gateway to confirm your payment. Try again in a moment.'
    default:
      return 'The payment didn\'t complete. Try again or contact support.'
  }
}

function Row({
  label,
  value,
  tone,
  bold,
}: {
  label: string
  value: string
  tone?: 'good' | 'neutral'
  bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`text-sm tabular-nums ${bold ? 'font-bold' : 'font-semibold'} ${
          tone === 'good' ? 'text-success' : 'text-foreground'
        }`}
      >
        {value}
      </span>
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
      className={`relative flex flex-col items-start gap-1 rounded-xl border p-2.5 sm:p-3 text-left transition-all active:scale-[0.98] ${
        active
          ? 'border-primary bg-primary/15 ring-1 ring-primary/40'
          : 'border-border bg-secondary/60 hover:bg-secondary hover:border-primary/40'
      }`}
    >
      {badge && (
        <>
          {/* Three tabs at 360px leave no room for a word here, so the badge
              collapses to a dot and keeps its meaning for screen readers. */}
          <span
            aria-hidden
            className="sm:hidden absolute top-2 right-2 w-2 h-2 rounded-full bg-primary"
          />
          <span className="hidden sm:block absolute top-2 right-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
            {badge}
          </span>
          <span className="sr-only">{badge}</span>
        </>
      )}
      <span
        className={`inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg transition-colors ${
          active ? 'bg-primary text-primary-foreground' : 'bg-background text-primary'
        }`}
      >
        {icon}
      </span>
      <span className="text-xs sm:text-sm font-bold text-foreground leading-tight">{title}</span>
      <span className="text-[10px] sm:text-caption text-muted-foreground leading-tight">
        {subtitle}
      </span>
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
