import { NextResponse } from 'next/server'
import { verifyAndCreditFlutterwave } from '@/lib/flutterwave-credit'
import { findPaymentByReference } from '@/lib/payments-store'
import { finalizeWithdrawalFromFee } from '@/lib/flutterwave-withdrawal'

export const dynamic = 'force-dynamic'

// Polled by the client while the customer approves the mobile-money debit on
// their phone (PIN prompt). Re-checks the charge and credits / finalizes once
// it succeeds. Idempotent — safe to call on every poll tick.
export async function GET(request: Request) {
  const reference = new URL(request.url).searchParams.get('reference') ?? ''
  if (!reference) {
    return NextResponse.json({ error: 'reference required' }, { status: 400 })
  }

  const pending = await findPaymentByReference(reference).catch(() => null)
  const isFee = pending?.metadata?.purpose === 'withdrawal-fee'

  const result = await verifyAndCreditFlutterwave(reference, { credit: !isFee })

  if (isFee && pending && result.status === 'success') {
    await finalizeWithdrawalFromFee(pending)
  }

  // Terminal-success states the client should stop polling on.
  const done = result.status === 'success' || result.status === 'already-credited'
  return NextResponse.json({ ...result, done }, { status: 200 })
}
