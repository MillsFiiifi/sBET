'use client'

import { useState } from 'react'
import { Trash2, Plus, Minus } from 'lucide-react'

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

interface BettingPanelProps {
  match: Match
}

interface BetSelection {
  type: 'home' | 'draw' | 'away'
  odds: number
  amount: number
}

export function BettingPanel({ match }: BettingPanelProps) {
  const [bets, setBets] = useState<BetSelection[]>([])
  const [amount, setAmount] = useState<string>('10')

  const addBet = (type: 'home' | 'draw' | 'away', odds: number) => {
    const newBet: BetSelection = {
      type,
      odds,
      amount: parseFloat(amount) || 0,
    }
    setBets([...bets, newBet])
    setAmount('10')
  }

  const removeBet = (index: number) => {
    setBets(bets.filter((_, i) => i !== index))
  }

  const totalStake = bets.reduce((sum, bet) => sum + bet.amount, 0)
  const totalReturn = bets.reduce((sum, bet) => sum + bet.amount * bet.odds, 0)
  const potentialProfit = totalReturn - totalStake

  const getBetLabel = (type: string) => {
    if (type === 'home') return `${match.homeTeam} Win`
    if (type === 'away') return `${match.awayTeam} Win`
    return 'Draw'
  }

  return (
    <div className="space-y-4">
      {/* Betting Slip */}
      <div className="bg-card border border-border rounded-lg p-6 sticky top-32">
        <h3 className="text-lg font-bold text-foreground mb-4">Betting Slip</h3>

        {/* Bet Selection Options */}
        <div className="space-y-3 mb-6 pb-6 border-b border-border">
          <div
            onClick={() => addBet('home', match.odds.home)}
            className="flex items-center justify-between p-3 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors"
          >
            <div>
              <p className="text-sm text-muted-foreground">Home Win</p>
              <p className="font-bold text-foreground">{match.homeTeam}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Odds</p>
              <p className="text-2xl font-bold text-accent">{match.odds.home}</p>
            </div>
          </div>

          {match.odds.draw && (
            <div
              onClick={() => addBet('draw', match.odds.draw!)}
              className="flex items-center justify-between p-3 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors"
            >
              <div>
                <p className="text-sm text-muted-foreground">Draw</p>
                <p className="font-bold text-foreground">Match Draw</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Odds</p>
                <p className="text-2xl font-bold text-accent">{match.odds.draw}</p>
              </div>
            </div>
          )}

          <div
            onClick={() => addBet('away', match.odds.away)}
            className="flex items-center justify-between p-3 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors"
          >
            <div>
              <p className="text-sm text-muted-foreground">Away Win</p>
              <p className="font-bold text-foreground">{match.awayTeam}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Odds</p>
              <p className="text-2xl font-bold text-accent">{match.odds.away}</p>
            </div>
          </div>
        </div>

        {/* Amount Input */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-foreground mb-2">
            Stake Amount
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
              placeholder="Enter amount"
            />
            <button
              onClick={() => setAmount(String(parseFloat(amount || '0') - 10))}
              className="p-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
            >
              <Minus className="w-4 h-4 text-foreground" />
            </button>
            <button
              onClick={() => setAmount(String(parseFloat(amount || '0') + 10))}
              className="p-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4 text-foreground" />
            </button>
          </div>
        </div>

        {/* Selected Bets */}
        {bets.length > 0 && (
          <div className="space-y-3 mb-6 pb-6 border-t border-border pt-6">
            <h4 className="text-sm font-semibold text-foreground">Selected Bets ({bets.length})</h4>
            {bets.map((bet, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-secondary rounded-lg"
              >
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{getBetLabel(bet.type)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-semibold text-accent">{bet.odds}x</span>
                    <span className="text-sm font-semibold text-foreground">${bet.amount}</span>
                  </div>
                </div>
                <button
                  onClick={() => removeBet(idx)}
                  className="p-2 hover:bg-secondary rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {bets.length > 0 && (
          <div className="space-y-3 mb-6 pb-6 border-t border-border pt-6">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Stake</span>
              <span className="font-semibold text-foreground">${totalStake.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Return</span>
              <span className="font-semibold text-foreground">${totalReturn.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-border">
              <span className="text-sm font-semibold text-foreground">Potential Profit</span>
              <span className="text-lg font-bold text-accent">${potentialProfit.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Buttons */}
        <button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold py-3 rounded-lg transition-colors mb-3">
          {bets.length > 0 ? 'Place Bet' : 'Select Outcome'}
        </button>
        <button className="w-full border border-border text-foreground font-semibold py-3 rounded-lg hover:bg-secondary transition-colors">
          Add to Favorites
        </button>
      </div>
    </div>
  )
}
