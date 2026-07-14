import { NextResponse } from 'next/server'
import { findPaymentByReference } from '@/lib/payments-store'
import { validateCharge, verifyByReference } from '@/lib/flutterwave'

export const dynamic = 'force-dynamic'

// Submit the OTP the customer received by SMS to finish a mobile-money charge.
// The client then keeps polling /status until the payment clears.
export async function POST(request: Request) {
  let body: { reference?: string; otp?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const reference = (body.reference ?? '').trim()
  const otp = (body.otp ?? '').trim()
  if (!reference) return NextResponse.json({ error: 'reference required' }, { status: 400 })
  if (!otp) return NextResponse.json({ error: 'Enter the code you received.' }, { status: 400 })

  const payment = await findPaymentByReference(reference).catch(() => null)
  if (!payment) {
    return NextResponse.json({ error: 'payment not found' }, { status: 404 })
  }

  // Prefer the flw_ref captured at charge time; if it wasn't stored, recover it
  // from Flutterwave by our tx_ref so the OTP can still be validated.
  let flwRef = typeof payment.metadata?.flwRef === 'string' ? payment.metadata.flwRef : ''
  if (!flwRef) {
    const verified = await verifyByReference(reference).catch(() => null)
    flwRef = verified?.flwRef ?? ''
  }
  if (!flwRef) {
    return NextResponse.json(
      { error: 'Could not find this charge to validate the code. Approve the prompt on your phone, or try again.' },
      { status: 400 },
    )
  }

  try {
    const result = await validateCharge(flwRef, otp)
    if (!result.ok) {
      return NextResponse.json(
        { error: result.message ?? 'That code was not accepted. Check it and try again.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ ok: true, status: result.status })
  } catch (e) {
    console.error('[flutterwave/momo/validate] failed:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not validate the code.' },
      { status: 502 },
    )
  }
}
