'use client'

import { Home, Calendar, Trophy, Wallet, Gift } from 'lucide-react'

interface BottomNavProps {
  activeSection: string
  onSectionChange: (section: string) => void
}

const TABS = [
  { id: 'in-play', label: 'Sports', icon: Home },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'results', label: 'Results', icon: Trophy },
  { id: 'promotions', label: 'Promos', icon: Gift },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
]

/** Mobile-only bottom tab bar (SportyBet-style). Hidden on lg+ where the
 *  sidebar handles navigation. */
export function BottomNav({ activeSection, onSectionChange }: BottomNavProps) {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-border pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {TABS.map((tab) => {
          const active = activeSection === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onSectionChange(tab.id)}
              className={`flex flex-col items-center justify-center gap-1 py-2 transition-colors ${
                active ? 'text-accent' : 'text-muted-foreground'
              }`}
            >
              <tab.icon className={`w-5 h-5 ${active ? 'fill-accent/15' : ''}`} />
              <span className="text-[10px] font-semibold">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
