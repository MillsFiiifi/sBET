'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { Homepage } from '@/components/homepage'
import { SettingsPage } from '@/components/settings-page'
import { LiveMatchDetail } from '@/components/live-match-detail'
import { WalletPage } from '@/components/wallet-page'
import { PromotionsPage } from '@/components/promotions-page'
import { FavoritesPage } from '@/components/favorites-page'
import { SchedulePage } from '@/components/schedule-page'
import { ResultsPage } from '@/components/results-page'
import type { UiMatch } from '@/lib/ui-match'

export default function Home() {
  const [activeSection, setActiveSection] = useState('in-play')
  const [showSettings, setShowSettings] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<UiMatch | null>(null)

  const handleMatchClick = (match: UiMatch) => {
    setSelectedMatch(match)
  }

  const handleBackFromMatch = () => {
    setSelectedMatch(null)
  }

  // Sections that have full page implementations
  const mainSections = ['in-play', 'favorites', 'schedule', 'results', 'wallet', 'promotions']

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      {selectedMatch === null && <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />}

      {/* Main Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        {selectedMatch === null && <Header onSettingsClick={() => setShowSettings(true)} />}

        {/* Content Area — flex column so each page's `flex-1 overflow-y-auto`
            root gets a bounded height and can actually scroll */}
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {selectedMatch === null ? (
            <>
              {activeSection === 'in-play' && <Homepage onMatchClick={handleMatchClick} />}
              {activeSection === 'favorites' && <FavoritesPage />}
              {activeSection === 'schedule' && <SchedulePage />}
              {activeSection === 'results' && <ResultsPage />}
              {activeSection === 'wallet' && <WalletPage />}
              {activeSection === 'promotions' && <PromotionsPage />}
              {!mainSections.includes(activeSection) && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                      {activeSection.charAt(0).toUpperCase() + activeSection.slice(1).replace(/-/g, ' ')}
                    </h2>
                    <p className="text-muted-foreground">Coming soon...</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <LiveMatchDetail match={selectedMatch} onBack={handleBackFromMatch} />
          )}
        </main>
      </div>

      {/* Settings Modal */}
      {showSettings && <SettingsPage onClose={() => setShowSettings(false)} />}
    </div>
  )
}
