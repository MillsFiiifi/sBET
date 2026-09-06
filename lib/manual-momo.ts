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
  number: process.env.NEXT_PUBLIC_MANUAL_MOMO_NUMBER?.trim() ?? '0558359103',
  name: process.env.NEXT_PUBLIC_MANUAL_MOMO_NAME?.trim() || 'Roger Tabimi Ukpan',
  network: process.env.NEXT_PUBLIC_MANUAL_MOMO_NETWORK?.trim() || 'MTN',
} as const

/**
 * Master switch for the manual MoMo rail. On: players pay the account above
 * from their own MoMo app, upload the receipt, and an admin approves it on
 * /admin/deposits.
 *
 * With the Instant tab switched off (`INSTANT_GATEWAY` on the deposit page)
 * this is the only cedi rail there is, so turning it off again means Ghanaian
 * players have no way to deposit but USDT. Move the two together.
 */
const MANUAL_MOMO_ENABLED = true

/**
 * Countries the manual MoMo rail is offered to. The account above is a Ghana
 * line, so only Ghanaian wallets can actually pay into it — everyone else keeps
 * Instant + USDT.
 */
export const MANUAL_MOMO_COUNTRIES: readonly string[] = ['GH']

/**
 * Gates both ends: the tab on the deposit page and POST /api/payments/manual/start.
 * Checking it in one place is what keeps the button and the route from
 * disagreeing — a hidden tab whose endpoint still accepts submissions is not
 * switched off, just harder to find.
 */
export function isManualMomoEnabled(country?: string | null): boolean {
  if (!MANUAL_MOMO_ENABLED) return false
  if (!MANUAL_MOMO.number) return false
  return MANUAL_MOMO_COUNTRIES.includes((country ?? '').toUpperCase())
}
