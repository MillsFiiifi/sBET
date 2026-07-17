import type { SVGProps } from 'react'

/*
 * Real, line-style sport icons (24x24, currentColor, stroke 1.75) drawn inline
 * so they render identically everywhere and never depend on an icon package's
 * export names. Replaces the old emoji glyphs (⚽ 🏀 🎾 …).
 */

type IconProps = SVGProps<SVGSVGElement>

function Base({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export function SoccerIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5l4.3 3.1-1.6 5H9.3l-1.6-5L12 7.5z" />
      <path d="M12 3v4.5M4.7 9.8l3.6 1.3M6.9 18.8l2.4-3.2M17.1 18.8l-2.4-3.2M19.3 9.8l-3.6 1.3" />
    </Base>
  )
}

export function BasketballIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18M3 12h18" />
      <path d="M5.6 5.6c3.5 3 3.5 9.8 0 12.8M18.4 5.6c-3.5 3-3.5 9.8 0 12.8" />
    </Base>
  )
}

export function TennisIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.2 6.4c4 2 6.6 6 6.9 11.4M18.8 6.4c-4 2-6.6 6-6.9 11.4" />
    </Base>
  )
}

export function HockeyIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 4v11.5a2.5 2.5 0 0 0 2.5 2.5H15" />
      <path d="M15 18l4-2.2" />
      <rect x="4.5" y="18.5" width="6" height="2" rx="1" />
    </Base>
  )
}

export function FootballIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3.5c4 0 8.5 4.5 8.5 8.5S16 20.5 12 20.5 3.5 16 3.5 12 8 3.5 12 3.5z" />
      <path d="M9 12h6M11 10v4M13 10v4" />
      <path d="M6.2 6.2C5 8 4.5 10 4.6 12M17.8 17.8c1.2-1.8 1.7-3.8 1.6-5.8" />
    </Base>
  )
}

export function BaseballIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M6.5 4.8c1.7 2 2.7 4.5 2.7 7.2s-1 5.2-2.7 7.2M17.5 4.8c-1.7 2-2.7 4.5-2.7 7.2s1 5.2 2.7 7.2" />
    </Base>
  )
}

export function VolleyballIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3c-2.5 3.5-2.5 12 0 18M3.4 9.5c4 1.2 9.2 4.8 11.6 9.9M20.6 9.5c-4 1.2-9.2 4.8-11.6 9.9" />
    </Base>
  )
}

export type SportIcon = (props: IconProps) => React.ReactElement

// Keyed by the sport `id` used in lib/constants.ts.
export const SPORT_ICONS: Record<string, SportIcon> = {
  soccer: SoccerIcon,
  basketball: BasketballIcon,
  tennis: TennisIcon,
  hockey: HockeyIcon,
  'american-football': FootballIcon,
  baseball: BaseballIcon,
  volleyball: VolleyballIcon,
}
