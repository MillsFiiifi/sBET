import { NextResponse } from 'next/server'
import { listPaymentsForUser } from '@/lib/payments-store'
import { verifyAndCreditFlutterwave } from '@/lib/flutterwave-credit'

export const dynamic = 'force-dynamic'

/**
 * Safety net: re-check the user's recent pending Flutterwave deposits and credit
 * any that settled while they were away (the redirect never fired, the OTP poll
 * was closed, or the webhook missed). Called on /me load. Idempotent —
 * verifyAndCreditFlutterwave guards against double-credit.
 */
export async function POST(request: Request) {
  let body: { userId?: string }
  try {
    body = (await request.json()) as { userId?: string }
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const userId = (body.userId ?? '').trim()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  let payments
  try {
    payments = await listPaymentsForUser(userId)
  } catch (e) {
    console.error('[flutterwave/reconcile] list failed:', e)
    return NextResponse.json({ credited: 0, checked: 0 })
  }

  // Generous 7-day window so deposits that got stranded a while ago still get
  // swept; verifyByReference returns 'pending' for charges that never actually
  // paid, so re-checking them is a harmless no-op.
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const pending = payments.filter(
    (p) =>
      p.type === 'deposit' &&
      p.provider === 'flutterwave' &&
      p.status === 'pending' &&
      new Date(p.createdAt).getTime() >= cutoff,
  )

  let credited = 0
  for (const p of pending) {
    try {
      const r = await verifyAndCreditFlutterwave(p.reference)
      if (r.status === 'success' || r.status === 'already-credited') credited++
    } catch {
      /* skip; will retry on next load */
    }
  }

  return NextResponse.json({ credited, checked: pending.length })
}
