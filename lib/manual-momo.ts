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
  number: process.env.NEXT_PUBLIC_MANUAL_MOMO_NUMBER?.trim() ?? '0594395361',
  name: process.env.NEXT_PUBLIC_MANUAL_MOMO_NAME?.trim() || 'Evans Kyeremeh',
  network: process.env.NEXT_PUBLIC_MANUAL_MOMO_NETWORK?.trim() || 'MTN',
} as const

/**
 * Master switch for the manual MoMo rail. Off: players deposit through the
 * Instant tab (AkwaPay charges the phone directly) or USDT, and nothing new
 * lands in the pay-then-upload queue an admin has to approve by hand.
 *
 * Set back to `true` to bring it straight back — the account details above,
 * the deposit tab, the upload route and the admin approval screen are all
 * still here and still wired up. Deposits already submitted are unaffected:
 * this only stops new ones, so anything pending still shows on /admin/deposits
 * and can still be approved.
 */
const MANUAL_MOMO_ENABLED = false

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
