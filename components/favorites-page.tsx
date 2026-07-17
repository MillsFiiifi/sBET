'use client'

import { Heart, Star, Trash2 } from 'lucide-react'

const FAVORITE_MATCHES = [
  {
    id: 1,
    homeTeam: 'Manchester United',
    awayTeam: 'Liverpool',
    league: 'Premier League',
    sport: 'Soccer',
    odds: { home: 2.10, draw: 3.40, away: 3.50 },
    status: 'UPCOMING',
  },
  {
    id: 2,
    homeTeam: 'Boston Celtics',
    awayTeam: 'Los Angeles Lakers',
    league: 'NBA',
    sport: 'Basketball',
    odds: { home: 1.95, away: 1.85 },
    status: 'LIVE',
  },
  {
    id: 3,
    homeTeam: 'Novak Djokovic',
    awayTeam: 'Carlos Alcaraz',
    league: 'Wimbledon',
    sport: 'Tennis',
    odds: { home: 2.30, away: 1.60 },
    status: 'UPCOMING',
  },
]

export function FavoritesPage() {
  return (
    <main className="flex-1 overflow-auto">
      <div className="p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Heart className="w-8 h-8 text-accent fill-accent" />
            <h1 className="text-4xl font-bold text-foreground">Favorites</h1>
          </div>
          <p className="text-muted-foreground">Your saved matches and teams</p>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap">
          {['All Sports', 'Soccer', 'Basketball', 'Tennis'].map((filter) => (
            <button
              key={filter}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'All Sports'
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-card border border-border text-foreground hover:border-accent'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Favorites List */}
        <div className="space-y-4">
          {FAVORITE_MATCHES.map((match) => (
            <div
              key={match.id}
              className="bg-card border border-border rounded-lg p-6 hover:border-accent transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      {match.league}
                    </span>
                    <span className="text-xs font-semibold text-accent uppercase">
                      {match.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mb-3">
                    <div>
                      <p className="font-semibold text-foreground">{match.homeTeam}</p>
                      <p className="text-sm text-muted-foreground">{match.sport}</p>
                    </div>
                    <span className="text-muted-foreground">vs</span>
                    <p className="font-semibold text-foreground">{match.awayTeam}</p>
                  </div>
                  <div className="flex gap-2">
                    {Object.entries(match.odds).map(([label, odd]) => (
                      <button
                        key={label}
                        className="px-3 py-2 bg-muted rounded text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        {label === 'home' ? '1' : label === 'draw' ? 'X' : '2'}: {odd}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 ml-4">
                  <button className="p-2 rounded-lg bg-muted text-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                    <Star className="w-5 h-5 fill-current" />
                  </button>
                  <button className="p-2 rounded-lg bg-muted text-foreground hover:bg-destructive hover:text-white transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
