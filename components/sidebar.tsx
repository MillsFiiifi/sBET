'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SPORTS } from '@/lib/constants'
import { SPORT_ICONS } from '@/components/sport-icons'
import {
  Home,
  Heart,
  Calendar,
  TrendingUp,
  HelpCircle,
  Globe,
  ChevronDown,
  Wallet,
  Gift,
  Receipt,
  X,
} from 'lucide-react'

interface SidebarProps {
  activeSection: string
  onSectionChange: (section: string) => void
  /** Mobile drawer open state. On lg+ the sidebar is always visible. */
  open?: boolean
  onClose?: () => void
}

export function Sidebar({ activeSection, onSectionChange, open = false, onClose }: SidebarProps) {
  const [expandedSports, setExpandedSports] = useState(true)
  const [expandedOther, setExpandedOther] = useState(true)

  // Navigate then close the drawer (mobile). No-op for the static desktop rail.
  const go = (section: string) => {
    onSectionChange(section)
    onClose?.()
  }

  const mainMenu = [
    { id: 'in-play', label: 'In-Play', icon: Home, badge: 0 },
    { id: 'favorites', label: 'Favorites', icon: Heart, badge: 0 },
    { id: 'schedule', label: 'Schedule', icon: Calendar, badge: 0 },
    { id: 'results', label: 'Results', icon: TrendingUp, badge: 0 },
    { id: 'my-bets', label: 'My Bets', icon: Receipt, badge: 0 },
    { id: 'wallet', label: 'Wallet', icon: Wallet, badge: 0 },
    { id: 'promotions', label: 'Promotions', icon: Gift, badge: 0 },
  ]

  const otherMenu = [
    { id: 'statistics', label: 'Statistics Center', icon: TrendingUp },
  ]

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-screen overflow-y-auto transform transition-transform duration-200 ease-out lg:static lg:z-auto lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-sidebar-primary rounded flex items-center justify-center text-sidebar-primary-foreground font-bold">
            P
          </div>
          <span className="font-display text-lg font-bold tracking-wide text-sidebar-foreground">PowerStakeBet</span>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/10 transition-colors"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Menu */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {mainMenu.map((item) => (
          <button
            key={item.id}
            onClick={() => go(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeSection === item.id
                ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:bg-opacity-10'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="flex-1 text-left font-medium">{item.label}</span>
            {item.badge > 0 && (
              <span className="bg-sidebar-primary text-sidebar-primary-foreground text-xs rounded-full px-2 py-1">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Sports Section */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <button
          onClick={() => setExpandedSports(!expandedSports)}
          className="flex items-center justify-between w-full px-4 py-2 text-sidebar-foreground hover:text-sidebar-primary transition-colors"
        >
          <span className="font-semibold text-sm">SPORTS</span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${
              expandedSports ? 'rotate-180' : ''
            }`}
          />
        </button>

        {expandedSports && (
          <div className="mt-3 space-y-1">
            {SPORTS.map((sport) => {
              const Icon = SPORT_ICONS[sport.id]
              return (
              <button
                key={sport.id}
                onClick={() => go(`sport-${sport.id}`)}
                className={`w-full flex items-center gap-3 px-4 py-2 rounded text-sm transition-colors ${
                  activeSection === `sport-${sport.id}`
                    ? 'bg-sidebar-accent bg-opacity-20 text-sidebar-primary'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:bg-opacity-10'
                }`}
              >
                {Icon && <Icon className="w-5 h-5 shrink-0" />}
                <span className="flex-1 text-left">{sport.name}</span>
              </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Other Section */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <button
          onClick={() => setExpandedOther(!expandedOther)}
          className="flex items-center justify-between w-full px-4 py-2 text-sidebar-foreground hover:text-sidebar-primary transition-colors"
        >
          <span className="font-semibold text-sm">OTHER SPORTS</span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${
              expandedOther ? 'rotate-180' : ''
            }`}
          />
        </button>

        {expandedOther && (
          <div className="mt-3 space-y-1">
            {[
              { id: 'other-soccer', name: 'Soccer' },
              { id: 'other-hockey', name: 'Ice Hockey' },
              { id: 'other-basketball', name: 'Basketball' },
              { id: 'other-tennis', name: 'Tennis' },
              { id: 'other-volleyball', name: 'Volleyball' },
              { id: 'other-baseball', name: 'Baseball' },
            ].map((sport) => (
              <button
                key={sport.id}
                className="w-full flex items-center gap-3 px-4 py-2 rounded text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:bg-opacity-10 transition-colors"
              >
                <span className="flex-1 text-left">{sport.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Menu */}
      <div className="px-4 py-4 border-t border-sidebar-border space-y-2">
        {otherMenu.map((item) => (
          <button
            key={item.id}
            className="w-full flex items-center gap-3 px-4 py-2 rounded text-sidebar-foreground hover:bg-sidebar-accent hover:bg-opacity-10 transition-colors"
          >
            <item.icon className="w-5 h-5" />
            <span className="text-sm">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-sidebar-border space-y-2">
        <button className="w-full flex items-center gap-3 px-4 py-2 rounded text-sidebar-foreground hover:bg-sidebar-accent hover:bg-opacity-10 transition-colors">
          <HelpCircle className="w-5 h-5" />
          <span className="text-sm">Help</span>
        </button>
        <button className="w-full flex items-center gap-3 px-4 py-2 rounded text-sidebar-foreground hover:bg-sidebar-accent hover:bg-opacity-10 transition-colors">
          <Globe className="w-5 h-5" />
          <span className="text-sm">English</span>
        </button>
      </div>
      </aside>
    </>
  )
}
