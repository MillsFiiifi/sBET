'use client'

import Link from 'next/link'
import {
  Banknote,
  Coins,
  HelpCircle,
  MessageCircle,
  ShieldCheck,
  Target,
  Trophy,
  Wallet,
} from 'lucide-react'
import { MobileNav } from '@/components/mobile-nav'
import { MeSubpageHeader } from '@/components/me-subpage-header'
import { SUPPORT_TELEGRAM_URL } from '@/lib/support'

const steps = [
  {
    Icon: Wallet,
    title: '1. Add funds',
    body: 'Open Deposit on the home page and pick an amount above the minimum for your country. Ghana uses Moolre; Nigeria, Kenya and South Africa use Paystack — both redirect to a hosted checkout, then bring you back here.',
  },
  {
    Icon: Target,
    title: '2. Pick your bets',
    body: 'Tap any odds button on a match card to add it to your slip. Combine selections across matches (an accumulator) to multiply the odds — and the risk.',
  },
  {
    Icon: Coins,
    title: '3. Set a stake',
    body: 'Open the bet slip and type how much you want to stake. We instantly compute the potential payout: stake × total odds.',
  },
  {
    Icon: Trophy,
    title: '4. Get paid on a win',
    body: 'If every selection wins, the full payout is credited to your balance. One losing leg loses the whole ticket — that\'s how accumulators work.',
  },
  {
    Icon: Banknote,
    title: '5. Withdraw to your account',
    body: 'After two qualifying deposits and admin approval, you can withdraw via mobile money (GH/KE) or bank transfer (NG/ZA) from Account → Withdraw.',
  },
] as const

const faqs = [
  {
    q: 'What does "1, X, 2" mean?',
    a: '1 = home team wins, X = the match ends in a draw, 2 = the away team wins. These are the three outcomes in the headline match market.',
  },
  {
    q: 'Why are some markets locked?',
    a: 'Once the kick-off is close or the match has started, the bookmaker freezes the odds. Locked tickets can\'t be added — pick a different match.',
  },
  {
    q: 'How long does a withdrawal take?',
    a: 'Withdrawals are reviewed and paid out by an operator. Once approved, mobile-money transfers usually land within minutes; bank transfers take a few hours.',
  },
  {
    q: 'Can I cash out a bet early?',
    a: 'Not yet. We settle every leg when the matches finish. Watch your bets resolve in the Bet History tab.',
  },
] as const

export default function HowToPlayPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col pb-20 max-w-lg mx-auto w-full">
      <MeSubpageHeader title="How to Play" />

      <main className="flex-1 px-3 sm:px-4 pt-4 space-y-4">
        {/* Steps */}
        <section className="space-y-2">
          <p className="text-eyebrow text-muted-foreground px-1">Five steps to your first win</p>
          {steps.map((s) => {
            const Icon = s.Icon
            return (
              <div
                key={s.title}
                className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3 shadow-card lift-on-hover"
              >
                <span className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-sm">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.body}</p>
                </div>
              </div>
            )
          })}
        </section>

        {/* Responsible play */}
        <section className="bg-card border border-border rounded-2xl p-4 shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-amber-500" />
            </span>
            <p className="text-eyebrow text-muted-foreground">Play responsibly</p>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Betting should be entertaining. Only stake money you can afford to
            lose, and never chase losses. If gambling stops being fun, take a
            break — and reach out to support if you need help setting limits.
          </p>
        </section>

        {/* FAQs */}
        <section className="bg-card border border-border rounded-2xl p-4 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="w-4 h-4 text-primary" />
            <p className="text-eyebrow text-muted-foreground">FAQ</p>
          </div>
          <ul className="space-y-3">
            {faqs.map((f) => (
              <li key={f.q}>
                <p className="font-semibold text-sm">{f.q}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.a}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Contact */}
        <Link
          href={SUPPORT_TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-card border border-border rounded-2xl p-4 shadow-card lift-on-hover"
        >
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <MessageCircle className="w-4 h-4 text-primary" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm">Still stuck? Talk to support</p>
              <p className="text-xs text-muted-foreground">Real human, average response under an hour on Telegram.</p>
            </div>
          </div>
        </Link>
      </main>

      <MobileNav selectedBets={[]} activeTab="me" />
    </div>
  )
}
