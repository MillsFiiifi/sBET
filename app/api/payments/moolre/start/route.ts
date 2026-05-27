import { NextResponse } from 'next/server'
import { findUserById } from '@/lib/users-store'
import { recordPayment } from '@/lib/payments-store'
import { getMinFirstDeposit, startMoolrePayment } from '@/lib/moolre'

export const dynamic = 'force-dynamic'

interface StartBody {
  userId?: string
  amount?: number
  /** Where to send the user after callback completes. Server appends ?moolre=... */
  returnPath?: string
  /** Tag for traceability — 'deposit' (default) or 'verification'. */
  purpose?: 'deposit' | 'verification'
}

function sanitizeReturnPath(raw: string | undefined): string {
  // Only allow same-origin paths so callback redirect can't be hijacked into
  // an open redirect. Drop anything not starting with '/'.
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/me'
  return raw
}

export async function POST(request: Request) {
  let body: StartBody
  try {
    body = (await request.json()) as StartBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const userId = (body.userId ?? '').trim()
  const amount = Number(body.amount)
  const purpose: 'deposit' | 'verification' =
    body.purpose === 'verification' ? 'verification' : 'deposit'
  const returnPath = sanitizeReturnPath(body.returnPath)

  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 })
  }
  const minDeposit = getMinFirstDeposit()
  if (amount < minDeposit) {
    return NextResponse.json(
      { error: `minimum deposit is GHS ${minDeposit.toFixed(2)}` },
      { status: 400 },
    )
  }

  const user = await findUserById(userId)
  if (!user) return NextResponse.json({ error: 'user not found' }, { status: 404 })

  const refPrefix = purpose === 'verification' ? 'PB-VRF' : 'PB-DEP'
  const reference = `${refPrefix}-${userId.slice(0, 8)}-${Date.now()}`

  // Build absolute callback URL from the incoming request. Works in dev,
  // preview, and prod without needing a separate env var.
  const origin = new URL(request.url).origin
  const callbackUrl = `${origin}/api/payments/moolre/callback`

  const moolre = await startMoolrePayment({
    reference,
    email: user.email,
    amount,
    callbackUrl,
  })
  if (!moolre.ok || !moolre.url) {
    return NextResponse.json(
      { error: moolre.error ?? 'failed to start payment' },
      { status: 502 },
    )
  }

  // Best-effort pending row so we can show abandoned attempts on the admin
  // page and so the callback has somewhere to claim. Failure here is not
  // fatal — the callback can still verify against Moolre and credit.
  try {
    await recordPayment({
      userId,
      reference,
      amount,
      type: 'deposit',
      status: 'pending',
      provider: 'moolre',
      metadata: { purpose, returnPath },
    })
  } catch (e) {
    console.error('[moolre/start] pending ledger write failed:', e)
  }

  return NextResponse.json({ url: moolre.url, reference }, { status: 201 })
}
