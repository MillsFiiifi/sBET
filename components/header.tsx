'use client'

import { Search, Bell, MessageCircle, Settings, User } from 'lucide-react'

interface HeaderProps {
  onSettingsClick?: () => void
}

export function Header({ onSettingsClick }: HeaderProps) {
  return (
    <header className="bg-card border-b border-border sticky top-0 z-50">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex-1">
          <div className="max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search matches, teams..."
                className="w-full pl-10 pr-4 py-2 bg-secondary text-foreground rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent placeholder-muted-foreground"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 ml-6">
          {/* Wallet Info */}
          <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg">
            <span className="text-sm text-muted-foreground">Balance:</span>
            <span className="text-lg font-bold text-foreground">0.0000</span>
            <span className="text-sm text-muted-foreground">₹</span>
          </div>

          {/* Deposit Button */}
          <button className="px-4 py-2 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-opacity-90 transition-colors">
            Deposit
          </button>

          {/* Notifications */}
          <button className="relative p-2 hover:bg-secondary rounded-lg transition-colors">
            <Bell className="w-5 h-5 text-foreground" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
          </button>

          {/* Chat */}
          <button className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <MessageCircle className="w-5 h-5 text-foreground" />
          </button>

          {/* Settings */}
          <button
            onClick={onSettingsClick}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5 text-foreground" />
          </button>

          {/* User Profile */}
          <button className="flex items-center gap-2 px-3 py-2 hover:bg-secondary rounded-lg transition-colors">
            <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-accent-foreground" />
            </div>
            <span className="text-sm font-medium text-foreground">Alan</span>
          </button>
        </div>
      </div>
    </header>
  )
}
