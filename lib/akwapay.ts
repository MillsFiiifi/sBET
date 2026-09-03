// AkwaPay integration — Ghana mobile-money (GHS) deposits.
//
// Shape of the flow:
//   POST /v1/payment_intents            create the charge (amount in pesewas)
//   branch on next_action.type          await_prompt | submit_otp | redirect
//   POST /v1/payment_intents/{id}/validate   submit an OTP, if one is wanted
//   GET  /v1/payment_intents/{id}       poll — the only source of truth
//   POST <our webhook>                  push notification, same truth, earlier
//
// Two rules from AkwaPay's guide drive most of the odd-looking bits here:
//
//  1. `metadata` is stored but never replayed on the webhook — only
//     `reference` comes back. So `reference` is our sole handle on a payment,
//     and we resolve the user from our own `payments` row rather than from
//     anything the gateway hands us.
//  2. `unknown` is not a failure. It means the gateway has not answered yet.
//     Treating it as failed is how you double-charge someone, so it maps to
//     'pending' in classifyIntentStatus and the poller keeps waiting.
//
// Which gateway AkwaPay routes a charge through (Moolre, then Flutterwave, and
// whatever comes next) is invisible from here — the contract above is the same
// either way. So nothing in this file may branch on the gateway, and the `raw`
// field on an intent, which mirrors the gateway's own response, is off limits:
// its shape is undocumented and changes with the routing.

import { createHmac, randomUUID, timingSafeEqual } from 'crypto'

const DEFAULT_BASE = 'https://akwapayapi.onrender.com'

function getBase(): string {
  return (process.env.AKWAPAY_BASE_URL?.trim() || DEFAULT_BASE).replace(/\/+$/, '')
}

function getSecretKey(): string {
  const v = process.env.AKWAPAY_SECRET_KEY?.trim()
  if (!v) throw new Error('AKWAPAY_SECRET_KEY is not configured')
  return v
}

export function isAkwapayConfigured(): boolean {
  return Boolean(process.env.AKWAPAY_SECRET_KEY?.trim())
}

/** The `whsec_...` minted by POST /v1/webhook_endpoints. Shown once, ever. */
export function getWebhookSecret(): string | null {
  return process.env.AKWAPAY_WEBHOOK_SECRET?.trim() || null
}

/** True when the configured key is a live key — used to keep test mode loud. */
export function isLiveKey(): boolean {
  return (process.env.AKWAPAY_SECRET_KEY?.trim() ?? '').startsWith('sk_live_')
}

// ---- Networks -------------------------------------------------------------

export type AkwapayNetwork = 'MTN' | 'TELECEL' | 'AIRTELTIGO'

// Our payout-network keys (and the older UI ids) → AkwaPay network codes.
// Vodafone Ghana is Telecel now; both spellings land on TELECEL.
const NETWORK_MAP: Record<string, AkwapayNetwork> = {
  mtn: 'MTN',
  telecel: 'TELECEL',
  vod: 'TELECEL',
  vodafone: 'TELECEL',
  atl: 'AIRTELTIGO',
  airteltigo: 'AIRTELTIGO',
}

export function toAkwapayNetwork(key: string | undefined | null): AkwapayNetwork | null {
  return NETWORK_MAP[(key ?? '').trim().toLowerCase()] ?? null
}

// ---- Amounts --------------------------------------------------------------

/**
 * GHS major units → pesewas. The API rejects `50.00` with a 400; it wants
 * `5000`. Rounding here (rather than truncating) keeps 0.1+0.2 style float
 * drift from quietly shaving a pesewa off the charge.
 */
export function toPesewas(amount: number): number {
  return Math.round(amount * 100)
}

// ---- HTTP -----------------------------------------------------------------

