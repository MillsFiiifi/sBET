import { NextResponse } from 'next/server'
import { findUserById } from '@/lib/users-store'
import { recordPayment, findPaymentByReference, updatePayment } from '@/lib/payments-store'
import {
  AkwapayDuplicateReference,
  createPaymentIntent,
  isAkwapayConfigured,
  toAkwapayNetwork,
} from '@/lib/akwapay'
import { getMinFirstDeposit } from '@/lib/countries'

export const dynamic = 'force-dynamic'

interface StartBody {
  userId?: string
  amount?: number
  phone?: string
  /** UI network id: mtn | telecel | vod | atl | airteltigo */
  provider?: string
  network?: string
  purpose?: 'deposit' | 'verification'
}

/**
 * Open an AkwaPay mobile-money deposit.
 *
 * Mirrors /api/payments/flutterwave/momo/start so the two are swappable from
 * the deposit page: same request body, same response keys. The pending ledger
 * row is written BEFORE the gateway call, because the row is what every later
 * path (status poll, webhook, admin resolve) looks the payment up by.
 */
export async function POST(request: Request) {
  if (!isAkwapayConfigured()) {
    return NextResponse.json({ error: 'AkwaPay is not configured.' }, { status: 503 })
  }

  let body: StartBody
  try {
    body = (await request.json()) as StartBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const userId = (body.userId ?? '').trim()
  const amount = Number(body.amount)
  const phone = (body.phone ?? '').trim()
  const networkKey = (body.provider ?? body.network ?? '').trim()
  const network = toAkwapayNetwork(networkKey)
  const purpose: 'deposit' | 'verification' =
    body.purpose === 'verification' ? 'verification' : 'deposit'

  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 })
  }
  if (!phone) return NextResponse.json({ error: 'mobile money number required' }, { status: 400 })
  if (!network) return NextResponse.json({ error: 'pick a valid network' }, { status: 400 })

  const user = await findUserById(userId)
  if (!user) return NextResponse.json({ error: 'user not found' }, { status: 404 })
  if (user.currency !== 'GHS') {
    return NextResponse.json({ error: 'AkwaPay mobile money is Ghana-only' }, { status: 400 })
  }

  const minDeposit = getMinFirstDeposit(user.country)
  if (amount < minDeposit) {
    return NextResponse.json(
      { error: `Minimum deposit is ${user.currency} ${minDeposit.toFixed(2)}.` },
      { status: 400 },
    )
  }

  // Unique per AkwaPay account, and our only handle on the payment once the
  // webhook fires — metadata is not replayed, so nothing else survives.
  const refPrefix = purpose === 'verification' ? 'PB-VRF' : 'PB-DEP'
  const reference = `${refPrefix}-${userId.slice(0, 8)}-${Date.now()}`

  let pendingId: string | null = null
  try {
    const rec = await recordPayment({
      userId,
      reference,
      amount,
      type: 'deposit',
      status: 'pending',
      provider: 'akwapay',
      currency: user.currency,
      metadata: {
        purpose,
        flow: 'momo',
        network: networkKey,
        userName: user.name,
        userPhone: phone,
        country: user.country,
      },
    })
    pendingId = rec?.id ?? null
  } catch (e) {
    console.error('[akwapay/start] pending ledger write failed:', e)
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(request.url).origin

  try {
    const intent = await createPaymentIntent({
      reference,
      amount,
      network,
      phone,
      returnUrl: `${origin}/me?akwapay=done`,
      // Stored on AkwaPay's side for their dashboard only — we deliberately do
      // not depend on it coming back.
      metadata: { userId, purpose },
    })

    // Stash what the OTP and poll steps need. Without the intent id there is
    // nothing to poll, so a failure here is logged loudly rather than ignored.
    const id = pendingId ?? (await findPaymentByReference(reference))?.id ?? null
    if (id) {
      await updatePayment(id, {
        metadata: {
          akwapayIntentId: intent.id,
          akwapayClientSecret: intent.clientSecret,
          akwapayCheckoutUrl: intent.checkoutUrl,
        },
      }).catch((e) => console.error('[akwapay/start] intent id stash failed:', e))
    } else {
      console.error('[akwapay/start] no ledger row to attach intent to', { reference })
    }

    return NextResponse.json(
      {
        reference,
        status: intent.status,
        intentId: intent.id,
        // Same key the Flutterwave route uses, so the deposit page's existing
        // branch works unchanged.
        otpRequired: intent.nextAction === 'submit_otp',
        redirect: intent.nextAction === 'redirect' ? intent.redirectUrl ?? undefined : undefined,
        checkoutUrl: intent.checkoutUrl ?? undefined,
        expiresAt: intent.expiresAt ?? undefined,
      },
      { status: 201 },
    )
  } catch (e) {
    // We already hold an intent for this reference (our own retry). The intent
    // id is unknown to us here, so point the caller at polling: the webhook or
    // a later sweep still resolves the row.
    if (e instanceof AkwapayDuplicateReference) {
      console.warn('[akwapay/start] duplicate reference — falling through to polling', reference)
      return NextResponse.json({ reference, status: 'requires_action' }, { status: 201 })
    }
    console.error('[akwapay/start] intent creation failed:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Mobile-money charge failed.' },
      { status: 502 },
    )
  }
}
