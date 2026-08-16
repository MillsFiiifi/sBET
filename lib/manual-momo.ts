/**
 * The mobile-money account that manual (screenshot-verified) deposits are sent
 * to. The user pays this number from their own MoMo app, uploads the receipt,
 * and an admin approves it on /admin/deposits — same pipeline USDT uses.
 *
 * NEXT_PUBLIC_* so the deposit page can render it; a merchant MoMo number isn't
 * a secret. Set these in the environment to rotate the account without a code
 * change. Clearing NEXT_PUBLIC_MANUAL_MOMO_NUMBER disables the rail entirely.
 */
export const MANUAL_MOMO = {
  number: process.env.NEXT_PUBLIC_MANUAL_MOMO_NUMBER?.trim() ?? '0535683675',
  name: process.env.NEXT_PUBLIC_MANUAL_MOMO_NAME?.trim() || 'Rebecca Adwoa Suku',
  network: process.env.NEXT_PUBLIC_MANUAL_MOMO_NETWORK?.trim() || 'MTN',
} as const

/**
 * Countries the manual MoMo rail is offered to. The account above is a Ghana
 * line, so only Ghanaian wallets can actually pay into it — everyone else keeps
 * Instant + USDT.
 */
export const MANUAL_MOMO_COUNTRIES: readonly string[] = ['GH']

export function isManualMomoEnabled(country?: string | null): boolean {
  if (!MANUAL_MOMO.number) return false
  return MANUAL_MOMO_COUNTRIES.includes((country ?? '').toUpperCase())
}
