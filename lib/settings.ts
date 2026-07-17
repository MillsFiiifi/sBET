'use client'

// User-facing appearance settings: dark/light theme + accent colour, plus a
// few remembered preferences. Persisted to localStorage and applied to the
// <html> element (theme class + inline CSS-variable overrides). Components
// subscribe to SETTINGS_EVENT to react to changes.

export type ThemeMode = 'dark' | 'light'

export interface AppSettings {
  theme: ThemeMode
  accent: string
  language: string
  dateFormat: string
  timeZone: string
  oddsFormat: string
  sports: string[]
}

/** Accent palette. Each sets --primary/--accent to `value`, text to `fg`. */
export const ACCENTS: Record<string, { value: string; fg: string; label: string }> = {
  blue: { value: '#2f7bff', fg: '#ffffff', label: 'Blue' },
  orange: { value: '#f97316', fg: '#0b1220', label: 'Orange' },
  green: { value: '#22c55e', fg: '#0b1220', label: 'Green' },
  purple: { value: '#a855f7', fg: '#ffffff', label: 'Purple' },
  red: { value: '#ef4444', fg: '#ffffff', label: 'Red' },
  pink: { value: '#ec4899', fg: '#ffffff', label: 'Pink' },
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  accent: 'blue',
  language: 'en',
  dateFormat: 'dmy',
  timeZone: 'utc',
  oddsFormat: 'decimal',
  sports: ['soccer', 'basketball', 'tennis'],
}

const KEY = 'sbet_settings'
export const SETTINGS_EVENT = 'sbet-settings-changed'

export function getSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: AppSettings): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(s))
  window.dispatchEvent(new Event(SETTINGS_EVENT))
}

/** Apply theme + accent to the document without persisting (used for preview). */
export function applySettings(s: AppSettings): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  // Theme class
  root.classList.remove('light', 'dark')
  root.classList.add(s.theme)

  // Accent overrides (inline styles win over the palette classes)
  const a = ACCENTS[s.accent] ?? ACCENTS.blue
  const set = (k: string, v: string) => root.style.setProperty(k, v)
  set('--primary', a.value)
  set('--primary-foreground', a.fg)
  set('--accent', a.value)
  set('--accent-foreground', a.fg)
  set('--ring', a.value)
  set('--sidebar-primary', a.value)
  set('--sidebar-primary-foreground', a.fg)
  set('--sidebar-accent', a.value)
  set('--sidebar-accent-foreground', a.fg)
  set('--sidebar-ring', a.value)
}
