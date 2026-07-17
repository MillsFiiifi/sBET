'use client'

import { useState } from 'react'
import { MatchVisualization } from './match-visualization'
import { MatchStatistics } from './match-statistics'
import { BettingPanel } from './betting-panel'
import type { UiMatch } from '@/lib/ui-match'
import { ChevronLeft, Share2, MessageSquare } from 'lucide-react'

interface LiveMatchDetailProps {
  match: UiMatch | null
  onBack: () => void
}

export function LiveMatchDetail({ match, onBack }: LiveMatchDetailProps) {
  const [activeTab, setActiveTab] = useState<'stats' | 'odds'>('stats')

  if (!match) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Match not found</p>
      </div>
    )
  }

  const isLive = match.status === 'LIVE'

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
            <div>
              <p className="text-sm text-muted-foreground">{match.league}</p>
              <h1 className="text-xl font-bold text-foreground">
                {match.homeTeam} vs {match.awayTeam}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-secondary rounded-lg transition-colors">
              <Share2 className="w-5 h-5 text-foreground" />
            </button>
            <button className="p-2 hover:bg-secondary rounded-lg transition-colors">
              <MessageSquare className="w-5 h-5 text-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Match Visualization & Stats */}
          <div className="lg:col-span-2 space-y-6">
            {/* Score Display */}
            <div className="bg-card border border-border rounded-lg p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="text-center flex-1">
                  <h2 className="text-4xl font-bold text-foreground mb-2">
                    {match.homeScore}
                  </h2>
                  <p className="text-foreground font-semibold">{match.homeTeam}</p>
                </div>
                <div className="flex flex-col items-center gap-2 px-8">
                  {isLive ? (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-destructive animate-pulse"></span>
                      <span className="text-sm font-semibold text-destructive">LIVE</span>
                    </div>
                  ) : (
                    <span className="text-sm font-semibold text-accent">UPCOMING</span>
                  )}
                  <p className="text-sm text-muted-foreground">{match.time}</p>
                </div>
                <div className="text-center flex-1">
                  <h2 className="text-4xl font-bold text-foreground mb-2">
                    {match.awayScore}
                  </h2>
                  <p className="text-foreground font-semibold">{match.awayTeam}</p>
                </div>
              </div>
            </div>

            {/* Match Visualization */}
            <MatchVisualization match={match} />

            {/* Tabs */}
            <div className="border-b border-border">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab('stats')}
                  className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
                    activeTab === 'stats'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Statistics
                </button>
                <button
                  onClick={() => setActiveTab('odds')}
                  className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
                    activeTab === 'odds'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Live Odds
                </button>
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'stats' && <MatchStatistics match={match} />}
            {activeTab === 'odds' && (
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-lg font-bold text-foreground mb-4">Available Odds</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-secondary rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Home Win</p>
                    <p className="text-3xl font-bold text-accent">{match.odds.home}</p>
                  </div>
                  {match.odds.draw && (
                    <div className="text-center p-4 bg-secondary rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">Draw</p>
                      <p className="text-3xl font-bold text-accent">{match.odds.draw}</p>
                    </div>
                  )}
                  <div className="text-center p-4 bg-secondary rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Away Win</p>
                    <p className="text-3xl font-bold text-accent">{match.odds.away}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Betting Panel */}
          <BettingPanel match={match} />
        </div>
      </div>
    </div>
  )
}
