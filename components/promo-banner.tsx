'use client'

import { useEffect, useState } from 'react'
import { Gift, Zap, Trophy } from 'lucide-react'

interface Slide {
  title: string
  subtitle: string
  cta: string
  icon: React.ReactNode
  from: string
  to: string
}

const SLIDES: Slide[] = [
  {
    title: '100% Welcome Bonus',
    subtitle: 'Double your first deposit up to GHS 500',
    cta: 'Claim now',
    icon: <Gift className="w-10 h-10" />,
    from: 'from-primary',
    to: 'to-accent',
  },
  {
    title: 'Live Betting',
    subtitle: 'Bet in-play on matches happening right now',
    cta: 'Go live',
    icon: <Zap className="w-10 h-10" />,
    from: 'from-[#7c3aed]',
    to: 'to-[#2f7bff]',
  },
  {
    title: 'Big Odds, Bigger Wins',
    subtitle: 'Thousands of markets across every league',
    cta: 'Explore',
    icon: <Trophy className="w-10 h-10" />,
    from: 'from-[#0891b2]',
    to: 'to-[#22c55e]',
  },
]

interface PromoBannerProps {
  onCta?: () => void
}

export function PromoBanner({ onCta }: PromoBannerProps) {
  const [i, setI] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % SLIDES.length), 5000)
    return () => clearInterval(t)
  }, [])

  const s = SLIDES[i]

  return (
    <section>
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${s.from} ${s.to} text-white`}>
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_15%_20%,white_0,transparent_35%),radial-gradient(circle_at_85%_80%,white_0,transparent_30%)]" />
        <div className="relative z-10 flex items-center justify-between gap-4 p-5 sm:p-7">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-extrabold leading-tight">{s.title}</h2>
            <p className="text-sm text-white/85 mt-1">{s.subtitle}</p>
            <button
              onClick={onCta}
              className="mt-3 inline-block bg-white text-primary font-bold text-sm px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
            >
              {s.cta}
            </button>
          </div>
          <div className="shrink-0 opacity-90">{s.icon}</div>
        </div>
        {/* Dots */}
        <div className="absolute bottom-3 right-5 z-10 flex gap-1.5">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`}
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
