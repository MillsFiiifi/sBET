'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { Match } from '@/lib/types'
import { leagueMeta } from '@/lib/leagues-meta'
import { SectionHeader } from '@/components/section-header'

interface LeaguesWithUpcomingProps {
  matches: Match[]
  max?: number
}

interface LeagueBucket {
  league: string
  upcoming: number
  live: number
  flag: string
  slug: string | null
}

function findMeta(leagueName: string) {
  const lower = leagueName.toLowerCase()
  return leagueMeta.find((m) =>
    m.matchFilters.some((f) => lower.includes(f.toLowerCase())),
  )
}

export function LeaguesWithUpcoming({ matches, max = 8 }: LeaguesWithUpcomingProps) {
  const buckets = new Map<string, LeagueBucket>()
  for (const m of matches) {
    const meta = findMeta(m.league)
    const key = meta?.name ?? m.league
    const existing = buckets.get(key)
    if (existing) {
      if (m.isLive) existing.live++
      else existing.upcoming++
    } else {
      buckets.set(key, {
        league: meta?.name ?? m.league,
        upcoming: m.isLive ? 0 : 1,
        live: m.isLive ? 1 : 0,
        flag: meta?.flag ?? '🏆',
        slug: meta?.slug ?? null,
      })
    }
  }

  const items = Array.from(buckets.values())
    .filter((b) => b.upcoming + b.live > 0)
    .sort((a, b) => b.upcoming + b.live - (a.upcoming + a.live))
    .slice(0, max)

  if (items.length === 0) return null

  return (
    <section className="mb-2">
      <SectionHeader
        title="Leagues with upcoming games"
        viewAllHref="/leagues"
      />
      {/* Scroll strip with mask edges so chips fade into the gutter */}
      <div
        className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide -mx-3 sm:-mx-4 px-3 sm:px-4"
        style={{
          maskImage:
            'linear-gradient(to right, transparent 0, black 12px, black calc(100% - 24px), transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0, black 12px, black calc(100% - 24px), transparent 100%)',
        }}
      >
        {items.map((item) => {
          const total = item.live + item.upcoming
          const inner = (
            <div className="group flex-shrink-0 flex items-center gap-2.5 pl-2.5 pr-3 py-2 bg-card border border-border rounded-xl shadow-card hover:shadow-card-hover hover:border-primary/40 hover:-translate-y-0.5 transition-all min-w-[200px]">
              <span
                aria-hidden
                className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-lg leading-none shrink-0"
              >
                {item.flag}
              </span>
              <div className="text-left flex-1 min-w-0">
                <p className="font-semibold text-sm leading-tight truncate group-hover:text-primary transition-colors">
                  {item.league}
                </p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  {item.live > 0 && (
                    <>
                      <span className="w-1.5 h-1.5 bg-live rounded-full animate-pulse-live" />
                      <span className="text-live font-medium">{item.live} live</span>
                      <span className="opacity-40 mx-0.5">·</span>
                    </>
                  )}
                  <span className="tabular-nums">{item.upcoming} upcoming</span>
                </p>
              </div>
              <span className="text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground shrink-0">
                {total}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
            </div>
          )
          return item.slug ? (
            <Link key={item.league} href={`/leagues/${item.slug}`} className="block">
              {inner}
            </Link>
          ) : (
            <div key={item.league}>{inner}</div>
          )
        })}
      </div>
    </section>
  )
}
