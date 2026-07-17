'use client'

import { LIVE_MATCHES, FEATURED_EVENTS, SPORTS } from '@/lib/constants'
import { MatchCard } from './match-card'
import { SPORT_ICONS } from '@/components/sport-icons'
import { TrendingUp, Calendar, Trophy } from 'lucide-react'

interface HomepageProps {
  onMatchClick?: (matchId: number) => void
}

export function Homepage({ onMatchClick }: HomepageProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-8 space-y-8">
        {/* Featured Section */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">Featured Events</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FEATURED_EVENTS.map((event) => (
              <div
                key={event.id}
                className="bg-gradient-to-br from-accent to-accent/60 text-accent-foreground rounded-lg p-6 cursor-pointer hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <Trophy className="w-6 h-6" />
                  <span className="text-xs font-semibold bg-accent-foreground bg-opacity-20 px-2 py-1 rounded">
                    {event.sport.toUpperCase()}
                  </span>
                </div>
                <h3 className="text-lg font-bold mb-2">{event.title}</h3>
                <p className="text-sm opacity-90 mb-3">{event.matchups}</p>
                <div className="flex items-center justify-between text-xs">
                  <span>{event.date}</span>
                  <span className="font-semibold">{event.time}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Stats */}
        <section>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Live Matches</p>
                  <p className="text-2xl font-bold text-foreground">24</p>
                </div>
                <TrendingUp className="w-8 h-8 text-accent opacity-50" />
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Upcoming</p>
                  <p className="text-2xl font-bold text-foreground">18</p>
                </div>
                <Calendar className="w-8 h-8 text-accent opacity-50" />
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Total Bets</p>
                  <p className="text-2xl font-bold text-foreground">847</p>
                </div>
                <Trophy className="w-8 h-8 text-accent opacity-50" />
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
                  <p className="text-2xl font-bold text-foreground">68%</p>
                </div>
                <div className="w-8 h-8 text-accent opacity-50">📊</div>
              </div>
            </div>
          </div>
        </section>

        {/* Sports Overview */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">Popular Sports</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {SPORTS.map((sport) => {
              const Icon = SPORT_ICONS[sport.id]
              return (
              <div
                key={sport.id}
                className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:border-accent hover:shadow-lg transition-all"
              >
                {Icon && <Icon className="w-9 h-9 mb-2 text-accent" />}
                <h3 className="font-semibold text-foreground mb-1">{sport.name}</h3>
                <p className="text-sm text-muted-foreground">{sport.matches} matches</p>
              </div>
              )
            })}
          </div>
        </section>

        {/* Live Matches */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">Live Matches</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {LIVE_MATCHES.filter((m) => m.status === 'LIVE').map((match) => (
              <MatchCard key={match.id} match={match} onClick={() => onMatchClick?.(match.id)} />
            ))}
          </div>
        </section>

        {/* Upcoming Matches */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">Upcoming Matches</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {LIVE_MATCHES.filter((m) => m.status === 'UPCOMING').map((match) => (
              <MatchCard key={match.id} match={match} onClick={() => onMatchClick?.(match.id)} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