// Hard timeout plus a couple of retries on transient gateway errors, matching
// how lib/flutterwave.ts treats the same class of failure. The default base
// URL is a Render instance, which can cold-start slowly — hence 25s.
async function akwaFetch(
  path: string,
  init: RequestInit,
  opts: { timeoutMs?: number; retries?: number } = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 25_000
  const retries = opts.retries ?? 2
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(`${getBase()}${path}`, { ...init, signal: ctrl.signal })
      if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
        continue
      }
      return res
    } catch (e) {
      lastErr = e
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
        continue
      }
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('akwapay request failed')
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getSecretKey()}`,
    'Content-Type': 'application/json',
  }
}

function errorMessage(body: unknown, fallback: string): string {
  const err = (body as { error?: { message?: string; code?: string } } | null)?.error
  return err?.message?.trim() || fallback
}

function errorCode(body: unknown): string | null {
  return (body as { error?: { code?: string } } | null)?.error?.code ?? null
}

// ---- Create an intent -----------------------------------------------------

export type NextActionType = 'await_prompt' | 'submit_otp' | 'redirect' | 'none'

export interface CreateIntentInput {
  /** Our reference — unique per AkwaPay account, and our only webhook handle. */
  reference: string
  /** Major units (GHS). Converted to pesewas here. */
  amount: number
  network: AkwapayNetwork
  phone: string
  returnUrl?: string
  metadata?: Record<string, unknown>
}

export interface CreateIntentResult {
  id: string
  status: string
  reference: string
  clientSecret: string | null
  checkoutUrl: string | null
  nextAction: NextActionType
  /** Only set when nextAction === 'redirect'. */
  redirectUrl: string | null
  /** When the on-phone prompt lapses, if the gateway told us. */
  expiresAt: string | null
  /**
   * `next_action.ussd_fallback` — the prompt wording, written by whichever
   * gateway took the charge. Show it verbatim; do not paraphrase it or
   * hardcode our own copy in its place, because it changes with the gateway.
   */
  instruction: string | null
}

export async function createPaymentIntent(
  input: CreateIntentInput,
): Promise<CreateIntentResult> {
  const res = await akwaFetch('/v1/payment_intents', {
    method: 'POST',
    headers: {
      ...authHeaders(),
      // Fresh per attempt: replaying the SAME key replays the stored response
      // instead of charging twice. The unique `reference` is the real dedupe.
      'Idempotency-Key': randomUUID(),
    },
    body: JSON.stringify({
      amount: toPesewas(input.amount),
      currency: 'GHS',
      method: 'mobile_money',
      network: input.network,
      customer: { phone: input.phone },
      reference: input.reference,
      ...(input.returnUrl ? { return_url: input.returnUrl } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    }),
  })

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null

  if (!res.ok) {
    const code = errorCode(body)
    // A duplicate reference means we already created this intent — a retry of
    // our own request, not a customer-visible fault. Surface it distinctly so
    // the caller can fall through to polling the existing one.
    if (code === 'duplicate_reference') {
      throw new AkwapayDuplicateReference(input.reference)
    }
    // An answered refusal: AkwaPay reached the gateway and it said no, so no
    // charge exists. Distinct from the throw below (and from akwaFetch giving
    // up), where we never learned whether a charge was created.
    throw new AkwapayChargeRefused(
      errorMessage(body, `AkwaPay returned ${res.status}`),
      code,
      res.status,
    )
  }
  if (!body?.id) throw new Error('AkwaPay did not return a payment intent id')

  const next = (body.next_action ?? null) as
    | {
        type?: string
        url?: string
        // Both spellings are in AkwaPay's own docs — camelCase in the original
        // reference, snake_case in the current one. Accept either.
        expiresAt?: string
        expires_at?: string
        ussd_fallback?: string
      }
    | null

  return {
    id: String(body.id),
    status: String(body.status ?? 'requires_action'),
    reference: String(body.reference ?? input.reference),
    clientSecret: body.client_secret ? String(body.client_secret) : null,
    checkoutUrl: body.checkout_url ? String(body.checkout_url) : null,
    nextAction: normalizeNextAction(next?.type),
    redirectUrl: next?.url ? String(next.url) : null,
    expiresAt: next?.expires_at
      ? String(next.expires_at)
      : next?.expiresAt
        ? String(next.expiresAt)
        : null,
    instruction: next?.ussd_fallback ? String(next.ussd_fallback) : null,
  }
}

export class AkwapayDuplicateReference extends Error {
  constructor(reference: string) {
    super(`AkwaPay already has an intent for reference ${reference}`)
    this.name = 'AkwapayDuplicateReference'
  }
}

/**
 * The gateway answered and declined the charge. Nothing was created, so the
 * pending row can be closed and the player can safely try again.
 *
 * `message` is the gateway's own text, e.g. "Flutterwave: Transaction limit has
 * been exceeded. Please contact support". Keep it for logs and the ledger —
 * it names the gateway that took the charge, which is exactly what support
 * needs — but don't put it in front of a player: they never chose Flutterwave,
 * and "contact support" means AkwaPay's support, not ours. Run it through
 * playerFacingChargeError first.
 */
export class AkwapayChargeRefused extends Error {
  readonly code: string | null
  readonly httpStatus: number
  constructor(message: string, code: string | null, httpStatus: number) {
    super(message)
    this.name = 'AkwapayChargeRefused'
    this.code = code
    this.httpStatus = httpStatus
  }
}

/**
 * Turn a gateway refusal into a sentence a player can act on.
 *
 * Matching is on the message text because the gateway writes it and AkwaPay
 * passes it through — there is no stable error code underneath these. So it is
 * best-effort by design, and anything unmatched falls back to wording that is
 * true whatever went wrong.
 *
 * Says what happened, not what to do instead: only the deposit page knows
 * which other rails are switched on for this player, so it adds that part.
 */
export function playerFacingChargeError(raw: string): string {
  const m = raw.toLowerCase()

  // The limit can be the player's own wallet cap or the merchant account's,
  // and nothing here can tell which — so the wording has to fit both.
  if (m.includes('limit')) {
    return 'That amount is over the limit for a single mobile-money payment right now. Try a smaller amount.'
  }
  if (m.includes('insufficient') || m.includes('balance')) {
    return 'There isn’t enough money in that mobile-money wallet for this payment.'
  }
  if (m.includes('msisdn') || m.includes('phone') || m.includes('number')) {
    return 'That mobile-money number was rejected. Check it and try again.'
  }
  if (m.includes('network') || m.includes('operator')) {
    return 'That network can’t take the payment right now. Try another network.'
  }
  return 'The payment couldn’t be started. Try again in a moment.'
}

/**
 * Every `next_action.type` AkwaPay documents, mapped to the branch we take.
 *
 * `payment_instruction` is the same thing as `await_prompt` under a different
 * label — it is what mobile-money charges come back as now that AkwaPay routes
 * through Flutterwave rather than Moolre. It has to be listed explicitly: the
 * whole UI branch hangs off this one field, so a label we do not recognise
 * falls to the default and a failover silently changes how the deposit behaves
 * even though nothing changed on our side.
 */
function normalizeNextAction(type: string | undefined): NextActionType {
  switch ((type ?? '').toLowerCase()) {
    case 'await_prompt':
    case 'payment_instruction':
      return 'await_prompt'
    case 'submit_otp':
      return 'submit_otp'
    case 'redirect':
      return 'redirect'
    case 'none':
      return 'none'
    default:
      // Absent or unrecognised: nothing we know to collect, so go and poll —
      // the intent is the source of truth either way.
      if (type) console.warn('[akwapay] unrecognised next_action.type:', type)
      return 'none'
  }
}

// ---- Poll -----------------------------------------------------------------

export interface IntentSnapshot {
  found: boolean
  status: string
  /** Minor units (pesewas), as the API reports them. */
  amountMinor: number | null
  currency: string | null
}

export async function getPaymentIntent(id: string): Promise<IntentSnapshot> {
  const res = await akwaFetch(`/v1/payment_intents/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: authHeaders(),
  })

  if (res.status === 404) return { found: false, status: 'not_found', amountMinor: null, currency: null }

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!res.ok) throw new Error(errorMessage(body, `AkwaPay returned ${res.status}`))

  // §6 returns `amount`; the public checkout lookup returns `amount_minor`.
  // Both are pesewas, so accept whichever came back.
  const raw = body?.amount ?? body?.amount_minor
  const amountMinor = typeof raw === 'number' ? raw : raw != null ? Number(raw) : null

  return {
    found: true,
    status: String(body?.status ?? 'unknown'),
    amountMinor: Number.isFinite(amountMinor as number) ? (amountMinor as number) : null,
    currency: body?.currency ? String(body.currency) : null,
  }
}

