'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CalendarDays, ChevronRight, Gamepad2 } from 'lucide-react'
import { Header } from '@/components/header'
import { SportsSidebar } from '@/components/sports-sidebar'
import { BetSlip } from '@/components/bet-slip'
import { MatchCard } from '@/components/match-card'
import { MatchListSkeleton } from '@/components/match-card-skeleton'
import { PromoCarousel } from '@/components/promo-carousel'
import { LeaguesWithUpcoming } from '@/components/top-events'
import { MobileNav } from '@/components/mobile-nav'
import { HomeBalanceCard } from '@/components/home-balance-card'
import { WinnersTicker } from '@/components/winners-ticker'
import { SectionHeader } from '@/components/section-header'
import { useMatches } from '@/hooks/use-matches'
import { removeSelectionById, toggleSelection } from '@/lib/bet-slip-utils'
import { towerCoeffAt } from '@/lib/tower-rush'
import { spinxpressHref } from '@/lib/spinxpress'
import { getUserId } from '@/lib/user-session'
import type { BetSelection } from '@/lib/types'

export default function HomePage() {
  const [activeSport, setActiveSport] = useState('football')
  const [userId, setUserId] = useState<string | null>(null)
  useEffect(() => setUserId(getUserId()), [])
  const [selections, setSelections] = useState<BetSelection[]>([])

  const { matches, liveMatches, upcomingMatches, loading, error } =
    useMatches(activeSport, { todayOnly: true })

  const handleToggleSelection = (sel: BetSelection) =>
    setSelections((prev) => toggleSelection(prev, sel))

  const handleRemoveSelection = (id: string) =>
    setSelections((prev) => removeSelectionById(prev, id))

  const handleClearAll = () => setSelections([])

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="flex">
        <SportsSidebar activeSport={activeSport} onSportChange={setActiveSport} />

        <main className="flex-1 min-w-0 min-h-[calc(100vh-64px)] pb-20 xl:pb-0">
          <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-5 lg:p-6 space-y-6">
            <HomeBalanceCard />

            <WinnersTicker />

            <PromoCarousel />

            {/* Casino games entry */}
            <Link
              href={spinxpressHref(userId)}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block overflow-hidden rounded-xl border border-border bg-gradient-to-r from-[#1f3a93] to-[#2563eb] p-4 shadow-card hover:shadow-card-hover transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <Gamepad2 className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white flex items-center gap-2">
                    Tower Rush
                    <span className="text-[10px] font-bold uppercase bg-[#ffd54a] text-[#3a2a00] px-1.5 py-0.5 rounded">New</span>
                  </p>
                  <p className="text-xs text-white/70 truncate">Stack the tower, cash out before it collapses. Min x{towerCoeffAt(1).toFixed(2)} · max unlimited.</p>
                </div>
                <ChevronRight className="w-5 h-5 text-white/80 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>

            <LeaguesWithUpcoming matches={matches} />

            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive flex items-start gap-2 shadow-card">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Failed to load matches: {error}</span>
              </div>
            )}

            <section id="live">
              <SectionHeader
                title="Live Now"
                icon={
                  <span className="w-2 h-2 bg-live rounded-full animate-pulse-live" />
                }
                count={liveMatches.length}
                viewAllHref="/live"
              />
              {loading ? (
                <MatchListSkeleton count={4} />
              ) : liveMatches.length === 0 ? (
                <EmptyState
                  title="No live matches right now"
                  description="Browse upcoming games below or check live again in a few minutes."
                />
              ) : (
                <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                  {liveMatches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      selections={selections}
                      onToggleSelection={handleToggleSelection}
                    />
                  ))}
                </div>
              )}
            </section>

            <section>
              <SectionHeader
                title="Today's upcoming games"
                description="Kicking off today across every league"
                icon={<CalendarDays className="w-4 h-4 text-primary" />}
                count={upcomingMatches.length}
                viewAllHref="/football"
              />
              {loading ? (
                <MatchListSkeleton count={6} />
              ) : upcomingMatches.length === 0 ? (
                <EmptyState
                  title="No matches scheduled for today"
                  description="Check the football page for the full upcoming list."
                />
              ) : (
                <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                  {upcomingMatches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      selections={selections}
                      onToggleSelection={handleToggleSelection}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>

        <div className="hidden xl:flex flex-col w-80">
          <BetSlip
            selections={selections}
            onRemoveSelection={handleRemoveSelection}
            onClearAll={handleClearAll}
            onLoadSelections={setSelections}
          />
        </div>
      </div>

      <MobileNav
        selectedBets={selections}
        onRemoveSelection={handleRemoveSelection}
        onClearAll={handleClearAll}
        onLoadSelections={setSelections}
      />
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-card border border-dashed border-border rounded-xl p-8 text-center">
      <p className="font-semibold text-sm text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
  )
}
