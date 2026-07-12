// Paystack mobile-money charge (Ghana). The customer gets an on-phone prompt
// to approve with their MoMo PIN; some networks return an OTP to submit.
//   POST /charge                 → start the charge
//   POST /charge/submit_otp      → submit an OTP if requested
//   GET  /transaction/verify/:ref → confirm, then we credit on 'success'
// Amounts are sent in the minor unit (pesewas) — GHS 1 = 100.

const BASE = 'https://api.paystack.co'

function getSecretKey(): string {
  const v = process.env.PAYSTACK_SECRET_KEY?.trim()
  if (!v) throw new Error('PAYSTACK_SECRET_KEY is not configured')
  return v
}

export function getPublicKey(): string | null {
  return process.env.PAYSTACK_PUBLIC_KEY?.trim() || null
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getSecretKey()}`,
    'Content-Type': 'application/json',
  }
}

// MobileMoneyForm provider keys → Paystack Ghana mobile-money provider codes.
const GH_PROVIDER: Record<string, string> = {
  mtn: 'mtn',
  vod: 'vod', // Vodafone / Telecel
  atl: 'tgo', // AirtelTigo
}

async function psFetch(path: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 25_000)
  try {
    return await fetch(`${BASE}${path}`, { ...init, signal: ctrl.signal, cache: 'no-store' })
  } finally {
    clearTimeout(timer)
  }
}

export interface PaystackChargeResult {
  reference: string
  /** 'pay_offline' | 'send_otp' | 'pending' | 'success' | 'failed' | ... */
  status: string
  /** Human message to show ("Approve on your phone", "Enter OTP", …). */
  displayText: string | null
}

export async function chargeMobileMoney(input: {
  reference: string
  amount: number
  email: string
  phone: string
  provider: string
}): Promise<PaystackChargeResult> {
  const provider = GH_PROVIDER[(input.provider ?? '').toLowerCase()] ?? 'mtn'
  const res = await psFetch('/charge', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      email: input.email,
      amount: Math.round(input.amount * 100), // pesewas
      currency: 'GHS',
      reference: input.reference,
      mobile_money: { phone: input.phone, provider },
    }),
  })
  const raw = await res.text()
  let body: {
    status?: boolean
    message?: string
    data?: { reference?: string; status?: string; display_text?: string }
  } = {}
  try {
    body = raw ? JSON.parse(raw) : {}
  } catch {
    /* non-JSON */
  }
  if (!res.ok || body.status !== true || !body.data) {
    console.error('[paystack] charge error', { status: res.status, response: raw.slice(0, 500) })
    throw new Error(body.message || raw.slice(0, 300) || `Paystack charge failed (HTTP ${res.status})`)
  }
  return {
    reference: body.data.reference ?? input.reference,
    status: body.data.status ?? 'pending',
    displayText: body.data.display_text ?? body.message ?? null,
  }
}

export async function submitOtp(
  reference: string,
  otp: string,
): Promise<{ ok: boolean; status: string; message: string | null }> {
  const res = await psFetch('/charge/submit_otp', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ otp, reference }),
  })
  const raw = await res.text()
  let body: { status?: boolean; message?: string; data?: { status?: string } } = {}
  try {
    body = raw ? JSON.parse(raw) : {}
  } catch {
    /* non-JSON */
  }
  const ok = res.ok && body.status === true
  return { ok, status: body.data?.status ?? (ok ? 'pending' : 'failed'), message: body.message ?? null }
}

export interface PaystackVerifyResult {
  status: string // 'success' | 'failed' | 'abandoned' | 'pending' | 'ongoing' | ...
  amount: number | null // major units
  found: boolean
}

export async function verifyTransaction(reference: string): Promise<PaystackVerifyResult> {
  const res = await psFetch(`/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: authHeaders(),
  })
  const raw = await res.text()
  let body: {
    status?: boolean
    data?: { status?: string; amount?: number }
  } = {}
  try {
    body = raw ? JSON.parse(raw) : {}
  } catch {
    /* non-JSON */
  }
  if (!res.ok || body.status !== true || !body.data) {
    return { status: 'pending', amount: null, found: false }
  }
  return {
    status: body.data.status ?? 'pending',
    amount: typeof body.data.amount === 'number' ? body.data.amount / 100 : null,
    found: true,
  }
}

export function isPaystackSuccessful(status: string | undefined): boolean {
  return (status ?? '').toLowerCase() === 'success'
}
