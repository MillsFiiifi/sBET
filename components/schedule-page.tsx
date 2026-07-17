'use client'

import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

const SCHEDULE_DATA = [
  {
    date: '2024-06-15',
    matches: [
      { id: 1, home: 'Manchester United', away: 'Liverpool', league: 'Premier League', time: '15:00' },
      { id: 2, home: 'Arsenal', away: 'Chelsea', league: 'Premier League', time: '17:30' },
      { id: 3, home: 'Real Madrid', away: 'Barcelona', league: 'La Liga', time: '20:45' },
    ],
  },
  {
    date: '2024-06-16',
    matches: [
      { id: 4, home: 'Bayern Munich', away: 'Borussia Dortmund', league: 'Bundesliga', time: '14:30' },
      { id: 5, home: 'Paris Saint-Germain', away: 'Marseille', league: 'Ligue 1', time: '20:00' },
    ],
  },
  {
    date: '2024-06-17',
    matches: [
      { id: 6, home: 'Boston Celtics', away: 'Los Angeles Lakers', league: 'NBA', time: '02:00' },
      { id: 7, home: 'Golden State Warriors', away: 'Denver Nuggets', league: 'NBA', time: '04:30' },
    ],
  },
]

export function SchedulePage() {
  const [selectedDate, setSelectedDate] = useState('2024-06-15')

  return (
    <main className="flex-1 overflow-auto">
      <div className="p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-8 h-8 text-accent" />
            <h1 className="text-4xl font-bold text-foreground">Schedule</h1>
          </div>
          <p className="text-muted-foreground">Upcoming matches and events</p>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex gap-3 items-center">
            <button className="p-2 rounded-lg bg-card border border-border hover:border-accent transition-colors">
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex gap-2">
              {['Today', 'Tomorrow', '+2 Days', '+3 Days'].map((label) => (
                <button
                  key={label}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    label === 'Today'
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-card border border-border text-foreground hover:border-accent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button className="p-2 rounded-lg bg-card border border-border hover:border-accent transition-colors">
              <ChevronRight className="w-5 h-5 text-foreground" />
            </button>
          </div>

          <select className="px-4 py-2 rounded-lg bg-card border border-border text-foreground hover:border-accent transition-colors cursor-pointer">
            <option>All Sports</option>
            <option>Soccer</option>
            <option>Basketball</option>
            <option>Tennis</option>
          </select>
        </div>

        {/* Schedule List */}
        <div className="space-y-6">
          {SCHEDULE_DATA.map((day) => (
            <div key={day.date}>
              <h3 className="text-lg font-semibold text-foreground mb-4">
                {new Date(day.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </h3>

              <div className="space-y-3">
                {day.matches.map((match) => (
                  <div
                    key={match.id}
                    className="bg-card border border-border rounded-lg p-4 hover:border-accent transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                        {match.league}
                      </p>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{match.home}</p>
                        </div>
                        <span className="text-muted-foreground">vs</span>
                        <div className="flex-1">
                          <p className="font-semibold text-foreground text-right">{match.away}</p>
                        </div>
                      </div>
                    </div>

                    <div className="ml-6 text-right">
                      <p className="text-xl font-bold text-accent">{match.time}</p>
                      <button className="mt-2 px-4 py-2 bg-accent text-accent-foreground rounded text-sm font-medium hover:bg-opacity-90 transition-colors">
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
