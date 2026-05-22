'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Trophy, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MatchList } from '@/components/match-list'
import { BetSlip } from '@/components/bet-slip'
import { MobileNav } from '@/components/mobile-nav'
import { useMatches } from '@/hooks/use-matches'
import { getLeagueMeta } from '@/lib/leagues-meta'
import { removeSelectionById, toggleSelection } from '@/lib/bet-slip-utils'
import type { BetSelection } from '@/lib/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function LeagueDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const meta = getLeagueMeta(id)
  if (!meta) notFound()

  const [selectedBets, setSelectedBets] = useState<BetSelection[]>([])
  const { matches, loading } = useMatches(meta.sport)

  const filtered = matches.filter((m) =>
    meta.matchFilters.some((f) => m.league.toLowerCase().includes(f.toLowerCase())),
  )
  const liveCount = filtered.filter((m) => m.isLive).length

  const handleToggleSelection = (sel: BetSelection) =>
    setSelectedBets((prev) => toggleSelection(prev, sel))

  const handleRemoveSelection = (id: string) =>
    setSelectedBets((prev) => removeSelectionById(prev, id))

  return (
    <div className="min-h-screen bg-background pb-20 xl:pb-0">
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="max-w-[1400px] mx-auto px-4">
          <div className="flex items-center h-14 gap-4">
            <Link
              href="/leagues"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-2xl shrink-0">{meta.flag}</span>
              <h1 className="text-xl font-bold text-foreground truncate">{meta.name}</h1>
            </div>
            <span className="text-sm text-muted-foreground hidden sm:inline">{meta.country}</span>
            <div className="ml-auto flex items-center gap-2">
              <Link href="/login">
                <Button variant="outline" size="sm" className="hidden sm:flex">
                  Login
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="hidden sm:flex bg-primary text-primary-foreground">
                  Register
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 py-4">
        <div className="flex gap-6">
          <main className="flex-1 min-w-0">
            {/* Hero stats */}
            <div className="bg-card border border-border rounded-xl p-5 mb-6 flex items-center gap-5">
              <div className="w-16 h-16 bg-secondary rounded-xl flex items-center justify-center text-3xl shrink-0">
                {meta.flag}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-foreground truncate">{meta.name}</h2>
                <p className="text-sm text-muted-foreground">{meta.country}</p>
              </div>
              <div className="ml-auto grid grid-cols-2 gap-4 text-right">
                <div>
                  <p className="text-2xl font-bold text-foreground">{filtered.length}</p>
                  <p className="text-xs text-muted-foreground">matches</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{liveCount}</p>
                  <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                    {liveCount > 0 && (
                      <span className="w-1.5 h-1.5 bg-live rounded-full animate-pulse-live" />
                    )}
                    live
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">Matches</h3>
            </div>

            {loading ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Loading matches…
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                No matches.
              </div>
            ) : (
              <MatchList
                matches={filtered}
                selectedBets={selectedBets}
                onToggleSelection={handleToggleSelection}
                showLeague={false}
              />
            )}
          </main>

          <aside className="hidden lg:block w-80 shrink-0">
            <div className="sticky top-20">
              <BetSlip
                selections={selectedBets}
                onRemoveSelection={handleRemoveSelection}
                onClearAll={() => setSelectedBets([])}
                onLoadSelections={setSelectedBets}
              />
            </div>
          </aside>
        </div>
      </div>

      <MobileNav
        selectedBets={selectedBets}
        onRemoveSelection={handleRemoveSelection}
        onClearAll={() => setSelectedBets([])}
        onLoadSelections={setSelectedBets}
      />
    </div>
  )
}
