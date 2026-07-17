'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface SettingsPageProps {
  onClose: () => void
}

const THEMES = [
  { id: 'dark', name: 'Dark Theme', colors: '#1a1f28' },
  { id: 'light', name: 'Light Theme', colors: '#ffffff' },
]

const COLORS = [
  { id: 'blue', name: 'Blue', value: '#0066cc' },
  { id: 'orange', name: 'Orange', value: '#ff6b35' },
  { id: 'green', name: 'Green', value: '#00d4ff' },
  { id: 'purple', name: 'Purple', value: '#a78bfa' },
  { id: 'red', name: 'Red', value: '#ff4444' },
  { id: 'pink', name: 'Pink', value: '#f97316' },
]

const LANGUAGES = [
  { id: 'en', name: 'English', flag: '🇺🇸' },
  { id: 'es', name: 'Spanish', flag: '🇪🇸' },
  { id: 'fr', name: 'French', flag: '🇫🇷' },
  { id: 'de', name: 'German', flag: '🇩🇪' },
]

const SPORTS_LIST = [
  { id: 'soccer', name: 'Soccer', selected: true },
  { id: 'basketball', name: 'Basketball', selected: true },
  { id: 'tennis', name: 'Tennis', selected: true },
  { id: 'hockey', name: 'Ice Hockey', selected: false },
  { id: 'american-football', name: 'American Football', selected: false },
  { id: 'baseball', name: 'Baseball', selected: false },
]

const ODDS_FORMATS = [
  { id: 'decimal', name: 'Decimal', example: '1.50' },
  { id: 'fractional', name: 'Fractional', example: '1/2' },
  { id: 'american', name: 'American', example: '-200' },
]

export function SettingsPage({ onClose }: SettingsPageProps) {
  const [selectedTheme, setSelectedTheme] = useState('dark')
  const [selectedColor, setSelectedColor] = useState('orange')
  const [selectedLanguage, setSelectedLanguage] = useState('en')
  const [selectedOdds, setSelectedOdds] = useState('decimal')
  const [selectedSports, setSelectedSports] = useState(
    SPORTS_LIST.filter((s) => s.selected).map((s) => s.id)
  )

  const toggleSport = (sportId: string) => {
    setSelectedSports((prev) =>
      prev.includes(sportId)
        ? prev.filter((id) => id !== sportId)
        : [...prev, sportId]
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center overflow-y-auto">
      <div className="bg-card border border-border rounded-lg max-w-2xl w-full mx-4 my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">Settings & Customization</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
          <div className="p-6 space-y-8">
            {/* Interface Theme */}
            <section>
              <h3 className="text-lg font-semibold text-foreground mb-4">Interface</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-foreground mb-3 block">
                    Main Theme
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => setSelectedTheme(theme.id)}
                        className={`p-3 rounded-lg border-2 transition-colors text-left ${
                          selectedTheme === theme.id
                            ? 'border-accent bg-accent bg-opacity-10'
                            : 'border-border hover:border-accent'
                        }`}
                      >
                        <p className="font-medium text-foreground">{theme.name}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-3 block">
                    Secondary colors
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {COLORS.map((color) => (
                      <button
                        key={color.id}
                        onClick={() => setSelectedColor(color.id)}
                        className={`p-4 rounded-lg border-2 transition-colors ${
                          selectedColor === color.id
                            ? 'border-accent'
                            : 'border-border'
                        }`}
                      >
                        <div
                          className="w-full h-8 rounded mb-2"
                          style={{ backgroundColor: color.value }}
                        />
                        <p className="text-xs font-medium text-foreground text-center">
                          {color.name}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Language & Time */}
            <section>
              <h3 className="text-lg font-semibold text-foreground mb-4">Language & Location</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Language
                  </label>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.id} value={lang.id}>
                        {lang.flag} {lang.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Date Format
                  </label>
                  <select
                    defaultValue="dmy"
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="mdy">MM/DD/YYYY</option>
                    <option value="dmy">DD/MM/YYYY</option>
                    <option value="ymd">YYYY-MM-DD</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Time Zone
                  </label>
                  <select
                    defaultValue="utc"
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="utc">GMT+0 (UTC)</option>
                    <option value="est">GMT-5 (EST)</option>
                    <option value="cet">GMT+1 (CET)</option>
                    <option value="ist">GMT+5:30 (IST)</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Odds Format */}
            <section>
              <h3 className="text-lg font-semibold text-foreground mb-4">Betting Preferences</h3>
              <div>
                <label className="text-sm font-medium text-foreground mb-3 block">
                  Odds Format
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {ODDS_FORMATS.map((format) => (
                    <button
                      key={format.id}
                      onClick={() => setSelectedOdds(format.id)}
                      className={`p-4 rounded-lg border-2 transition-colors text-left ${
                        selectedOdds === format.id
                          ? 'border-accent bg-accent bg-opacity-10'
                          : 'border-border hover:border-accent'
                      }`}
                    >
                      <p className="font-medium text-foreground">{format.name}</p>
                      <p className="text-sm text-muted-foreground">{format.example}</p>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Sports Selection */}
            <section>
              <h3 className="text-lg font-semibold text-foreground mb-4">Favorite Sports</h3>
              <div className="grid grid-cols-2 gap-3">
                {SPORTS_LIST.map((sport) => (
                  <label
                    key={sport.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSports.includes(sport.id)}
                      onChange={() => toggleSport(sport.id)}
                      className="w-4 h-4 rounded border border-border checked:bg-accent"
                    />
                    <span className="text-foreground">{sport.name}</span>
                  </label>
                ))}
              </div>
            </section>

            {/* Display Options */}
            <section>
              <h3 className="text-lg font-semibold text-foreground mb-4">Display Options</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-4 h-4 rounded border border-border checked:bg-accent"
                  />
                  <span className="text-foreground">Show odds format</span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-4 h-4 rounded border border-border checked:bg-accent"
                  />
                  <span className="text-foreground">Display even banners</span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border border-border checked:bg-accent"
                  />
                  <span className="text-foreground">Hide zero handicap</span>
                </label>
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-border">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-secondary transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-opacity-90 transition-colors font-medium"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
