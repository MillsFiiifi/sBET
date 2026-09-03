import { NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/akwapay'
import { verifyAndCreditAkwapay } from '@/lib/akwapay-credit'

export const dynamic = 'force-dynamic'

interface AkwapayEvent {
  id?: string
  type?: string
  sequence?: number
  data?: {
    intent_id?: string
    amount?: number
    currency?: string
    reference?: string
    status?: string
  }
}

/**
 * AkwaPay webhook receiver.
 *
 * Register with POST /v1/webhook_endpoints and store the `whsec_...` it
 * returns as AKWAPAY_WEBHOOK_SECRET — it is shown exactly once.
 *
 * Two things worth knowing about this handler:
 *
 * 1. It reads the raw body text and verifies the HMAC over those exact bytes.
 *    Parsing to JSON first and re-serialising reorders keys and the signature
 *    can never match again.
 *
 * 2. It does not credit from the event payload. The event only says "go and
 *    look"; verifyAndCreditAkwapay asks the API what actually happened. That
 *    keeps a forged-but-somehow-signed event, a stale replay, or an
 *    out-of-order delivery from crediting anything on its own — and it means
 *    at-least-once delivery costs us nothing, since the row is already
 *    resolved by the time a duplicate arrives.
 */
export async function POST(request: Request) {
  const raw = await request.text()

  if (!verifyWebhookSignature(raw, request.headers.get('x-akwapay-signature'))) {
    console.warn('[akwapay/webhook] bad signature — rejecting')
    return NextResponse.json({ error: 'bad signature' }, { status: 400 })
  }

  let event: AkwapayEvent
  try {
    event = JSON.parse(raw) as AkwapayEvent
  } catch {
    console.warn('[akwapay/webhook] signed body was not json')
    return NextResponse.json({ ok: true })
  }

  const reference = event.data?.reference?.trim()
  console.log('[akwapay/webhook] event', {
    id: event.id,
    type: event.type,
    sequence: event.sequence,
    reference,
    status: event.data?.status,
  })

  // Only the success event needs work. Everything else is acked so AkwaPay
  // stops retrying — a failed intent is already handled by the poller, which
  // stops the client on a terminal status.
  if (event.type !== 'payment_intent.succeeded') {
    return NextResponse.json({ ok: true })
  }

  if (!reference) {
    console.error('[akwapay/webhook] succeeded event with no reference', event.id)
    return NextResponse.json({ ok: true })
  }

  // Processed inline rather than after responding: on serverless the function
  // can be frozen the moment the response is sent, so deferred work is not
  // guaranteed to run. Delivery is at-least-once and this is idempotent, so a
  // timeout just means AkwaPay retries into a no-op.
  try {
    // The intent id is passed as a hint, not as truth: it rescues a payment
    // whose /start call timed out before we could stash the id. What actually
    // decides the credit is still GET /v1/payment_intents/{id}.
    const result = await verifyAndCreditAkwapay(reference, {
      intentIdHint: event.data?.intent_id,
    })
    if (!result.ok) {
      console.error('[akwapay/webhook] credit did not complete', { reference, status: result.status })
    } else {
      console.log('[akwapay/webhook] credited', { reference, status: result.status })
    }
  } catch (e) {
    console.error('[akwapay/webhook] credit threw:', e)
  }

  return NextResponse.json({ ok: true })
}
