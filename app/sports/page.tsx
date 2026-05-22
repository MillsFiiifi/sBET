'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MatchList } from '@/components/match-list'
import { BetSlip } from '@/components/bet-slip'
import { MobileNav } from '@/components/mobile-nav'
import { sports } from '@/lib/mock-data'
import { useMatches } from '@/hooks/use-matches'
import { removeSelectionById, toggleSelection } from '@/lib/bet-slip-utils'
import type { BetSelection } from '@/lib/types'

export default function SportsPage() {
  const [selectedBets, setSelectedBets] = useState<BetSelection[]>([])
  const [activeSport, setActiveSport] = useState<string>('football')
  const [searchQuery, setSearchQuery] = useState('')

  const handleToggleSelection = (sel: BetSelection) =>
    setSelectedBets((prev) => toggleSelection(prev, sel))

  const handleRemoveSelection = (id: string) =>
    setSelectedBets((prev) => removeSelectionById(prev, id))

  const { matches: currentMatches, loading } = useMatches(activeSport)

  const filteredMatches = currentMatches.filter(match => {
    const matchesSearch =
      match.homeTeam.toLowerCase().includes(searchQuery.toLowerCase()) ||
      match.awayTeam.toLowerCase().includes(searchQuery.toLowerCase()) ||
      match.league.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesSearch
  })

  const totalLiveCount = currentMatches.filter(m => m.isLive).length

  return (
    <div className="min-h-screen bg-background pb-20 xl:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="max-w-[1400px] mx-auto px-4">
          <div className="flex items-center h-14 gap-4">
            <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-foreground">All Sports</h1>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <span className="w-2 h-2 bg-live rounded-full animate-pulse-live" />
              {totalLiveCount} Live
            </span>
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
          {/* Sports Sidebar */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="bg-card border border-border rounded-xl p-4 sticky top-20">
              <h2 className="font-semibold text-foreground mb-4">Sports</h2>
              <div className="space-y-1">
                {sports.map((sport) => {
                  const isActive = sport.id === activeSport
                  return (
                    <button
                      key={sport.id}
                      onClick={() => setActiveSport(sport.id)}
                      className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-secondary text-foreground'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <span className="text-lg">{sport.icon}</span>
                        <span>{sport.name}</span>
                      </span>
                      {isActive && (
                        <span className="flex items-center gap-2">
                          {totalLiveCount > 0 && (
                            <span className="w-2 h-2 bg-live rounded-full animate-pulse-live" />
                          )}
                          <span className="text-xs">{currentMatches.length}</span>
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Quick Links */}
              <hr className="my-4 border-border" />
              <div className="space-y-2">
                <Link
                  href="/live"
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-live rounded-full animate-pulse-live" />
                    Live Betting
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </Link>
                <Link
                  href="/leagues"
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors"
                >
                  <span>All Leagues</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </Link>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Search Bar */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search matches, teams, or leagues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card border-border"
              />
            </div>

            {/* Mobile Sport Tabs */}
            <div className="lg:hidden mb-4 flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {sports.map(sport => (
                <button
                  key={sport.id}
                  onClick={() => setActiveSport(sport.id)}
                  className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${
                    activeSport === sport.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border text-foreground'
                  }`}
                >
                  <span>{sport.icon}</span>
                  <span>{sport.name}</span>
                </button>
              ))}
            </div>

            {/* Sport Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              {sports.map((sport) => {
                const isActive = sport.id === activeSport
                return (
                  <button
                    key={sport.id}
                    onClick={() => setActiveSport(sport.id)}
                    className={`relative p-4 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-primary/10 border-primary'
                        : 'bg-card border-border hover:border-primary/50'
                    }`}
                  >
                    {isActive && totalLiveCount > 0 && (
                      <span className="absolute top-2 right-2 w-2 h-2 bg-live rounded-full animate-pulse-live" />
                    )}
                    <span className="text-3xl block mb-2">{sport.icon}</span>
                    <p className="text-sm font-medium text-foreground">{sport.name}</p>
                    {isActive && (
                      <p className="text-xs text-muted-foreground">
                        {currentMatches.length} matches
                      </p>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Current Sport Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {sports.find(s => s.id === activeSport)?.icon}
                </span>
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    {sports.find(s => s.id === activeSport)?.name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {filteredMatches.length} matches available
                  </p>
                </div>
              </div>
              {activeSport === 'football' && (
                <Link href="/football">
                  <Button variant="outline" size="sm" className="gap-1">
                    View All
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              )}
            </div>

            {/* Match List */}
            {loading ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <p className="text-muted-foreground">Loading matches…</p>
              </div>
            ) : filteredMatches.length > 0 ? (
              <MatchList
                matches={filteredMatches}
                selectedBets={selectedBets}
                onToggleSelection={handleToggleSelection}
              />
            ) : (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <p className="text-muted-foreground">No matches.</p>
              </div>
            )}
          </main>

          {/* Bet Slip Sidebar */}
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

      {/* Mobile Navigation */}
      <MobileNav
        selectedBets={selectedBets}
        onRemoveSelection={handleRemoveSelection}
        onClearAll={() => setSelectedBets([])}
        onLoadSelections={setSelectedBets}
      />
    </div>
  )
}
