import type { League, Sport } from './types'

export const sports: Sport[] = [
  { id: 'football', name: 'Football', icon: '⚽', matchCount: 0 },
  { id: 'basketball', name: 'Basketball', icon: '🏀', matchCount: 0 },
  { id: 'tennis', name: 'Tennis', icon: '🎾', matchCount: 0 },
  { id: 'baseball', name: 'Baseball', icon: '⚾', matchCount: 0 },
  { id: 'hockey', name: 'Hockey', icon: '🏒', matchCount: 0 },
  { id: 'volleyball', name: 'Volleyball', icon: '🏐', matchCount: 0 },
]

export const leagues: League[] = [
  { id: 'champions-league', name: 'Champions League', country: 'Europe', flag: '🏆', matchCount: 0 },
  { id: 'premier-league', name: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', matchCount: 0 },
  { id: 'la-liga', name: 'La Liga', country: 'Spain', flag: '🇪🇸', matchCount: 0 },
  { id: 'serie-a', name: 'Serie A', country: 'Italy', flag: '🇮🇹', matchCount: 0 },
  { id: 'bundesliga', name: 'Bundesliga', country: 'Germany', flag: '🇩🇪', matchCount: 0 },
  { id: 'ligue-1', name: 'Ligue 1', country: 'France', flag: '🇫🇷', matchCount: 0 },
]

export const countries = [
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
  { code: 'GB-ENG', name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'GR', name: 'Greece', flag: '🇬🇷' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'US', name: 'USA', flag: '🇺🇸' },
]
