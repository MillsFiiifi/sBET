import { NextResponse } from 'next/server'
import { verifyAndCreditAkwapay } from '@/lib/akwapay-credit'

export const dynamic = 'force-dynamic'

/**
 * Polled by the client while the customer approves the debit on their phone.
 * Re-checks the intent and credits once it succeeds. Idempotent — safe on
 * every tick, and safe alongside the webhook arriving at the same moment.
 *
 * `done` is only ever set for a terminal *success*. A pending status keeps the
 * client polling, which is what must happen on AkwaPay's `unknown` status: it
 * means the gateway has not answered, not that the payment failed.
 */
export async function GET(request: Request) {
  const reference = new URL(request.url).searchParams.get('reference') ?? ''
  if (!reference) {
    return NextResponse.json({ error: 'reference required' }, { status: 400 })
  }

  const result = await verifyAndCreditAkwapay(reference)
  const done = result.status === 'success' || result.status === 'already-credited'

  return NextResponse.json({ ...result, done }, { status: 200 })
}
