import { NextResponse } from 'next/server'
import { verifyPaymentByReference } from '@/lib/payment-verify'

export const dynamic = 'force-dynamic'

/**
 * Provider-agnostic charge status. Polled by the client while the customer
 * approves a debit on their phone; credits once the charge lands, and is
 * idempotent, so calling it on every tick (and alongside the webhook) is safe.
 *
 * Prefer this over the per-gateway status routes anywhere the caller doesn't
 * already know which gateway opened the charge — it dispatches on the provider
 * recorded on the payments row, so it stays right when the deposit page's
 * gateway changes and old pending rows are left behind.
 */
export async function GET(request: Request) {
  const reference = new URL(request.url).searchParams.get('reference') ?? ''
  if (!reference) {
    return NextResponse.json({ error: 'reference required' }, { status: 400 })
  }
  return NextResponse.json(await verifyPaymentByReference(reference), { status: 200 })
}
