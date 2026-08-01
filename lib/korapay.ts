// Korapay integration — covers Nigeria (NGN) and Ghana (GHS) deposits.
//
// Flow (mirrors the Paystack integration):
//   1. Frontend POSTs to /api/payments/korapay/start with userId + amount.
//   2. We hit POST /merchant/api/v1/charges/initialize, pass the user's
//      currency, and write a pending row to `payments` keyed on our reference.
//   3. User pays on Korapay's hosted checkout, then Korapay redirects back to
//      /api/payments/korapay/callback?reference=<ours>.
//   4. We verify with GET /merchant/api/v1/charges/:reference. On success we
//      call applyDepositCredit() — same pipeline as the admin manual-credit
//      flow, so verification gates and sub-admin commissions fire automatically.
//   5. Defence-in-depth: Korapay also POSTs a signed webhook to
//      /api/payments/korapay/webhook; the same credit pipeline runs there.
//
// IMPORTANT — unlike Paystack, Korapay amounts are in MAJOR units (the actual
// currency value). amount: 1000 means ₦1,000 / GH₵1,000, NOT kobo/pesewas.
// Do NOT multiply by 100.
//
// IMPORTANT — trust the inner data.status, never the envelope `status: true`
// (which only means "the API call succeeded"). Same lesson as Moolre: credit
// only when data.status === 'success'.

import { createHmac, timingSafeEqual } from 'crypto'
import type { CountryCode, CurrencyCode } from '@/lib/countries'

const KORAPAY_BASE = 'https://api.korapay.com/merchant/api/v1'

export interface KorapayInitResponse {
  reference: string
  checkout_url: string
}

// Korapay charge statuses: success, processing, pending, failed, expired.
export interface KorapayChargeData {
  reference: string
  status: 'success' | 'processing' | 'pending' | 'failed' | 'expired' | string
  amount: number | string // major units
  currency: string
  amount_paid?: number | string
}

// Korapay Nigeria and Korapay Ghana are SEPARATE merchant accounts with their
// own keys. We look up a country-specific key first
// (KORAPAY_SECRET_KEY_NG / _GH, KORAPAY_PUBLIC_KEY_NG / _GH) and fall back to
// the generic KORAPAY_SECRET_KEY / KORAPAY_PUBLIC_KEY for single-account setups.
function getSecretKey(country?: CountryCode): string {
  const specific = country
    ? process.env[`KORAPAY_SECRET_KEY_${country}`]?.trim()
    : ''
  const key = specific || process.env.KORAPAY_SECRET_KEY?.trim()
  if (!key) {
    throw new Error(
      `Korapay secret key is not configured${country ? ` for ${country}` : ''}`,
    )
  }
  return key
}

export function getKorapayPublicKey(country?: CountryCode): string | null {
  const specific = country
    ? process.env[`KORAPAY_PUBLIC_KEY_${country}`]?.trim()
    : ''
  return specific || process.env.KORAPAY_PUBLIC_KEY?.trim() || null
}

/** Every distinct Korapay secret key configured, used to validate webhooks
 *  that could be signed by either the NG or GH account. */
function allSecretKeys(): string[] {
  const raw = [
    process.env.KORAPAY_SECRET_KEY,
    process.env.KORAPAY_SECRET_KEY_NG,
    process.env.KORAPAY_SECRET_KEY_GH,
  ]
  return [...new Set(raw.map((k) => k?.trim()).filter((k): k is string => !!k))]
}

/** Coerce Korapay's amount (which may arrive as a string) to a number. */
export function toAmountNumber(value: number | string): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : NaN
}

export async function initialiseCharge(input: {
  email: string
  name: string
  amount: number // major units
  currency: CurrencyCode
  country: CountryCode
  reference: string
  redirectUrl: string
  notificationUrl: string
  narration?: string
  metadata?: Record<string, unknown>
}): Promise<KorapayInitResponse> {
  const res = await fetch(`${KORAPAY_BASE}/charges/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getSecretKey(input.country)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // Korapay expects the major-unit amount as-is — no minor-unit conversion.
      amount: input.amount,
      currency: input.currency,
      reference: input.reference,
      redirect_url: input.redirectUrl,
      notification_url: input.notificationUrl,
      narration: input.narration ?? 'Deposit',
      customer: { email: input.email, name: input.name },
      metadata: input.metadata ?? {},
    }),
    cache: 'no-store',
  })
  const body = (await res.json().catch(() => ({}))) as {
    status?: boolean
    message?: string
    data?: KorapayInitResponse
  }
  if (!res.ok || !body.status || !body.data?.checkout_url) {
    throw new Error(
      `Korapay init failed: ${body.message ?? `HTTP ${res.status}`}`,
    )
  }
  return body.data
}

export async function verifyCharge(
  reference: string,
  country?: CountryCode,
): Promise<KorapayChargeData> {
  const res = await fetch(
    `${KORAPAY_BASE}/charges/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${getSecretKey(country)}` },
      cache: 'no-store',
    },
  )
  const body = (await res.json().catch(() => ({}))) as {
    status?: boolean
    message?: string
    data?: KorapayChargeData
  }
  if (!res.ok || !body.status || !body.data) {
    throw new Error(
      `Korapay verify failed: ${body.message ?? `HTTP ${res.status}`}`,
    )
  }
  return body.data
}

/**
 * Verify a Korapay webhook signature. Korapay signs the HMAC-SHA256 of
 * JSON.stringify(payload.data) — ONLY the inner data object, not the whole
 * envelope — keyed on the secret key, and sends it in the
 * `x-korapay-signature` header as lowercase hex.
 */
// A webhook may be signed by either the NG or GH account key, so we accept the
// signature if it matches ANY configured key.
export function verifyWebhookSignature(
  dataObject: unknown,
  headerSig: string,
): boolean {
  if (!headerSig) return false
  const payload = JSON.stringify(dataObject)
  let provided: Buffer
  try {
    provided = Buffer.from(headerSig.trim().toLowerCase(), 'hex')
  } catch {
    return false
  }
  for (const secret of allSecretKeys()) {
    const expected = createHmac('sha256', secret).update(payload).digest('hex')
    const a = Buffer.from(expected, 'hex')
    if (provided.length === a.length && timingSafeEqual(a, provided)) return true
  }
  return false
}
