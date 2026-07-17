'use client'

interface Match {
  id: number
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

interface MatchVisualizationProps {
  match: Match
}

export function MatchVisualization({ match }: MatchVisualizationProps) {
  // For soccer, show a field
  if (match.sport === 'soccer') {
    return (
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="bg-gradient-to-b from-green-700 to-green-600 p-6 aspect-video flex flex-col items-center justify-center relative">
          {/* Field lines */}
          <svg
            className="absolute inset-0 w-full h-full opacity-30"
            viewBox="0 0 100 60"
            preserveAspectRatio="xMidYMid slice"
          >
            <rect width="100" height="60" fill="none" stroke="white" strokeWidth="0.3" />
            <line x1="50" y1="0" x2="50" y2="60" stroke="white" strokeWidth="0.2" />
            <circle cx="50" cy="30" r="8" fill="none" stroke="white" strokeWidth="0.2" />
            <circle cx="50" cy="30" r="1" fill="white" />
            {/* Goal areas */}
            <rect x="0" y="18" width="16" height="24" fill="none" stroke="white" strokeWidth="0.2" />
            <rect x="84" y="18" width="16" height="24" fill="none" stroke="white" strokeWidth="0.2" />
            {/* Penalty areas */}
            <rect x="0" y="12" width="20" height="36" fill="none" stroke="white" strokeWidth="0.2" />
            <rect x="80" y="12" width="20" height="36" fill="none" stroke="white" strokeWidth="0.2" />
          </svg>

          {/* Possession Stats */}
          <div className="relative z-10 flex flex-col items-center gap-4">
            <div className="flex items-center gap-4 text-white">
              <div className="text-center">
                <div className="text-lg font-bold">87%</div>
                <div className="text-xs opacity-75">Possession</div>
              </div>
              <div className="text-2xl font-bold">-</div>
              <div className="text-center">
                <div className="text-lg font-bold">33%</div>
                <div className="text-xs opacity-75">Possession</div>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-1 text-white text-sm">
                <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
                <span>12 Shots</span>
              </div>
              <div className="flex items-center gap-1 text-white text-sm">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span>6 Shots</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // For basketball/hockey, show a court/rink
  if (match.sport === 'basketball') {
    return (
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="bg-gradient-to-b from-amber-700 to-amber-600 p-6 aspect-video flex flex-col items-center justify-center relative">
          {/* Court lines */}
          <svg
            className="absolute inset-0 w-full h-full opacity-40"
            viewBox="0 0 94 50"
            preserveAspectRatio="xMidYMid slice"
          >
            <rect width="94" height="50" fill="none" stroke="white" strokeWidth="0.3" />
            <line x1="47" y1="0" x2="47" y2="50" stroke="white" strokeWidth="0.2" />
            <circle cx="47" cy="25" r="6" fill="none" stroke="white" strokeWidth="0.2" />
            <circle cx="47" cy="25" r="1.5" fill="white" />
            {/* 3-point line */}
            <path d="M 0 0 L 14 0 Q 14 16.7 0 33.3" fill="none" stroke="white" strokeWidth="0.2" />
            <path d="M 94 0 L 80 0 Q 80 16.7 94 33.3" fill="none" stroke="white" strokeWidth="0.2" />
          </svg>

          <div className="relative z-10 text-center text-white">
            <div className="text-lg font-semibold mb-2">Game Status</div>
            <div className="flex gap-8 justify-center">
              <div>
                <div className="text-sm opacity-75">FG%</div>
                <div className="font-bold">45%</div>
              </div>
              <div>
                <div className="text-sm opacity-75">3P%</div>
                <div className="font-bold">32%</div>
              </div>
              <div>
                <div className="text-sm opacity-75">FT%</div>
                <div className="font-bold">78%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Generic card for other sports
  return (
    <div className="bg-card border border-border rounded-lg p-6 aspect-video flex items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground mb-2">Live Statistics</p>
        <p className="text-2xl font-bold text-foreground">Match in Progress</p>
        <p className="text-sm text-muted-foreground mt-2">
          Real-time data updating...
        </p>
      </div>
    </div>
  )
}
