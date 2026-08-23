'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  Copy,
  Check,
  LogOut,
  Loader2,
  Users,
  Wallet,
  Banknote,
  Coins,
  AlertTriangle,
  ArrowRightLeft,
  Ticket,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/format-money'
import { saveUserSession } from '@/lib/user-session'

/** "GHS 12.34 · NGN 5,000.00" — single-line summary of a currency map. */
function formatCurrencyMap(map: Record<string, number> | undefined): string {
  if (!map) return '—'
  const entries = Object.entries(map).filter(([, v]) => v > 0)
  if (entries.length === 0) return '—'
  return entries.map(([cur, amt]) => `${cur} ${formatMoney(amt, cur)}`).join(' · ')
}

interface MeResponse {
  subAdmin: {
    id: string
    name: string
    email: string
    referralCode: string
    approved: boolean
    commissionBalance: number
    totalCommissionEarned: number
    commissionBalances: Record<string, number>
    totalCommissionEarnedBy: Record<string, number>
    createdAt: string
  }
  stats: {
    referrals: number
    withDeposit: number
    pending: number
    commissionsCount: number
  }
  referredUsers: {
    id: string
    name: string
    email: string
    currency: string
    createdAt: string
    firstDepositAmount: number
    firstDepositAt?: string
    totalDeposited: number
  }[]
  commissions: {
    id: string
    userId: string
    depositAmount: number
    commission: number
    currency: string
    rate: number
    createdAt: string
  }[]
  withdrawals: {
    id: string
    userId: string | null
    userName: string
    amount: number
    currency: string
    status: 'pending' | 'success' | 'failed' | 'cancelled'
    createdAt: string
  }[]
}

interface WalletResponse {
  wallet: { id: string; name: string; balance: number; currency: string }
  /** Commission in the wallet's currency — the only part that can be moved. */
  available: number
}

