import { NextResponse } from 'next/server'
import { listPaymentsForUser } from '@/lib/payments-store'
import { verifyPaymentByReference } from '@/lib/payment-verify'

export const dynamic = 'force-dynamic'

// Providers with a status API we can ask. Manual MoMo and USDT rows are
// resolved by an admin, so sweeping them would be a pointless round trip.
const VERIFIABLE = new Set(['akwapay', 'flutterwave', 'paystack'])

/**
 * Safety net across every gateway: re-check this user's recent pending deposits
 * and credit any that settled while they were away — tab closed mid-poll,
 * redirect never fired, webhook missed.
 *
 * Replaces the per-gateway sweeps, which only ever looked at their own rows: a
 * player who deposited through the previous gateway had those rows silently
 * skipped. Idempotent — each verify pipeline guards against double-crediting.
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
    console.error('[payments/reconcile] list failed:', e)
    return NextResponse.json({ credited: 0, checked: 0 })
  }

  // 7-day window, matching the sweeps this replaces. Re-checking a charge that
  // never paid is a harmless no-op — it just reports 'pending' again.
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const pending = payments.filter(
    (p) =>
      p.type === 'deposit' &&
      p.status === 'pending' &&
      VERIFIABLE.has((p.provider ?? '').trim().toLowerCase()) &&
      new Date(p.createdAt).getTime() >= cutoff,
  )

  let credited = 0
  for (const p of pending) {
    try {
      const r = await verifyPaymentByReference(p.reference)
      if (r.done) credited++
    } catch {
      /* skip; the next load sweeps it again */
    }
  }

  return NextResponse.json({ credited, checked: pending.length })
}
