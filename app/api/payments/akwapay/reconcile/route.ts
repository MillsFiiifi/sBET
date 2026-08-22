import { NextResponse } from 'next/server'
import { listPaymentsForUser } from '@/lib/payments-store'
import { verifyAndCreditAkwapay } from '@/lib/akwapay-credit'

export const dynamic = 'force-dynamic'

/**
 * Safety net: re-check this user's recent pending AkwaPay deposits and credit
 * any that settled while they were away — the tab was closed mid-poll, the
 * webhook never arrived, or the signature was misconfigured at the time.
 *
 * AkwaPay's own guide is blunt about this: don't rely on the webhook alone. As
 * long as the pending row exists we can still learn the truth, which is also
 * why an `unknown` status must never resolve a row as failed.
 *
 * Idempotent — verifyAndCreditAkwapay guards against double-crediting.
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
    console.error('[akwapay/reconcile] list failed:', e)
    return NextResponse.json({ credited: 0, checked: 0 })
  }

  // Same 7-day window as the Flutterwave sweep. Re-checking a charge that
  // never paid is a harmless no-op — it just reports 'pending' again.
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const pending = payments.filter(
    (p) =>
      p.type === 'deposit' &&
      p.provider === 'akwapay' &&
      p.status === 'pending' &&
      new Date(p.createdAt).getTime() >= cutoff,
  )

  let credited = 0
  for (const p of pending) {
    try {
      const r = await verifyAndCreditAkwapay(p.reference)
      if (r.status === 'success' || r.status === 'already-credited') credited++
    } catch {
      /* skip; the next load sweeps it again */
    }
  }

  return NextResponse.json({ credited, checked: pending.length })
}
