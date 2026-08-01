import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, isValidSessionCookie } from '@/lib/admin-auth'
import { findPaymentById, markPaymentResolved } from '@/lib/payments-store'
import { applyDepositCredit } from '@/lib/deposit-credit'
import { verifyAndCreditFlutterwave } from '@/lib/flutterwave-credit'
import { verifyAndCreditKorapay } from '@/lib/korapay-credit'
import { verifyAndCreditPaystack } from '@/lib/paystack-credit'
import { verifyAndCreditMomo } from '@/lib/momo-credit'
import {
  verifyAndCreditMoolreDirect,
  verifyAndCreditMoolreHosted,
} from '@/lib/moolre-direct-credit'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

async function isAdminAuthenticated(): Promise<boolean> {
  const store = await cookies()
  return isValidSessionCookie(store.get(ADMIN_COOKIE)?.value)
}

interface GatewayResult {
  status: string
  ok: boolean
  reference: string
}

/**
 * Pick the right verify-then-credit pipeline for a gateway deposit. Each of
 * these RE-VERIFIES the payment against the provider and credits ONLY when the
 * gateway itself reports the payment as successful — so a failed/pending
 * deposit can never be turned into a credited "success" by hand. Returns null
 * for providers with no gateway to check against (e.g. manual screenshot
 * uploads), which fall back to the reviewed-by-admin manual credit path.
 */
function gatewayVerifier(
  provider: string,
  metadata: Record<string, unknown>,
): ((reference: string) => Promise<GatewayResult>) | null {
  switch (provider) {
    case 'flutterwave':
      return verifyAndCreditFlutterwave
    case 'korapay':
      return verifyAndCreditKorapay
    case 'paystack':
      return verifyAndCreditPaystack
    case 'momo':
      return verifyAndCreditMomo
    case 'moolre':
      // Hosted checkout used flow 'api-init'; the in-app charge used 'direct'.
      return metadata.flow === 'api-init'
        ? verifyAndCreditMoolreHosted
        : verifyAndCreditMoolreDirect
    default:
      return null
  }
}

/**
 * Admin "Credit & resolve". For a gateway deposit (Flutterwave, Moolre,
 * Korapay, Paystack, …) this now RE-VERIFIES with the provider and credits only
 * if the gateway confirms the payment succeeded — recovering genuine
 * webhook-missed deposits while refusing to credit anything the gateway says
 * failed or is still pending. Manual screenshot-upload deposits (no gateway to
 * check) keep the reviewed-by-admin manual credit.
 */
export async function POST(request: Request, { params }: Params) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await params

  let body: { note?: string } = {}
  try {
    body = await request.json()
  } catch {
    // empty body is fine
  }
  const note = (body.note ?? '').toString().trim().slice(0, 200)

  const payment = await findPaymentById(id)
  if (!payment) return NextResponse.json({ error: 'payment not found' }, { status: 404 })
  if (payment.type !== 'deposit') {
    return NextResponse.json({ error: 'only deposit rows can be resolved' }, { status: 400 })
  }
  if (payment.status === 'success') {
    return NextResponse.json({ error: 'payment already credited' }, { status: 409 })
  }
  if (!payment.userId) {
    return NextResponse.json({ error: 'payment has no user' }, { status: 400 })
  }
  if (!Number.isFinite(payment.amount) || payment.amount <= 0) {
    return NextResponse.json({ error: 'invalid amount on payment row' }, { status: 400 })
  }

  const source = typeof payment.metadata?.source === 'string' ? payment.metadata.source : ''
  const isManualUpload = payment.provider === 'manual' || source === 'manual_upload'
  const verify = isManualUpload ? null : gatewayVerifier(payment.provider, payment.metadata)

  // Gateway deposit: the provider is the source of truth. Re-verify and let the
  // provider's own pipeline credit only if it really succeeded.
  if (verify) {
    const result = await verify(payment.reference)
    if (result.ok) {
      // 'success' = credited just now; 'already-credited' = a racing path did.
      return NextResponse.json({ credited: payment.amount, gatewayStatus: result.status, verified: true })
    }
    return NextResponse.json(
      {
        error: `Gateway did not confirm this payment (status: ${result.status}). It was not credited.`,
        gatewayStatus: result.status,
        verified: false,
      },
      { status: 409 },
    )
  }

  // Manual screenshot upload — no gateway exists to verify against, so this
  // stays a deliberate admin decision (the admin reviewed the proof).
  const resolved = await markPaymentResolved(id, note || 'manual upload — admin reviewed proof')
  if (!resolved) {
    return NextResponse.json(
      { error: 'payment already credited by another path' },
      { status: 409 },
    )
  }

  const result = await applyDepositCredit(payment.userId, payment.amount)
  if (!result) {
    return NextResponse.json({ error: 'user not found' }, { status: 404 })
  }

  return NextResponse.json({
    payment: resolved,
    user: {
      id: result.user.id,
      name: result.user.name,
      balance: result.user.balance ?? 0,
      totalDeposited: result.user.totalDeposited,
      verificationStep: result.user.verificationStep ?? 0,
    },
    credited: payment.amount,
    isFirstDeposit: result.isFirstDeposit,
    commission: result.commission,
    verified: false,
    manualUpload: true,
  })
}
