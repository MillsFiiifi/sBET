'use client'

interface Match {
  id: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  time: string
  status: string
  league: string
  sport: string
  odds: {
    home: number
    draw?: number
    away: number
  }
}

interface MatchStatisticsProps {
  match: Match
}

interface Stat {
  label: string
  home: number | string
  away: number | string
  homeMax?: number
  awayMax?: number
}

export function MatchStatistics({ match }: MatchStatisticsProps) {
  let stats: Stat[] = []

  if (match.sport === 'soccer') {
    stats = [
      { label: 'Possession', home: '67%', away: '33%' },
      { label: 'Shots', home: 12, away: 6, homeMax: 12, awayMax: 12 },
      { label: 'Shots on Target', home: 7, away: 3, homeMax: 7, awayMax: 7 },
      { label: 'Passes', home: 524, away: 312, homeMax: 600, awayMax: 600 },
      { label: 'Pass Accuracy', home: '87%', away: '82%' },
      { label: 'Tackles', home: 14, away: 18, homeMax: 20, awayMax: 20 },
      { label: 'Fouls', home: 8, away: 6, homeMax: 10, awayMax: 10 },
      { label: 'Corners', home: 6, away: 2, homeMax: 8, awayMax: 8 },
      { label: 'Offsides', home: 1, away: 0, homeMax: 2, awayMax: 2 },
      { label: 'Yellow Cards', home: 2, away: 1, homeMax: 3, awayMax: 3 },
    ]
  } else if (match.sport === 'basketball') {
    stats = [
      { label: 'Points', home: 48, away: 42 },
      { label: 'Field Goals', home: '42/94', away: '38/88' },
      { label: '3-Pointers', home: '10/28', away: '8/25' },
      { label: 'Free Throws', home: '4/6', away: '2/4' },
      { label: 'Rebounds', home: 28, away: 24, homeMax: 40, awayMax: 40 },
      { label: 'Assists', home: 12, away: 9, homeMax: 15, awayMax: 15 },
      { label: 'Turnovers', home: 8, away: 6, homeMax: 15, awayMax: 15 },
      { label: 'Steals', home: 4, away: 5, homeMax: 10, awayMax: 10 },
      { label: 'Blocks', home: 3, away: 2, homeMax: 5, awayMax: 5 },
    ]
  } else if (match.sport === 'tennis') {
    stats = [
      { label: 'Aces', home: 8, away: 6 },
      { label: 'Double Faults', home: 2, away: 3 },
      { label: 'First Serve %', home: '72%', away: '65%' },
      { label: 'Break Points Won', home: 3, away: 1, homeMax: 5, awayMax: 5 },
      { label: 'Winners', home: 34, away: 28 },
      { label: 'Unforced Errors', home: 12, away: 18 },
    ]
  } else {
    stats = [
      { label: 'Statistic 1', home: 12, away: 8 },
      { label: 'Statistic 2', home: 24, away: 18 },
      { label: 'Statistic 3', home: '45%', away: '52%' },
    ]
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-4">
      <h3 className="text-lg font-bold text-foreground mb-6">Match Statistics</h3>

      {stats.map((stat, idx) => {
        const isPercentage = typeof stat.home === 'string' && stat.home.includes('%')
        let homeWidth = 50
        let awayWidth = 50

        if (stat.homeMax && stat.awayMax && typeof stat.home === 'number' && typeof stat.away === 'number') {
          homeWidth = (stat.home / (stat.homeMax + stat.awayMax)) * 100
          awayWidth = (stat.away / (stat.homeMax + stat.awayMax)) * 100
        }

        return (
          <div key={idx} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex-1">{match.homeTeam}</span>
              <span className="font-semibold text-foreground text-center w-24">{stat.label}</span>
              <span className="text-muted-foreground flex-1 text-right">{match.awayTeam}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 text-right">
                <span className="font-bold text-foreground text-sm">{stat.home}</span>
              </div>
              <div className="flex-1 mx-2">
                <div className="flex h-2 rounded-full overflow-hidden bg-secondary">
                  <div
                    className="bg-accent transition-all"
                    style={{ width: `${homeWidth}%` }}
                  ></div>
                  <div className="flex-1"></div>
                </div>
              </div>
              <div className="flex-1">
                <span className="font-bold text-foreground text-sm">{stat.away}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
