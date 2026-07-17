import { DEFAULT_CURRENCY, getCountryForCurrency, isCurrencyCode, type CurrencyCode } from '@/lib/countries'

/**
 * Format a number as "1,234,567.89" — two decimals, thousands separators.
 *
 * Locale is picked from the currency's country (GHS → en-GB, NGN → en-NG, etc.)
 * so groupings render the way users from each region expect.
 *
 * Call with just an amount to keep the old GHS behaviour; pass `currency` to
 * format for another wallet.
 */
export function formatMoney(n: number, currency?: string): string {
  const code: CurrencyCode = isCurrencyCode(currency) ? currency : DEFAULT_CURRENCY
  const locale = getCountryForCurrency(code).locale
  return n.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Render an amount with its currency symbol prefix, e.g. "GHS 1,200.00",
 * "₦ 30,000.00", "KSh 2,500.00", "R 350.00". Falls back to GHS for unknown
 * codes so legacy callers keep rendering.
 */
export function formatMoneyWithCurrency(n: number, currency?: string): string {
  const code: CurrencyCode = isCurrencyCode(currency) ? currency : DEFAULT_CURRENCY
  const symbol = getCountryForCurrency(code).currencySymbol
  return `${symbol} ${formatMoney(n, code)}`
}
