'use client'

import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
import type { Match } from '@/lib/types'

// A stylised live "match tracker": an animated pitch with the real score and
// minute plus an attacking-momentum bar. We don't have a live ball-tracking
// feed, so momentum is a synthetic value that drifts (biased toward the team
// in the lead) to make the widget feel live — it isn't real event data.

function parseMinute(raw: string): { clock: string; half: string; isBreak: boolean } {
  const m = (raw ?? '').trim()
  if (/^ht$|half.?time/i.test(m)) return { clock: 'HT', half: 'Half-time', isBreak: true }
  if (/^ft$|full.?time|finished/i.test(m)) return { clock: 'FT', half: 'Full-time', isBreak: true }
  const num = parseInt(m.replace(/[^0-9]/g, ''), 10)
  if (!Number.isFinite(num)) return { clock: m || '—', half: '', isBreak: false }
  return { clock: `${num}'`, half: num <= 45 ? '1st Half' : '2nd Half', isBreak: false }
}

function shortName(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return letters.slice(0, 3) || name.slice(0, 3).toUpperCase()
}

export function LiveTracker({ match }: { match: Match }) {
  const home = match.homeTeam
  const away = match.awayTeam
  const hs = match.homeScore ?? 0
  const as = match.awayScore ?? 0
  const { clock, half, isBreak } = parseMinute(match.minute ?? '')

  // Home share of momentum (0..100), nudged toward whoever is leading.
  const bias = 50 + Math.max(-16, Math.min(16, (hs - as) * 8))
  const [homeShare, setHomeShare] = useState(bias)
  useEffect(() => {
    if (isBreak) {
      setHomeShare(bias)
      return
    }
    const t = setInterval(() => {
      setHomeShare((cur) => {
        const drift = (Math.random() - 0.5) * 16
        const pull = (bias - cur) * 0.22
        return Math.max(26, Math.min(74, cur + drift + pull))
      })
    }, 2200)
    return () => clearInterval(t)
  }, [bias, isBreak])

  const homePct = Math.round(homeShare)
  const awayPct = 100 - homePct
  const homeAttacking = homePct >= 50
  const attackingTeam = homeAttacking ? home : away
  // Ball sits in the attacking team's target half.
  const ballLeft = homeAttacking ? 55 + (homePct - 50) * 0.7 : 45 - (50 - homePct) * 0.7

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" fill="currentColor" />
          <h2 className="font-bold text-sm">Live Tracker</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-live px-1.5 py-0.5 rounded-full border border-live/30 bg-live/10">
          <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse" />
          Live
        </span>
      </div>

      <div
        className="relative w-full aspect-[16/11] rounded-xl overflow-hidden border border-emerald-950/50 select-none"
        style={{
          background:
            'repeating-linear-gradient(90deg, #15803d 0 12.5%, #16a34a 12.5% 25%)',
        }}
      >
        {/* Pitch markings */}
        <div className="absolute inset-3 rounded-sm border-2 border-white/30" />
        {/* Halfway line + centre circle */}
        <div className="absolute top-3 bottom-3 left-1/2 -translate-x-1/2 w-0.5 bg-white/30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[22%] aspect-square rounded-full border-2 border-white/30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/50" />
        {/* Penalty boxes */}
        <div className="absolute top-1/2 -translate-y-1/2 left-3 w-[15%] h-[52%] border-2 border-l-0 border-white/30" />
        <div className="absolute top-1/2 -translate-y-1/2 right-3 w-[15%] h-[52%] border-2 border-r-0 border-white/30" />
        {/* Goals */}
        <div className="absolute top-1/2 -translate-y-1/2 left-1 w-2 h-[22%] border-2 border-l-0 border-white/40" />
        <div className="absolute top-1/2 -translate-y-1/2 right-1 w-2 h-[22%] border-2 border-r-0 border-white/40" />

        {/* Score + clock chips */}
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/55 backdrop-blur-sm rounded-full pl-2 pr-2.5 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse" />
          <span className="text-[11px] font-bold text-white tabular-nums">{clock}</span>
          <span className="text-[10px] text-white/70">{half}</span>
        </div>
        <div className="absolute top-2.5 right-2.5 bg-black/60 rounded-md px-2 py-0.5 text-white text-sm font-extrabold tabular-nums">
          {hs} - {as}
        </div>

        {/* Ball — glides toward the attacking half */}
        {!isBreak && (
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-[1800ms] ease-in-out"
            style={{ left: `${ballLeft}%` }}
          >
            <div className="w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_10px_2px_rgba(255,255,255,0.5)] ring-2 ring-emerald-900/30" />
          </div>
        )}

        {/* Momentum bar */}
        <div className="absolute bottom-0 left-0 right-0">
          <div className="flex items-center justify-between px-2.5 pb-1 text-[10px] font-bold text-white/90 tabular-nums">
            <span>{shortName(home)} {homePct}%</span>
            <span>{awayPct}% {shortName(away)}</span>
          </div>
          <div className="h-1.5 w-full bg-black/40 flex">
            <div
              className="h-full bg-gradient-to-r from-emerald-300 to-emerald-400 transition-[width] duration-[1800ms] ease-in-out"
              style={{ width: `${homePct}%` }}
            />
            <div className="h-full flex-1 bg-white/25" />
          </div>
        </div>

        {/* Attacking label */}
        {!isBreak && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1 text-[11px] font-bold text-white whitespace-nowrap">
            {attackingTeam} Attacking
          </div>
        )}
        {isBreak && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="bg-black/60 rounded-full px-3 py-1 text-xs font-bold text-white">
              {half}
            </span>
          </div>
        )}
      </div>

      <p className="mt-2 text-[10px] text-muted-foreground text-center">
        Visual tracker · momentum is indicative, not live event data.
      </p>
    </div>
  )
}
