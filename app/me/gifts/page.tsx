'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Gift, Sparkles, Trophy } from 'lucide-react'
import { MobileNav } from '@/components/mobile-nav'
import { MeSubpageHeader } from '@/components/me-subpage-header'
import { getUserId } from '@/lib/user-session'
import { formatMoney } from '@/lib/format-money'
import {
  DEFAULT_CURRENCY,
  isCurrencyCode,
  type CurrencyCode,
} from '@/lib/countries'

// Same per-currency amounts as the promo carousel so messaging stays
// consistent. Keep this map in sync with components/promo-carousel.tsx.
const FIRST_DEPOSIT_MAX: Record<CurrencyCode, number> = {
  GHS: 500,
  NGN: 75_000,
  KES: 6_500,
  ZAR: 900,
}
const REFERRAL_AMOUNT: Record<CurrencyCode, number> = {
  GHS: 50,
  NGN: 7_500,
  KES: 650,
  ZAR: 90,
}
const WEEKEND_PRIZE: Record<CurrencyCode, number> = {
  GHS: 3_000,
  NGN: 450_000,
  KES: 39_000,
  ZAR: 5_400,
}

function pick<T>(map: Record<CurrencyCode, T>, currency: CurrencyCode): T {
  return map[currency] ?? map[DEFAULT_CURRENCY]
}

export default function GiftsPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY)

  useEffect(() => {
    const uid = getUserId()
    setUserId(uid)
    if (!uid) return
    void fetch(`/api/users/${uid}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && isCurrencyCode(data.currency)) setCurrency(data.currency)
      })
      .catch(() => {})
  }, [])

  const depositHref = userId ? `/users/first-deposit?userId=${userId}` : '/register'

  const offers = [
    {
      id: 'first-deposit',
      eyebrow: 'First Deposit Bonus',
      headline: '100%',
      caption: `Match your first deposit up to ${currency} ${formatMoney(pick(FIRST_DEPOSIT_MAX, currency), currency)}.`,
      gradient: 'from-amber-500 via-orange-500 to-red-600',
      Icon: Trophy,
      cta: 'Claim now',
      href: depositHref,
    },
    {
      id: 'refer',
      eyebrow: 'Refer a Friend',
      headline: `${currency} ${formatMoney(pick(REFERRAL_AMOUNT, currency), currency)}`,
      caption: 'Earned every time a friend you invite makes their first deposit.',
      gradient: 'from-emerald-500 via-teal-600 to-cyan-600',
      Icon: Gift,
      cta: 'Share my link',
      href: '/me/social',
    },
    {
      id: 'weekend',
      eyebrow: 'Weekend Booster',
      headline: `${currency} ${formatMoney(pick(WEEKEND_PRIZE, currency), currency)}`,
      caption: 'Place 5+ bets across the weekend — biggest wins go bigger.',
      gradient: 'from-violet-600 via-purple-600 to-fuchsia-600',
      Icon: Sparkles,
      cta: 'View live games',
      href: '/live',
    },
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20 max-w-lg mx-auto w-full">
      <MeSubpageHeader title="Gifts & Bonuses" />

      <main className="flex-1 px-3 sm:px-4 pt-4 space-y-3">
        {!userId && (
          <div className="bg-card border border-border rounded-xl p-3 text-xs text-muted-foreground shadow-card">
            <span className="text-foreground font-semibold">Sign in</span> to lock in
            these offers — bonuses credit to your wallet once your account is verified.
          </div>
        )}

        {offers.map((o) => {
          const Glyph = o.Icon
          const headlineLong = o.headline.length > 8
          return (
            <Link
              key={o.id}
              href={o.href}
              className="group block rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
            >
              <div className={`relative bg-gradient-to-br ${o.gradient} text-white overflow-hidden`}>
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-[0.12]"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                    backgroundSize: '14px 14px',
                  }}
                />
                <div aria-hidden className="absolute -right-12 -top-10 w-44 h-44 rounded-full bg-white/15 blur-2xl" />
                <div className="relative p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-white/85">
                      {o.eyebrow}
                    </p>
                    <p
                      className="mt-1 font-black leading-none tabular-nums drop-shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
                      style={{
                        fontSize: headlineLong ? 'clamp(1.5rem, 5.5vw, 2.25rem)' : 'clamp(2rem, 8vw, 2.75rem)',
                      }}
                    >
                      {o.headline}
                    </p>
                    <p className="text-[11px] text-white/85 mt-1.5">{o.caption}</p>
                    <span className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-foreground font-bold text-xs shadow-md group-hover:translate-y-0">
                      {o.cta}
                      <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </span>
                  </div>
                  <Glyph
                    className="w-20 h-20 text-white/30 shrink-0"
                    strokeWidth={1.25}
                  />
                </div>
              </div>
            </Link>
          )
        })}

        <div className="bg-card border border-dashed border-border rounded-xl p-6 text-center mt-4">
          <p className="font-semibold text-sm">No more gifts right now</p>
          <p className="text-xs text-muted-foreground mt-1">Check back during the next campaign — new offers appear here.</p>
        </div>
      </main>

      <MobileNav selectedBets={[]} activeTab="me" />
    </div>
  )
}
