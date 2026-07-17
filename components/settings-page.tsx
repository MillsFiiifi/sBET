'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import {
  ACCENTS,
  applySettings,
  getSettings,
  saveSettings,
  type AppSettings,
  type ThemeMode,
} from '@/lib/settings'

interface SettingsPageProps {
  onClose: () => void
}

const THEMES: { id: ThemeMode; name: string }[] = [
  { id: 'dark', name: 'Dark Theme' },
  { id: 'light', name: 'Light Theme' },
]

const COLORS = Object.entries(ACCENTS).map(([id, c]) => ({ id, name: c.label, value: c.value }))

const LANGUAGES = [
  { id: 'en', name: 'English', flag: '🇺🇸' },
  { id: 'es', name: 'Spanish', flag: '🇪🇸' },
  { id: 'fr', name: 'French', flag: '🇫🇷' },
  { id: 'de', name: 'German', flag: '🇩🇪' },
]

const SPORTS_LIST = [
  { id: 'soccer', name: 'Soccer' },
  { id: 'basketball', name: 'Basketball' },
  { id: 'tennis', name: 'Tennis' },
  { id: 'hockey', name: 'Ice Hockey' },
  { id: 'american-football', name: 'American Football' },
  { id: 'baseball', name: 'Baseball' },
]

const ODDS_FORMATS = [
  { id: 'decimal', name: 'Decimal', example: '1.50' },
  { id: 'fractional', name: 'Fractional', example: '1/2' },
  { id: 'american', name: 'American', example: '-200' },
]

export function SettingsPage({ onClose }: SettingsPageProps) {
  const [settings, setSettings] = useState<AppSettings>(getSettings)
  // Snapshot of what was saved when the modal opened, to revert on Cancel.
  const savedRef = useRef<AppSettings>(getSettings())

  useEffect(() => {
    const current = getSettings()
    savedRef.current = current
    setSettings(current)
  }, [])

  // Live preview: apply theme + accent to the page as the user changes them.
  const patch = (p: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...p }
      applySettings(next)
      return next
    })
  }

  const toggleSport = (sportId: string) =>
    patch({
      sports: settings.sports.includes(sportId)
        ? settings.sports.filter((id) => id !== sportId)
        : [...settings.sports, sportId],
    })

  const handleSave = () => {
    saveSettings(settings)
    applySettings(settings)
    onClose()
  }

  const handleCancel = () => {
    applySettings(savedRef.current) // revert preview
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center overflow-y-auto">
      <div className="bg-card border border-border rounded-lg max-w-2xl w-full mx-4 my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">Settings &amp; Customization</h2>
          <button onClick={handleCancel} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
          <div className="p-6 space-y-8">
            {/* Interface Theme */}
            <section>
              <h3 className="text-lg font-semibold text-foreground mb-4">Interface</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-3 block">Main Theme</label>
                  <div className="grid grid-cols-2 gap-3">
                    {THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => patch({ theme: theme.id })}
                        className={`p-3 rounded-lg border-2 transition-colors text-left ${
                          settings.theme === theme.id
                            ? 'border-accent bg-accent/10'
                            : 'border-border hover:border-accent'
                        }`}
                      >
                        <p className="font-medium text-foreground">{theme.name}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-3 block">Accent color</label>
                  <div className="grid grid-cols-3 gap-3">
                    {COLORS.map((color) => (
                      <button
                        key={color.id}
                        onClick={() => patch({ accent: color.id })}
                        className={`p-4 rounded-lg border-2 transition-colors ${
                          settings.accent === color.id ? 'border-accent' : 'border-border hover:border-accent/50'
                        }`}
                      >
                        <div className="w-full h-8 rounded mb-2" style={{ backgroundColor: color.value }} />
                        <p className="text-xs font-medium text-foreground text-center">{color.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Language & Time */}
            <section>
              <h3 className="text-lg font-semibold text-foreground mb-4">Language &amp; Location</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Language</label>
                  <select
                    value={settings.language}
                    onChange={(e) => patch({ language: e.target.value })}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.id} value={lang.id}>{lang.flag} {lang.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Date Format</label>
                  <select
                    value={settings.dateFormat}
                    onChange={(e) => patch({ dateFormat: e.target.value })}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="mdy">MM/DD/YYYY</option>
                    <option value="dmy">DD/MM/YYYY</option>
                    <option value="ymd">YYYY-MM-DD</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Time Zone</label>
                  <select
                    value={settings.timeZone}
                    onChange={(e) => patch({ timeZone: e.target.value })}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
                <label className="text-sm font-medium text-foreground mb-3 block">Odds Format</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {ODDS_FORMATS.map((format) => (
                    <button
                      key={format.id}
                      onClick={() => patch({ oddsFormat: format.id })}
                      className={`p-4 rounded-lg border-2 transition-colors text-left ${
                        settings.oddsFormat === format.id
                          ? 'border-accent bg-accent/10'
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
                      checked={settings.sports.includes(sport.id)}
                      onChange={() => toggleSport(sport.id)}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-foreground">{sport.name}</span>
                  </label>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-border">
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-secondary transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
