'use client'

import { useEffect, useState } from 'react'
import { ChevronRight, Star } from 'lucide-react'
import { FAVORITES_EVENT, isFavorite, toggleFavorite } from '@/lib/favorites'

interface MatchCardProps {
  match: {
    id: string
    homeTeam: string
    awayTeam: string
    homeScore: number
    awayScore: number
    time: string
    status: 'LIVE' | 'UPCOMING'
    league: string
    sport: string
    odds: {
      home: number
      draw?: number
      away: number
    }
  }
  onClick?: () => void
}

export function MatchCard({ match, onClick }: MatchCardProps) {
  const isLive = match.status === 'LIVE'
  const [fav, setFav] = useState(false)

  useEffect(() => {
    const sync = () => setFav(isFavorite(match.id))
    sync()
    window.addEventListener(FAVORITES_EVENT, sync)
    return () => window.removeEventListener(FAVORITES_EVENT, sync)
  }, [match.id])

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden hover:border-accent transition-colors cursor-pointer" onClick={onClick}>
      {/* Header */}
      <div className="bg-secondary px-4 py-3 flex items-center justify-between border-b border-border">
        <div>
          <p className="text-xs font-semibold text-accent uppercase">{match.league}</p>
          <p className="text-sm text-muted-foreground">{match.time}</p>
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <div className="flex items-center gap-2 px-3 py-1 bg-destructive bg-opacity-20 rounded">
              <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-destructive">LIVE</span>
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorite(match.id) }}
            className={`p-1.5 rounded-lg transition-colors ${fav ? 'text-accent' : 'text-muted-foreground hover:text-accent'}`}
            aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className={`w-4 h-4 ${fav ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      {/* Match Content */}
      <div className="p-4">
        {/* Teams and Score */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground flex-1">
              {match.homeTeam}
            </span>
            <div className="text-2xl font-bold text-foreground mx-4">
              {match.homeScore}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground px-2">vs</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground flex-1">
              {match.awayTeam}
            </span>
            <div className="text-2xl font-bold text-foreground mx-4">
              {match.awayScore}
            </div>
          </div>
        </div>
      </div>

      {/* Odds */}
      <div className="grid grid-cols-3 gap-2 px-4 py-3 bg-secondary border-t border-border">
        <button className="py-2 px-3 bg-card rounded border border-border hover:border-accent hover:bg-opacity-50 transition-colors">
          <div className="text-xs text-muted-foreground">1</div>
          <div className="text-sm font-bold text-foreground">{match.odds.home}</div>
        </button>

        {match.odds.draw && (
          <button className="py-2 px-3 bg-card rounded border border-border hover:border-accent hover:bg-opacity-50 transition-colors">
            <div className="text-xs text-muted-foreground">X</div>
            <div className="text-sm font-bold text-foreground">{match.odds.draw}</div>
          </button>
        )}

        <button className="py-2 px-3 bg-card rounded border border-border hover:border-accent hover:bg-opacity-50 transition-colors">
          <div className="text-xs text-muted-foreground">2</div>
          <div className="text-sm font-bold text-foreground">{match.odds.away}</div>
        </button>
      </div>

      {/* Footer */}
      <button onClick={onClick} className="w-full px-4 py-3 bg-accent text-accent-foreground font-medium hover:bg-opacity-90 transition-colors flex items-center justify-between group">
        <span>View full odds</span>
        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </button>
    </div>
  )
}
