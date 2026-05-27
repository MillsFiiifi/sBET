import { NextResponse } from 'next/server'
import {
  claimPendingPayment,
  findPaymentByReference,
} from '@/lib/payments-store'
import { applyDepositCredit } from '@/lib/deposit-credit'
import { verifyMoolrePayment } from '@/lib/moolre'

export const dynamic = 'force-dynamic'

// Moolre's hosted checkout calls this URL two ways:
//   - As a browser redirect after the customer pays (GET with ?reference=…),
//     in which case we 302 the user back to wherever they came from.
//   - As a server-to-server webhook (POST, sometimes with the reference in
//     the body), where we return JSON. The credit logic is identical and
//     idempotent — we use a compare-and-set on `payments.status` so only
//     the first call (whichever wins the race) actually credits the wallet.

interface CallbackResult {
  ok: boolean
  reference: string
  returnPath: string
  status: 'success' | 'failed' | 'already' | 'unknown'
  error?: string
}

async function process(reference: string): Promise<CallbackResult> {
  if (!reference) {
    return { ok: false, reference: '', returnPath: '/me', status: 'unknown', error: 'reference required' }
  }

  // Look up the pending row we wrote in /start. If it doesn't exist, this
  // could be a stray webhook for a payment we don't recognise — still try
  // to verify with Moolre so we can decide what to do, but we won't have a
  // returnPath. Default to /me in that case.
  const existing = await findPaymentByReference(reference)
  const returnPath =
    (existing?.metadata?.returnPath as string | undefined) ?? '/me'

  // Already credited — idempotent return.
  if (existing && existing.status === 'success') {
    return { ok: true, reference, returnPath, status: 'already' }
  }
  // Previously failed — don't retry; admin can use "Credit & resolve" if needed.
  if (existing && existing.status === 'failed') {
    return { ok: false, reference, returnPath, status: 'failed', error: 'payment previously failed' }
  }

  // Verify with Moolre before doing anything to the wallet.
  const verify = await verifyMoolrePayment(reference)
  if (!verify.ok) {
    // Flip the row to failed if we own it (compare-and-set: only if still pending).
    if (existing) {
      try {
        await claimPendingPayment(reference, 'failed', {
          failureReason: verify.error ?? 'verification failed',
          moolreStatus: verify.status,
        })
      } catch (e) {
        console.error('[moolre/callback] failed-claim write failed:', e)
      }
    }
    return {
      ok: false,
      reference,
      returnPath,
      status: 'failed',
      error: verify.error ?? 'payment verification failed',
    }
  }

  if (!existing) {
    // Unknown payment that Moolre says succeeded — log and bail. We can't
    // safely credit a user we don't have a userId for.
    console.error('[moolre/callback] verified payment with no /start record:', reference)
    return {
      ok: false,
      reference,
      returnPath,
      status: 'unknown',
      error: 'no record of this payment',
    }
  }

  if (!existing.userId) {
    return { ok: false, reference, returnPath, status: 'unknown', error: 'payment has no user' }
  }

  // Amount check — refuse to credit more than Moolre confirms was paid.
  const recorded = existing.amount
  const paid = verify.amount
  if (typeof paid === 'number' && paid + 0.01 < recorded) {
    try {
      await claimPendingPayment(reference, 'failed', {
        failureReason: `amount mismatch (paid ${paid}, claimed ${recorded})`,
        paidAmount: paid,
      })
    } catch (e) {
      console.error('[moolre/callback] mismatch-claim write failed:', e)
    }
    return {
      ok: false,
      reference,
      returnPath,
      status: 'failed',
      error: `payment amount mismatch (paid ${paid}, claiming ${recorded})`,
    }
  }

  // Atomic claim of the pending row. If another concurrent callback already
  // flipped it to success, this returns null and we skip the credit — the
  // first call wins, the second one becomes a no-op.
  const claimed = await claimPendingPayment(reference, 'success', {
    moolreStatus: verify.status,
    paidAmount: paid,
  })
  if (!claimed) {
    // Race lost. The other handler is doing (or did) the credit.
    return { ok: true, reference, returnPath, status: 'already' }
  }

  const credit = await applyDepositCredit({
    userId: existing.userId,
    amount: recorded,
  })
  if (!credit.ok) {
    return { ok: false, reference, returnPath, status: 'failed', error: credit.error }
  }

  return { ok: true, reference, returnPath, status: 'success' }
}

function buildRedirect(origin: string, result: CallbackResult): string {
  const url = new URL(result.returnPath, origin)
  url.searchParams.set('moolre', result.ok ? 'success' : 'failed')
  url.searchParams.set('reference', result.reference)
  if (!result.ok && result.error) {
    url.searchParams.set('reason', result.error.slice(0, 200))
  }
  return url.toString()
}

async function readReference(request: Request): Promise<string> {
  const url = new URL(request.url)
  const fromQuery = url.searchParams.get('reference') ?? url.searchParams.get('ref') ?? ''
  if (fromQuery) return fromQuery.trim()
  if (request.method !== 'POST') return ''
  try {
    const body = (await request.json()) as { reference?: string; ref?: string; data?: { reference?: string } }
    return (body.reference ?? body.ref ?? body.data?.reference ?? '').toString().trim()
  } catch {
    return ''
  }
}

export async function GET(request: Request) {
  const reference = await readReference(request)
  const result = await process(reference)
  const origin = new URL(request.url).origin
  return NextResponse.redirect(buildRedirect(origin, result), { status: 303 })
}

export async function POST(request: Request) {
  const reference = await readReference(request)
  const result = await process(reference)
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
