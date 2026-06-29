import { NextResponse } from 'next/server'
import { verifyAndCreditFlutterwave } from '@/lib/flutterwave-credit'
import { findPaymentByReference } from '@/lib/payments-store'
import { finalizeWithdrawalFromFee } from '@/lib/flutterwave-withdrawal'

export const dynamic = 'force-dynamic'

function sanitizeReturnPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/me'
  return raw
}

function redirectWith(originUrl: URL, path: string, status: string) {
  const url = new URL(path, originUrl)
  url.searchParams.set('flw', status)
  return NextResponse.redirect(url, 303)
}

// Fallback redirect handler for charges that use a redirect next_action (e.g.
// 3DS / bank). Mobile-money charges resolve via the status-poll route instead,
// but this keeps redirect-based methods working. We kept our reference in
// `?ref=` so we can confirm the charge and (for fees) finalize the withdrawal.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const reference = url.searchParams.get('ref') ?? ''
  const returnPath = sanitizeReturnPath(url.searchParams.get('returnPath'))

  const pending = await findPaymentByReference(reference).catch(() => null)
  const isFee = pending?.metadata?.purpose === 'withdrawal-fee'

  const result = await verifyAndCreditFlutterwave(reference, { credit: !isFee })

  // Only finalize the withdrawal when WE won the atomic resolve.
  if (isFee && pending && result.status === 'success') {
    await finalizeWithdrawalFromFee(pending)
  }

  return redirectWith(url, returnPath, result.status)
}
