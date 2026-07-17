'use client'

import { TrendingUp, Trophy, Filter } from 'lucide-react'

const RESULTS_DATA = [
  {
    id: 1,
    homeTeam: 'Manchester United',
    awayTeam: 'Liverpool',
    homeScore: 2,
    awayScore: 1,
    league: 'Premier League',
    date: '2024-06-14 17:45',
    sport: 'Soccer',
  },
  {
    id: 2,
    homeTeam: 'Real Madrid',
    awayTeam: 'Barcelona',
    homeScore: 3,
    awayScore: 2,
    league: 'La Liga',
    date: '2024-06-14 20:30',
    sport: 'Soccer',
  },
  {
    id: 3,
    homeTeam: 'Boston Celtics',
    awayTeam: 'Los Angeles Lakers',
    homeScore: 108,
    awayScore: 102,
    league: 'NBA',
    date: '2024-06-13 02:00',
    sport: 'Basketball',
  },
  {
    id: 4,
    homeTeam: 'Golden State Warriors',
    awayTeam: 'Denver Nuggets',
    homeScore: 116,
    awayScore: 123,
    league: 'NBA',
    date: '2024-06-13 04:30',
    sport: 'Basketball',
  },
  {
    id: 5,
    homeTeam: 'Novak Djokovic',
    awayTeam: 'Carlos Alcaraz',
    homeScore: 2,
    awayScore: 3,
    league: 'Wimbledon',
    date: '2024-06-12 14:00',
    sport: 'Tennis',
  },
]

export function ResultsPage() {
  return (
    <main className="flex-1 overflow-auto">
      <div className="p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-8 h-8 text-accent" />
            <h1 className="text-4xl font-bold text-foreground">Results</h1>
          </div>
          <p className="text-muted-foreground">Recent match results and scores</p>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-8 flex-wrap items-center">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border text-foreground hover:border-accent transition-colors">
            <Filter className="w-4 h-4" />
            Filter
          </button>
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

        {/* Results List */}
        <div className="space-y-4">
          {RESULTS_DATA.map((result) => (
            <div
              key={result.id}
              className="bg-card border border-border rounded-lg p-6 hover:border-accent transition-colors cursor-pointer"
            >
              {/* Result Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                    {result.league}
                  </p>
                  <p className="text-sm text-muted-foreground">{result.date}</p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-green-500 bg-opacity-20 text-green-400 text-xs font-semibold rounded">
                    Final
                  </span>
                </div>
              </div>

              {/* Score Display */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex flex-col">
                    <p className="font-bold text-foreground mb-1">{result.homeTeam}</p>
                    <p className="font-bold text-foreground">{result.awayTeam}</p>
                  </div>
                </div>

                <div className="px-8 py-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-6 text-center">
                    <div>
                      <p className="text-4xl font-bold text-accent">{result.homeScore}</p>
                    </div>
                    <div className="text-muted-foreground text-2xl font-light">-</div>
                    <div>
                      <p className="text-4xl font-bold text-accent">{result.awayScore}</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex justify-end">
                  <button className="px-4 py-2 bg-accent text-accent-foreground rounded text-sm font-medium hover:bg-opacity-90 transition-colors">
                    Details
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
