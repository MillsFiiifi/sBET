import { NextResponse } from 'next/server'
import { verifyAndCreditFlutterwave } from '@/lib/flutterwave-credit'
import { findPaymentByReference } from '@/lib/payments-store'
import { finalizeWithdrawalFromFee } from '@/lib/flutterwave-withdrawal'

export const dynamic = 'force-dynamic'

function sanitizeReturnPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/me'
  return raw
}

function redirectWith(originUrl: URL, path: string, status: string, reference?: string) {
  const url = new URL(path, originUrl)
  url.searchParams.set('flw', status)
  // Hand the reference back so the wallet page can keep confirming a charge
  // that hadn't settled yet at redirect time (common with mobile money).
  if (reference) url.searchParams.set('ref', reference)
  return NextResponse.redirect(url, 303)
}

/**
 * Pull our tx_ref out of the redirect Flutterwave sends us.
 *
 * Our redirect_url already carries `?returnPath=..&ref=<reference>`. Flutterwave
 * then appends its OWN response as `?status=..&tx_ref=..&transaction_id=..` —
 * with a second `?`, not an `&`. That malformed URL makes the query parser read
 * the last pre-existing param as `ref=<reference>?status=successful`, i.e. our
 * reference with junk glued on. Looking that corrupted value up in `payments`
 * finds nothing → "couldn't match that payment" and the deposit never credits.
 *
 * So: gather every candidate (Flutterwave's clean `tx_ref` echo AND our `ref`),
 * cut anything from a stray `?` onward, and prefer the one that looks like a
 * PowerStakeBet reference. `tx_ref` sits after the injected `?`, so it parses
 * clean and is the reliable source.
 */
function extractReference(url: URL): string {
  const candidates = [url.searchParams.get('tx_ref'), url.searchParams.get('ref')]
    .map((v) => (v ? v.split('?')[0].trim() : ''))
    .filter(Boolean)
  return candidates.find((c) => /^PB-/i.test(c)) ?? candidates[0] ?? ''
}

// Fallback redirect handler for charges that use a redirect next_action (e.g.
// 3DS / bank / hosted checkout). Mobile-money charges resolve via the status-
// poll route instead, but this keeps redirect-based methods working.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const reference = extractReference(url)
  const returnPath = sanitizeReturnPath(url.searchParams.get('returnPath'))

  const pending = await findPaymentByReference(reference).catch(() => null)
  const isFee = pending?.metadata?.purpose === 'withdrawal-fee'

  const result = await verifyAndCreditFlutterwave(reference, { credit: !isFee })

  // Only finalize the withdrawal when WE won the atomic resolve.
  if (isFee && pending && result.status === 'success') {
    await finalizeWithdrawalFromFee(pending)
  }

  return redirectWith(url, returnPath, result.status, reference)
}
