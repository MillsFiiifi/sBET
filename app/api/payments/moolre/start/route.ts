import { NextResponse } from 'next/server'
import { findUserById } from '@/lib/users-store'
import { recordPayment } from '@/lib/payments-store'
import { getMinFirstDeposit, getMoolrePosUrl } from '@/lib/moolre'

export const dynamic = 'force-dynamic'

interface StartBody {
  userId?: string
  amount?: number
  /** Where to send the user after the (manual) reconciliation. */
  returnPath?: string
  /** Tag for traceability — 'deposit' (default) or 'verification'. */
  purpose?: 'deposit' | 'verification'
}

function sanitizeReturnPath(raw: string | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/me'
  return raw
}

export async function POST(request: Request) {
  let body: StartBody
  try {
    body = (await request.json()) as StartBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const userId = (body.userId ?? '').trim()
  const amount = Number(body.amount)
  const purpose: 'deposit' | 'verification' =
    body.purpose === 'verification' ? 'verification' : 'deposit'
  const returnPath = sanitizeReturnPath(body.returnPath)

  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 })
  }
  const minDeposit = getMinFirstDeposit()
  if (amount < minDeposit) {
    return NextResponse.json(
      { error: `minimum deposit is GHS ${minDeposit.toFixed(2)}` },
      { status: 400 },
    )
  }

  const posUrl = getMoolrePosUrl()
  if (!posUrl) {
    return NextResponse.json(
      { error: 'MOOLRE_POS_URL not configured' },
      { status: 502 },
    )
  }

  const user = await findUserById(userId)
  if (!user) return NextResponse.json({ error: 'user not found' }, { status: 404 })

  const refPrefix = purpose === 'verification' ? 'PB-VRF' : 'PB-DEP'
  const reference = `${refPrefix}-${userId.slice(0, 8)}-${Date.now()}`

  // Pending row so the admin can see the intent on /admin/deposits and
  // credit it once they confirm the payment on the Moolre dashboard. The
  // unique constraint on `reference` makes this idempotent.
  try {
    await recordPayment({
      userId,
      reference,
      amount,
      type: 'deposit',
      status: 'pending',
      provider: 'moolre',
      metadata: {
        purpose,
        returnPath,
        userName: user.name,
        userPhone: user.phone ?? null,
        flow: 'pos-link',
      },
    })
  } catch (e) {
    console.error('[moolre/start] pending ledger write failed:', e)
  }

  return NextResponse.json({ url: posUrl, reference }, { status: 201 })
}