/**
 * Collapse an intent status into the three outcomes a caller cares about.
 *
 * Note `unknown` maps to 'pending', deliberately. The gateway has simply not
 * answered yet; calling it failed invites a retry on a charge that may still
 * land, and that is a double charge. Anything unrecognised is also pending —
 * we would rather keep waiting on a status we have never seen than write off
 * a payment that succeeded.
 */
export function classifyIntentStatus(status: string): 'success' | 'failed' | 'pending' {
  switch (status.trim().toLowerCase()) {
    case 'succeeded':
      return 'success'
    case 'failed':
    case 'declined':
    case 'cancelled':
    case 'canceled':
    case 'expired':
      return 'failed'
    default:
      return 'pending'
  }
}

// ---- OTP ------------------------------------------------------------------

export type OtpOutcome =
  /** Code taken. Still not proof of payment — go and poll. */
  | { outcome: 'accepted'; status: string }
  /** This gateway cannot accept OTPs over the API. Not the customer's fault. */
  | { outcome: 'not-supported' }
  /** The code itself was rejected — worth letting them retype it. */
  | { outcome: 'rejected'; message: string }

/**
 * Submit an OTP through our own backend (§4b), so the secret key stays server
 * side and the customer never talks to AkwaPay directly.
 *
 * `not_supported` is called out separately because some gateways behind
 * AkwaPay have no OTP-submit route yet. That is not a dead end: the payment
 * may still complete on the handset, so the caller falls through to polling
 * rather than showing an error.
 *
 * This path barely fires now — OTP was Moolre's flow, and charges routed
 * through Flutterwave come back as a push prompt instead. Keep it anyway:
 * AkwaPay can fail a charge over to another gateway at any time, and an
 * integration that only handles today's happy path breaks on the day it does.
 */
