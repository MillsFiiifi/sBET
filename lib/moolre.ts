// Moolre — Ghana payment gateway integration.
//
// We use the `embed/src/start` API to mint a one-shot hosted-checkout URL
// per transaction. The customer is redirected to that URL, pays via MTN MoMo
// / Telecel Cash / AirtelTigo Money, and Moolre POSTs the result to our
// webhook receiver at /api/payments/moolre/callback (signed with
// MOOLRE_SECRET_KEY) so the player is auto-credited.
//
// Endpoint + payload mirror Moolre's official WooCommerce plugin
// (https://wordpress.org/plugins/moolre-payment-gateway/) — `state: 'starter'`
// initiates and returns `data.authorization_url`; `state: 'confirm'` verifies
// a reference after the fact. Only X-Api-Pubkey is required.

import { randomBytes } from 'crypto'
import { getMinFirstDeposit as countryMinFirstDeposit } from '@/lib/countries'

const MOOLRE_BASE =
  process.env.MOOLRE_BASE_URL?.trim().replace(/\/$/, '') || 'https://api.moolre.com'
const MOOLRE_ENDPOINT = `${MOOLRE_BASE}/embed/src/start`

// Direct (in-app) collection endpoints — the customer enters their number on
// our own checkout and gets the MoMo PIN prompt; no Moolre hosted page.
const MOOLRE_PAYMENT_ENDPOINT = `${MOOLRE_BASE}/open/transact/payment`
const MOOLRE_STATUS_ENDPOINT = `${MOOLRE_BASE}/open/transact/status`
// Payment channel. 13 = MTN MoMo (the only channel enabled for API topup on
// the current account). Override with MOOLRE_CHANNEL if Moolre enables more.
const MOOLRE_CHANNEL = process.env.MOOLRE_CHANNEL?.trim() || '13'

export interface MoolreInitInput {
  amount: number
  reference: string
  email: string
  callbackUrl: string
  currency?: string
}

export interface MoolreInitResult {
  authorizationUrl: string
  reference: string
}

export interface MoolreVerifyResult {
  /** Raw Moolre response — shape varies by transaction state. */
  raw: Record<string, unknown>
  ok: boolean
  message: string | null
}

function requireCreds(): { pubKey: string; account: string } {
  const pubKey = process.env.MOOLRE_PUBLIC_KEY?.trim()
  const account = process.env.MOOLRE_ACCOUNT_NUMBER?.trim()
  if (!pubKey) throw new Error('MOOLRE_PUBLIC_KEY is not configured')
  if (!account) throw new Error('MOOLRE_ACCOUNT_NUMBER is not configured')
  return { pubKey, account }
}

function isSuccessfulStatus(status: unknown): boolean {
  // Moolre uses 1 / true / "1" for success and 0 / false / "0" for failure.
  if (status === 1 || status === true || status === '1') return true
  return false
}

/**
 * Kick off a one-time hosted checkout. Moolre returns an `authorization_url`
 * we redirect the customer to — they pay there, then Moolre fires our webhook.
 */
