'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, Gift, Share2, UserPlus, Users } from 'lucide-react'
import { MobileNav } from '@/components/mobile-nav'
import { MeSubpageHeader } from '@/components/me-subpage-header'
import { Skeleton } from '@/components/ui/skeleton'
import { getUserId } from '@/lib/user-session'

interface UserProfile {
  id: string
  name: string
  email: string
  referredByCode?: string
}

export default function SocialPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    setOrigin(typeof window !== 'undefined' ? window.location.origin : '')
    const uid = getUserId()
    setUserId(uid)
    if (!uid) return
    void fetch(`/api/users/${uid}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setProfile(data))
      .catch(() => {})
  }, [])

  if (!userId) {
    return (
      <div className="min-h-screen bg-background flex flex-col pb-20 max-w-lg mx-auto w-full">
        <MeSubpageHeader title="My Referrals" />
        <SignInGate />
        <MobileNav selectedBets={[]} activeTab="me" />
      </div>
    )
  }

  // Players don't own a referral code — only sub-admins do — so the share
  // link uses the user's account ID purely as an attribution param. If you
  // later make every player a referrer, swap this for their own code.
  const shareUrl = userId && origin ? `${origin}/register?from=${userId.slice(0, 8)}` : ''

  const copyLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20 max-w-lg mx-auto w-full">
      <MeSubpageHeader title="My Referrals" />

      <main className="flex-1 px-3 sm:px-4 pt-4 space-y-4">
        {/* Hero invite card */}
        <section className="relative rounded-2xl bg-gradient-to-br from-card via-card to-secondary/30 border border-border shadow-card overflow-hidden">
          <div aria-hidden className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <UserPlus className="w-4 h-4 text-primary" />
              </span>
              <p className="text-eyebrow text-muted-foreground">Invite friends</p>
            </div>
            <h2 className="text-title font-bold tracking-tight mb-1">
              Bring your crew to Prime Bet
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Share your invite link. When your friends sign up and make their first
              deposit, both of you get noticed by the team for future bonuses.
            </p>

            <div className="bg-secondary border border-border rounded-xl p-2 flex items-center gap-2">
              {!shareUrl ? (
                <Skeleton className="h-7 flex-1 rounded-md" />
              ) : (
                <code className="text-xs font-mono text-foreground truncate flex-1 px-1">
                  {shareUrl}
                </code>
              )}
              <button
                type="button"
                onClick={copyLink}
                disabled={!shareUrl}
                className="shrink-0 h-9 px-3 inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('Join me on Prime Bet — fastest betting in Africa.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary text-primary font-bold text-sm hover:bg-primary/10 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Share on Telegram
            </a>
          </div>
        </section>

        {/* Referred-by chip — visible only if the user signed up under a partner */}
        {profile?.referredByCode && (
          <section className="bg-card border border-border rounded-2xl p-4 shadow-card">
            <p className="text-eyebrow text-muted-foreground mb-2">You were referred by</p>
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-bold text-primary tracking-widest">
                  {profile.referredByCode}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Your deposits help support your referrer.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Want to be a partner? */}
        <section className="bg-card border border-border rounded-2xl p-4 shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Gift className="w-4 h-4 text-primary" />
            </span>
            <p className="text-eyebrow text-muted-foreground">Become a partner</p>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Earn <strong className="text-foreground">60 % commission</strong> on every deposit from
            people who sign up under your code. Apply once — approval is manual.
          </p>
          <Link
            href="/sub-admin/register"
            className="w-full h-11 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
          >
            Apply to be a partner
          </Link>
        </section>
      </main>

      <MobileNav selectedBets={[]} activeTab="me" />
    </div>
  )
}

function SignInGate() {
  return (
    <main className="flex-1 px-6 pt-12 pb-16 text-center max-w-sm mx-auto w-full">
      <div className="relative w-20 h-20 mx-auto mb-5">
        <div aria-hidden className="absolute inset-0 rounded-full bg-primary/15 blur-xl" />
        <div className="relative w-20 h-20 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center shadow-card">
          <Users className="w-9 h-9 text-primary" />
        </div>
      </div>
      <h2 className="text-title font-bold mb-1.5">Sign in to share</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Get your personal invite link.
      </p>
      <div className="flex gap-3">
        <Link href="/login" className="flex-1 h-12 inline-flex items-center justify-center rounded-xl border-2 border-primary text-primary font-bold hover:bg-primary/10 transition-colors">Login</Link>
        <Link href="/register" className="flex-1 h-12 inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all shadow-card hover:shadow-card-hover hover:-translate-y-0.5">Register</Link>
      </div>
    </main>
  )
}