export default function SubAdminDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<MeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [wallet, setWallet] = useState<WalletResponse | null>(null)
  const [topUp, setTopUp] = useState<number | ''>('')
  const [moving, setMoving] = useState(false)
  const [walletMsg, setWalletMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [walletError, setWalletError] = useState<string | null>(null)
  const [cashOut, setCashOut] = useState<number | ''>('')
  const [payoutPhone, setPayoutPhone] = useState('')
  const [payoutNetwork, setPayoutNetwork] = useState('mtn')
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawMsg, setWithdrawMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)

  const loadWallet = async () => {
    try {
      const res = await fetch('/api/sub-admin/wallet', { cache: 'no-store' })
      if (!res.ok) {
        // An empty card with no explanation is worse than none — this is what
        // a missing `sub_admins.user_id` column looks like from out here.
        const d = await res.json().catch(() => ({}))
        setWalletError(
          d.error
            ? `Wallet unavailable: ${d.error}`
            : 'Your betting wallet could not be opened. Contact the admin.',
        )
        return
      }
      setWalletError(null)
      const w = (await res.json()) as WalletResponse
      setWallet(w)
      // The rest of the site reads the player session from here, so refreshing
      // the dashboard is enough to make betting work in the same browser.
      saveUserSession(w.wallet.id, w.wallet.name)
    } catch {
      setWalletError('Your betting wallet could not be reached. Try again shortly.')
    }
  }

  async function moveCommission() {
    const amount = Number(topUp)
    if (!Number.isFinite(amount) || amount <= 0) {
      setWalletMsg({ tone: 'bad', text: 'Enter an amount greater than zero.' })
      return
    }
    setMoving(true)
    setWalletMsg(null)
    try {
      const res = await fetch('/api/sub-admin/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setWalletMsg({ tone: 'bad', text: d.error ?? 'Transfer failed.' })
        return
      }
      setWalletMsg({
        tone: 'ok',
        text: `${d.currency} ${formatMoney(d.moved, d.currency)} moved to your betting wallet.`,
      })
      setTopUp('')
      // Both numbers changed — commission down, wallet up.
      await Promise.all([load(), loadWallet()])
    } catch (e) {
      setWalletMsg({ tone: 'bad', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setMoving(false)
    }
  }

  async function requestWithdrawal() {
    const amount = Number(cashOut)
    if (!Number.isFinite(amount) || amount <= 0) {
      setWithdrawMsg({ tone: 'bad', text: 'Enter an amount greater than zero.' })
      return
    }
    if (!payoutPhone.trim()) {
      setWithdrawMsg({ tone: 'bad', text: 'Enter the mobile-money number to pay.' })
      return
    }
    setWithdrawing(true)
    setWithdrawMsg(null)
    try {
      const res = await fetch('/api/sub-admin/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, phone: payoutPhone.trim(), network: payoutNetwork }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setWithdrawMsg({ tone: 'bad', text: d.error ?? 'Withdrawal failed.' })
        return
      }
      setWithdrawMsg({ tone: 'ok', text: d.message ?? 'Withdrawal requested.' })
      setCashOut('')
      await loadWallet()
    } catch (e) {
      setWithdrawMsg({ tone: 'bad', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setWithdrawing(false)
    }
  }

  const load = async () => {
    try {
      const res = await fetch('/api/sub-admin/me', { cache: 'no-store' })
      if (res.status === 401) {
        router.push('/sub-admin/login?next=/sub-admin/dashboard')
        return
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? `HTTP ${res.status}`)
      }
      setData((await res.json()) as MeResponse)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    void load()
    void loadWallet()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogout = async () => {
    await fetch('/api/sub-admin/logout', { method: 'POST' })
    router.push('/sub-admin/login')
    router.refresh()
  }

  const copy = async (text: string, kind: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      /* ignore */
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-3xl mx-auto p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          Failed to load dashboard: {error}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    )
  }

  const sa = data.subAdmin
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const referralLink = `${origin}/register?ref=${sa.referralCode}`

  // Sum commissions whose createdAt falls in the current local day.
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayCommissions: Record<string, number> = {}
  let todayCount = 0
  for (const c of data.commissions) {
    if (new Date(c.createdAt) >= todayStart) {
      todayCommissions[c.currency] = +(((todayCommissions[c.currency] ?? 0) + c.commission)).toFixed(2)
      todayCount++
    }
  }

  // Total successfully withdrawn by referred users, per currency.
  const withdrawnByCurrency: Record<string, number> = {}
  let withdrawnCount = 0
  for (const w of data.withdrawals) {
    if (w.status !== 'success') continue
    withdrawnByCurrency[w.currency] = +(((withdrawnByCurrency[w.currency] ?? 0) + w.amount)).toFixed(2)
    withdrawnCount++
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex items-center" aria-label="PowerStakeBet home">
              <Image
                src="/powerstakebet-logo.svg"
                alt="PowerStakeBet"
                width={360}
                height={104}
                className="logo-img h-7 w-auto"
              />
            </Link>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded-full px-2 py-0.5 shrink-0">
              Partner
            </span>
            <span className="text-sm text-foreground truncate hidden sm:inline">
              {sa.name}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* A partner is also a player. This is here rather than only inside
                the wallet card so it survives the wallet failing to load. */}
            <Button asChild size="sm" className="gap-2">
              <Link href="/">
                <Ticket className="w-4 h-4" />
                <span className="hidden sm:inline">Bet</span>
              </Link>
            </Button>
            <Button onClick={handleLogout} variant="outline" size="sm" className="gap-2">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        {!sa.approved && (
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-warning" />
            <div className="text-warning">
              Your account is awaiting approval. Referrals already work, but commissions
              won&apos;t be credited until the main admin approves you.
            </div>
          </div>
        )}

        {/* Referral code + link */}
        <section className="bg-card border border-border rounded-xl p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                Your referral code
              </p>
              <div className="flex items-center gap-2 mt-1">
                <p className="font-mono text-3xl font-bold tracking-widest text-primary">
                  {sa.referralCode}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void copy(sa.referralCode, 'code')}
                  className="h-8 gap-1.5"
                >
                  {copied === 'code' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-success" />
                      <span className="text-success">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy code</span>
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Earn <b>65%</b> commission on every deposit from each referred user.
              </p>
            </div>
            <div className="flex-1 lg:max-w-md">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">
                Share this link
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={referralLink}
                  className="flex-1 px-3 py-2 bg-secondary border border-border rounded-md text-xs font-mono truncate"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void copy(referralLink, 'link')}
                  className="h-9 gap-1.5"
                >
                  {copied === 'link' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-success" />
                      <span className="hidden sm:inline text-success">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Copy link</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* KPI tiles */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi
            icon={<Users className="w-4 h-4 text-primary" />}
            label="Referrals"
            value={data.stats.referrals.toString()}
            sub={`${data.stats.withDeposit} with deposit`}
          />
          <Kpi
            icon={<Wallet className="w-4 h-4 text-success" />}
            label="Commission balance"
            value={formatCurrencyMap(sa.commissionBalances)}
            sub="payable now"
            tone="good"
          />
          <Kpi
            icon={<Coins className="w-4 h-4 text-muted-foreground" />}
            label="Today's commission"
            value={formatCurrencyMap(todayCommissions)}
            sub={`${todayCount} deposit${todayCount === 1 ? '' : 's'} today`}
          />
          <Kpi
            icon={<Banknote className="w-4 h-4 text-muted-foreground" />}
            label="Users' withdrawals"
            value={formatCurrencyMap(withdrawnByCurrency)}
            sub={`${withdrawnCount} paid out`}
          />
        </section>

        {/* My betting wallet */}
        <section className="bg-card border border-border rounded-xl p-4 space-y-3">
          <header className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" />
                My betting wallet
              </h2>
              <p className="text-xs text-muted-foreground">
                Move your commission here to stake it. Same account, same login.
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-bold tabular-nums">
                {wallet
                  ? `${wallet.wallet.currency} ${formatMoney(wallet.wallet.balance, wallet.wallet.currency)}`
                  : '—'}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">balance</p>
            </div>
          </header>

          {wallet && (
            <>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                    {wallet.wallet.currency}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={wallet.available}
                    value={topUp}
                    onChange={(e) => {
                      setWalletMsg(null)
                      const n = Number(e.target.value)
                      setTopUp(e.target.value === '' ? '' : Number.isFinite(n) ? n : '')
                    }}
                    placeholder={`Up to ${formatMoney(wallet.available, wallet.wallet.currency)}`}
                    className="w-full h-11 pl-14 pr-3 rounded-xl border border-border bg-background text-foreground text-base font-semibold tabular-nums outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
                  />
                </div>
                <Button
                  onClick={moveCommission}
                  disabled={moving || wallet.available <= 0}
                  className="h-11 px-4 font-semibold shrink-0"
                >
                  {moving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ArrowRightLeft className="w-4 h-4" />
                      Move to wallet
                    </>
                  )}
                </Button>
                <Button asChild variant="secondary" className="h-11 px-4 font-semibold shrink-0">
                  <Link href="/">
                    <Ticket className="w-4 h-4" />
                    Place a bet
                  </Link>
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                {wallet.available > 0 ? (
                  <>
                    {wallet.wallet.currency}{' '}
                    <span className="font-semibold text-foreground tabular-nums">
                      {formatMoney(wallet.available, wallet.wallet.currency)}
                    </span>{' '}
                    available to move.
                  </>
                ) : (
                  <>
                    No {wallet.wallet.currency} commission to move yet. Commission earned in other
                    currencies is paid out by the admin.
                  </>
                )}
              </p>

              {walletMsg && (
                <p
                  className={`text-xs font-medium ${
                    walletMsg.tone === 'ok' ? 'text-primary' : 'text-destructive'
                  }`}
                >
                  {walletMsg.text}
                </p>
              )}

              {/* Cash out to mobile money */}
              <div className="pt-3 border-t border-border space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-foreground/70">
                  Withdraw to mobile money
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={cashOut}
                    onChange={(e) => {
                      setWithdrawMsg(null)
                      const n = Number(e.target.value)
                      setCashOut(e.target.value === '' ? '' : Number.isFinite(n) ? n : '')
                    }}
                    placeholder={`Amount (${wallet.wallet.currency})`}
                    className="h-11 px-3 rounded-xl border border-border bg-background text-foreground text-base font-semibold tabular-nums outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
                  />
                  <input
                    type="tel"
                    inputMode="tel"
                    value={payoutPhone}
                    onChange={(e) => {
                      setWithdrawMsg(null)
                      setPayoutPhone(e.target.value)
                    }}
                    placeholder="MoMo number"
                    className="h-11 px-3 rounded-xl border border-border bg-background text-foreground text-base font-semibold outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
                  />
                  <select
                    value={payoutNetwork}
                    onChange={(e) => setPayoutNetwork(e.target.value)}
                    className="h-11 px-3 rounded-xl border border-border bg-background text-foreground text-sm font-semibold outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
                  >
                    <option value="mtn">MTN MoMo</option>
                    <option value="telecel">Telecel Cash</option>
                    <option value="airteltigo">AirtelTigo</option>
                  </select>
                  <Button
                    onClick={requestWithdrawal}
                    disabled={withdrawing || (wallet.wallet.balance ?? 0) <= 0}
                    variant="secondary"
                    className="h-11 font-semibold"
                  >
                    {withdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Withdraw'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Paid by hand once an operator approves it, same as a player payout. You are
                  texted and emailed when the money is sent.
                </p>
                {withdrawMsg && (
                  <p
                    className={`text-xs font-medium ${
                      withdrawMsg.tone === 'ok' ? 'text-primary' : 'text-destructive'
                    }`}
                  >
                    {withdrawMsg.text}
                  </p>
                )}
              </div>
            </>
          )}

          {!wallet && (
            <p className="text-xs text-muted-foreground">
              {walletError ?? 'Opening your wallet…'}
            </p>
          )}
        </section>

        {/* Referred users table */}
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <header className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold">Referred users ({data.referredUsers.length})</h2>
            <p className="text-xs text-muted-foreground">
              Users who registered with your code. Commission fires on every deposit they make.
            </p>
          </header>
          {data.referredUsers.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No referrals yet. Share your code or link to get started.
            </p>
          ) : (
            <>
              <div className="hidden md:grid grid-cols-[1fr_180px_120px_120px_120px] gap-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border bg-secondary/40">
                <span>User</span>
                <span>Signed up</span>
                <span className="text-right">First deposit</span>
                <span className="text-right">Total deposited</span>
                <span className="text-right">Today&apos;s commission</span>
              </div>
              <ul className="divide-y divide-border">
                {data.referredUsers.map((u) => {
                  const userCommissions = data.commissions.filter(
                    (c) => c.userId === u.id && new Date(c.createdAt) >= todayStart,
                  )
                  const totalCommission = userCommissions.reduce((sum, c) => sum + c.commission, 0)
                  const commissionCurrency = userCommissions[0]?.currency ?? u.currency
                  return (
                    <li key={u.id} className="px-4 py-3">
                      <div className="md:grid md:grid-cols-[1fr_180px_120px_120px_120px] md:gap-3 md:items-center flex flex-col gap-1">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{u.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {new Date(u.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <div className="md:text-right">
                          {u.firstDepositAt ? (
                            <p className="text-sm font-bold tabular-nums">
                              {u.currency} {formatMoney(u.firstDepositAmount, u.currency)}
                            </p>
                          ) : (
                            <span className="text-xs text-muted-foreground">Pending</span>
                          )}
                        </div>
                        <p className="md:text-right text-sm tabular-nums">
                          {u.currency} {formatMoney(u.totalDeposited, u.currency)}
                        </p>
                        <p
                          className={`md:text-right text-sm font-bold tabular-nums ${
                            userCommissions.length > 0 ? 'text-success' : 'text-muted-foreground'
                          }`}
                        >
                          {userCommissions.length > 0
                            ? `+${commissionCurrency} ${formatMoney(totalCommission, commissionCurrency)}`
                            : '—'}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </section>

        {/* Withdrawals by referred users */}
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <header className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Banknote className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <h2 className="font-semibold">Withdrawals ({data.withdrawals.length})</h2>
              <p className="text-xs text-muted-foreground">
                Payouts requested by the users you referred.
              </p>
            </div>
          </header>
          {data.withdrawals.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No withdrawals from your referred users yet.
            </p>
          ) : (
            <>
              <div className="hidden md:grid grid-cols-[1fr_180px_140px_120px] gap-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border bg-secondary/40">
                <span>User</span>
                <span>Requested</span>
                <span className="text-right">Amount</span>
                <span className="text-right">Status</span>
              </div>
              <ul className="divide-y divide-border">
                {data.withdrawals.map((w) => (
                  <li key={w.id} className="px-4 py-3">
                    <div className="md:grid md:grid-cols-[1fr_180px_140px_120px] md:gap-3 md:items-center flex flex-col gap-1">
                      <p className="font-medium text-sm truncate">{w.userName}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {new Date(w.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="md:text-right text-sm font-bold tabular-nums">
                        {w.currency} {formatMoney(w.amount, w.currency)}
                      </p>
                      <div className="md:text-right">
                        <StatusBadge status={w.status} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </main>
    </div>
  )
}

function StatusBadge({ status }: { status: 'pending' | 'success' | 'failed' | 'cancelled' }) {
  const map = {
    success: { label: 'Paid', cls: 'bg-success/10 text-success border-success/20' },
    pending: { label: 'Pending', cls: 'bg-warning/10 text-warning border-warning/20' },
    failed: { label: 'Failed', cls: 'bg-destructive/10 text-destructive border-destructive/20' },
    cancelled: { label: 'Cancelled', cls: 'bg-secondary text-muted-foreground border-border' },
  }[status]
  return (
    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${map.cls}`}>
      {map.label}
    </span>
  )
}

function Kpi({
  icon,
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  tone?: 'good' | 'bad' | 'neutral'
}) {
  const color =
    tone === 'good'
      ? 'text-success'
      : tone === 'bad'
        ? 'text-destructive'
        : 'text-foreground'
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
          {label}
        </p>
        {icon}
      </div>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}
