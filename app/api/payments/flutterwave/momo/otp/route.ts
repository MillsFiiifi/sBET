import { NextResponse } from 'next/server'
import { findPaymentByReference } from '@/lib/payments-store'
import { validateCharge } from '@/lib/flutterwave'

export const dynamic = 'force-dynamic'

interface Body {
  reference?: string
  otp?: string
}

/**
 * Second step of the in-app Ghana MoMo checkout: the customer enters the SMS
 * OTP on OUR page and we validate the charge with Flutterwave using the flw_ref
 * stashed on the pending row at /momo/start. On success the collection proceeds
 * and the UI polls /status until it clears.
 */
export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const reference = (body.reference ?? '').trim()
  const otp = (body.otp ?? '').replace(/\D/g, '')
  if (!reference) return NextResponse.json({ error: 'reference required' }, { status: 400 })
  if (!otp) {
    return NextResponse.json({ error: 'Enter the code sent to your phone.' }, { status: 400 })
  }

  const pending = await findPaymentByReference(reference)
  if (!pending) return NextResponse.json({ error: 'unknown reference' }, { status: 404 })
  if (pending.status === 'success') {
    return NextResponse.json({ status: 'already-credited' }, { status: 200 })
  }

  const flwRef =
    typeof pending.metadata?.flwRef === 'string' ? pending.metadata.flwRef : ''
  if (!flwRef) {
    return NextResponse.json(
      { status: 'failed', error: 'payment context lost — please start again' },
      { status: 200 },
    )
  }

  let result
  try {
    result = await validateCharge(flwRef, otp)
  } catch (e) {
    console.error('[flutterwave/momo/otp] validate failed:', e)
    return NextResponse.json(
      { status: 'failed', error: 'Could not verify the code — please try again.' },
      { status: 200 },
    )
  }

  console.log('[flutterwave/momo/otp] validate reply', {
    reference,
    ok: result.ok,
    status: result.status,
    message: result.message,
  })

  if (!result.ok) {
    // Flutterwave rejected the code (wrong/expired) — let the user retry.
    return NextResponse.json(
      { status: 'otp-invalid', error: result.message || 'Incorrect or expired code. Please try again.' },
      { status: 200 },
    )
  }
  if (result.status === 'failed') {
    return NextResponse.json(
      { status: 'failed', error: result.message || 'Payment could not be completed.' },
      { status: 200 },
    )
  }

  // Code accepted — the collection is in flight; the UI polls /status.
  return NextResponse.json({ status: 'pending', reference }, { status: 200 })
}