export async function validateOtp(intentId: string, otp: string): Promise<OtpOutcome> {
  const res = await akwaFetch(`/v1/payment_intents/${encodeURIComponent(intentId)}/validate`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ otp }),
  })

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null

  if (!res.ok) {
    if (errorCode(body) === 'not_supported' || res.status === 501) {
      return { outcome: 'not-supported' }
    }
    return { outcome: 'rejected', message: errorMessage(body, 'That code did not work.') }
  }

  return { outcome: 'accepted', status: String(body?.status ?? 'requires_action') }
}

// ---- Webhook signature ----------------------------------------------------

const MAX_SIGNATURE_AGE_SECONDS = 300

/**
 * Verify `X-AkwaPay-Signature: t=<unix>,v1=<hex>`.
 *
 * `rawBody` must be the exact bytes received. Re-serialising parsed JSON
 * changes key order and whitespace, and the HMAC will never match again.
 *
 * Fails closed when no secret is configured — an unconfigured deployment
 * rejects webhooks rather than accepting forged ones.
 */
export function verifyWebhookSignature(rawBody: string, header: string | null): boolean {
  const secret = getWebhookSecret()
  if (!secret || !header) return false

  const parts: Record<string, string> = {}
  for (const piece of header.split(',')) {
    const idx = piece.indexOf('=')
    if (idx > 0) parts[piece.slice(0, idx).trim()] = piece.slice(idx + 1).trim()
  }
  if (!parts.t || !parts.v1) return false

  // Replay protection: a `succeeded` event captured once must not be
  // replayable tomorrow.
  const ts = Number(parts.t)
  if (!Number.isFinite(ts)) return false
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > MAX_SIGNATURE_AGE_SECONDS) return false

  const expected = createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex')

  // Constant time — `===` on a signature leaks it a byte at a time. Lengths
  // must match before timingSafeEqual, which throws on a mismatch.
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(parts.v1, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}
