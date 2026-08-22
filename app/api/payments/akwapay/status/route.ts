import { NextResponse } from 'next/server'
import { verifyAndCreditAkwapay } from '@/lib/akwapay-credit'
import { classifyIntentStatus } from '@/lib/akwapay'

export const dynamic = 'force-dynamic'

// Outcomes that will never change on their own. Everything else — including
// AkwaPay's `unknown` — is still in flight and must keep being polled.
const DEAD = new Set([
  'missing-reference',
  'unknown-reference',
  'unknown-intent',
  'no-intent',
  'no-user',
  'amount-mismatch',
])

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

  // Tell the client whether to stop rather than making it recognise gateway
  // vocabulary. 'declined' and 'expired' are AkwaPay's words, not ours, and a
  // client-side list of them goes stale the moment they add one.
  const failed =
    !done && (DEAD.has(result.status) || classifyIntentStatus(result.status) === 'failed')

  return NextResponse.json({ ...result, done, failed }, { status: 200 })
}
