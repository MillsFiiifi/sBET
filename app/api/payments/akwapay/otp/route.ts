import { NextResponse } from 'next/server'
import { findPaymentByReference } from '@/lib/payments-store'
import { validateOtp } from '@/lib/akwapay'

export const dynamic = 'force-dynamic'

interface OtpBody {
  reference?: string
  otp?: string
}

/**
 * Submit the SMS code for an AkwaPay mobile-money charge.
 *
 * The important behaviour here is what happens when it *doesn't* work.
 * Submitting an OTP is an attempt, never the source of truth — nothing on this
 * route credits anyone. Only the status poll does that, after asking the
 * gateway. So:
 *
 *   - accepted        → poll
 *   - not_supported   → poll (the gateway behind AkwaPay has no OTP route yet,
 *                       but the customer may still finish on their handset;
 *                       showing an error here strands a payment that is about
 *                       to land)
 *   - rejected        → let them retype the code, this one is genuinely wrong
 *
 * `keepPolling` tells the client which of those it got without having to
 * interpret the message.
 */
export async function POST(request: Request) {
  let body: OtpBody
  try {
    body = (await request.json()) as OtpBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const reference = (body.reference ?? '').trim()
  const otp = (body.otp ?? '').trim()
  if (!reference) return NextResponse.json({ error: 'reference required' }, { status: 400 })
  if (!otp) return NextResponse.json({ error: 'Enter the code you were sent.' }, { status: 400 })

  const payment = await findPaymentByReference(reference).catch(() => null)
  if (!payment) return NextResponse.json({ error: 'unknown reference' }, { status: 404 })

  // Already settled while they were typing — nothing to submit against.
  if (payment.status === 'success') {
    return NextResponse.json({ status: 'already-credited', keepPolling: false, done: true })
  }

  const intentId = (payment.metadata?.akwapayIntentId as string | undefined)?.trim()
  if (!intentId) {
    console.error('[akwapay/otp] no intent id on payment row', { reference })
    return NextResponse.json({ error: 'This payment cannot accept a code.' }, { status: 409 })
  }

  let result
  try {
    result = await validateOtp(intentId, otp)
  } catch (e) {
    // Could not reach AkwaPay. Nothing was necessarily processed, so the same
    // code is safe to retry.
    console.error('[akwapay/otp] validate call failed:', e)
    return NextResponse.json(
      { error: 'Could not reach the payment service. Try again.' },
      { status: 502 },
    )
  }

  if (result.outcome === 'rejected') {
    return NextResponse.json({ error: result.message, keepPolling: false }, { status: 400 })
  }

  if (result.outcome === 'not-supported') {
    console.log('[akwapay/otp] gateway cannot take OTP over API — polling instead', { reference })
    return NextResponse.json({ status: 'pending', keepPolling: true, otpSkipped: true })
  }

  return NextResponse.json({ status: result.status, keepPolling: true })
}
