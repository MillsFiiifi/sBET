import { NextResponse } from 'next/server'
import { verifyAndCreditPaystack } from '@/lib/paystack-credit'

export const dynamic = 'force-dynamic'

// Polled by the client while the customer approves the charge on their phone.
// Verifies + credits once it succeeds. Idempotent — safe on every tick.
export async function GET(request: Request) {
  const reference = new URL(request.url).searchParams.get('reference') ?? ''
  if (!reference) {
    return NextResponse.json({ error: 'reference required' }, { status: 400 })
  }
  const result = await verifyAndCreditPaystack(reference)
  return NextResponse.json(result, { status: 200 })
}