export async function initialiseMoolreTransaction(
  input: MoolreInitInput,
): Promise<MoolreInitResult> {
  const { pubKey, account } = requireCreds()

  const body = {
    state: 'starter',
    accountnumber: account,
    reference: input.reference,
    nonce_value: randomBytes(16).toString('hex'),
    email: input.email,
    amount: input.amount,
    currency: input.currency ?? 'GHS',
    callback: input.callbackUrl,
    tx_source: 'primebet',
  }

  const res = await fetch(MOOLRE_ENDPOINT, {
    method: 'POST',
    headers: {
      'X-Api-Pubkey': pubKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  const raw = (await res.json().catch(() => ({}))) as {
    status?: unknown
    code?: string | number
    message?: string | string[]
    data?: { authorization_url?: string }
  }

  if (!res.ok || !isSuccessfulStatus(raw.status)) {
    const msg = Array.isArray(raw.message)
      ? raw.message.join(' · ')
      : raw.message ?? `HTTP ${res.status}`
    const code = raw.code ? `[${raw.code}] ` : ''
    // Log the full response so the operator can see Moolre's error code
    // (AIN01 = bad auth, AIN03 = bad signature, etc.) without redeploying.
    console.error('[moolre] init rejected', {
      httpStatus: res.status,
      moolreStatus: raw.status,
      moolreCode: raw.code,
      moolreMessage: raw.message,
      requestRef: input.reference,
    })
    throw new Error(`Moolre init failed: ${code}${msg}`)
  }

  const url = raw.data?.authorization_url
  if (!url) {
    throw new Error('Moolre init returned no authorization_url')
  }

  return { authorizationUrl: url, reference: input.reference }
}

/**
 * Confirm a transaction by reference. Useful as a defensive recheck when the
 * webhook is late or to back-fill a payment that arrived during an outage.
 */
export async function verifyMoolreTransaction(
  reference: string,
): Promise<MoolreVerifyResult> {
  const { pubKey, account } = requireCreds()

  const body = {
    state: 'confirm',
    accountnumber: account,
    reference,
  }

  const res = await fetch(MOOLRE_ENDPOINT, {
    method: 'POST',
    headers: {
      'X-Api-Pubkey': pubKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  const raw = (await res.json().catch(() => ({}))) as {
    status?: unknown
    message?: string | string[]
    data?: { status?: unknown; paid_at?: string | null }
  }

  // CRITICAL: the TOP-LEVEL `status` only means "the verify lookup succeeded"
  // (Moolre returns status:true / "Verification successful" even for a
  // checkout the customer opened but NEVER paid). The ACTUAL payment result is
  // data.status — "1" = paid, "0" = unpaid/pending — confirmed by paid_at being
  // set. We must gate crediting on data.status, NOT the envelope status, or we
  // credit unpaid deposits.
  const payStatus = raw.data?.status
  const paidAt = raw.data?.paid_at
  const paid =
    isSuccessfulStatus(payStatus) || // data.status === 1 / "1" / true
    (paidAt != null && String(payStatus) !== '0') // settled (has a paid_at)

  const ok = res.ok && paid
  const message = Array.isArray(raw.message)
    ? raw.message.join(' · ')
    : raw.message ?? null
  return { raw, ok, message }
}

// ── Direct (in-app) mobile-money collection ──────────────────────────────────

export interface MoolreChargeInput {
  /** Payer MoMo number in local form, e.g. "0244XXXXXXX". */
  payer: string
  amount: number
  /** Customer-facing narration (shown in the MoMo message). */
  reference: string
  /** Our unique tracking id — used to poll status later. */
  externalref: string
  currency?: string
  /** OTP code from the SMS, on the second (verification) call. */
  otpcode?: string
}

export interface MoolreChargeResult {
  ok: boolean
  /** Moolre asked for the SMS OTP (code TP14) — prompt the user for it. */
  otpRequired: boolean
  /** OTP was wrong/expired (code TP15) — let the user re-enter / resend. */
  otpInvalid: boolean
  code: string | null
  message: string | null
  raw: Record<string, unknown>
}

/**
 * Trigger a direct MoMo collection. Moolre runs an SMS-OTP step first: the
 * initial call (no otpcode) returns TP14 and texts a code to the payer; call
 * again with the same externalref + otpcode to complete. Then poll
 * getMoolreDirectStatus(externalref).
 */
export async function chargeMoolreDirect(
  input: MoolreChargeInput,
): Promise<MoolreChargeResult> {
  const { pubKey, account } = requireCreds()
  const payload: Record<string, unknown> = {
    type: 1,
    channel: MOOLRE_CHANNEL,
    currency: input.currency ?? 'GHS',
    amount: input.amount,
    payer: input.payer,
    reference: input.reference,
    externalref: input.externalref,
    accountnumber: account,
  }
  if (input.otpcode) payload.otpcode = input.otpcode

  const res = await fetch(MOOLRE_PAYMENT_ENDPOINT, {
    method: 'POST',
    // Exactly ONE pubkey header — sending two case-variants makes fetch combine
    // them into "key, key", which Moolre rejects as AIN01 Authentication Error.
    headers: {
      'X-Api-Pubkey': pubKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  const raw = (await res.json().catch(() => ({}))) as {
    status?: unknown
    code?: string
    message?: string | string[]
  }
  const ok = isSuccessfulStatus(raw.status)
  const code = raw.code ?? null
  const message = Array.isArray(raw.message) ? raw.message.join(' · ') : raw.message ?? null
  // TP14 = OTP sent / required; TP15 = wrong or expired OTP.
  const otpRequired = code === 'TP14'
  const otpInvalid = code === 'TP15'
  if (!ok && !otpRequired) {
    console.error('[moolre] direct charge rejected', {
      code,
      message: raw.message,
      externalref: input.externalref,
    })
  }
  return { ok, otpRequired, otpInvalid, code, message, raw }
}

export type MoolreTxState = 'success' | 'pending' | 'failed' | 'not-found'

export interface MoolreStatusResult {
  state: MoolreTxState
  txstatus: number | null
  code: string | null
  message: string | null
}

/**
 * Poll a direct charge by our externalref (idtype 1). Moolre's
 * data.txstatus: 1 = successful, 2 = pending, 3 = failed. Code SS07 means the
 * transaction hasn't registered yet (treat as pending right after kickoff).
 */
export async function getMoolreDirectStatus(
  externalref: string,
): Promise<MoolreStatusResult> {
  const { pubKey, account } = requireCreds()
  const res = await fetch(MOOLRE_STATUS_ENDPOINT, {
    method: 'POST',
    headers: {
      'X-Api-Pubkey': pubKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ type: 1, idtype: 1, accountnumber: account, externalref }),
    cache: 'no-store',
  })
  const raw = (await res.json().catch(() => ({}))) as {
    code?: string
    message?: string | string[]
    data?: { txstatus?: number }
  }
  const txstatus = typeof raw.data?.txstatus === 'number' ? raw.data.txstatus : null
  const message = Array.isArray(raw.message) ? raw.message.join(' · ') : raw.message ?? null
  let state: MoolreTxState
  if (raw.code === 'SS07') state = 'not-found'
  else if (txstatus === 1) state = 'success'
  else if (txstatus === 3) state = 'failed'
  else state = 'pending'
  return { state, txstatus, code: raw.code ?? null, message }
}

/**
 * Ghana-only minimum first deposit. Other countries call
 * `getMinFirstDeposit(country)` from `lib/countries.ts` directly.
 */
export function getMinFirstDeposit(): number {
  const raw = process.env.MIN_FIRST_DEPOSIT
  const n = Number(raw)
  if (Number.isFinite(n) && n > 0) return n
  return countryMinFirstDeposit('GH')
}
