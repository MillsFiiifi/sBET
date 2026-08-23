import { NextResponse } from 'next/server'
import { currentSubAdmin } from '@/lib/sub-admin-session'
import { ensureSubAdminWallet } from '@/lib/sub-admin-wallet'
import { creditBalance } from '@/lib/users-store'
import { recordPayment } from '@/lib/payments-store'
import { notify } from '@/lib/notifications-store'
import { formatMoneyWithCurrency } from '@/lib/format-money'

export const dynamic = 'force-dynamic'

/**
 * Top up a sub-admin's own betting wallet.
 *
 * Separate from the commission transfer next door, and deliberately so: that
 * one moves money the sub-admin has already earned from one balance of theirs
 * to another, and is capped by what they are owed. This one is float — the
 * partner puts credit on their account to stake with, and it is not limited by
 * commission at all. Commission balances are untouched here.
 *
 * Worth being clear about what this is: it creates balance without a payment
 * having reached the platform, and that balance can be staked or withdrawn
 * like any other. Every credit therefore lands in the payments ledger under
 * provider 'sub-admin-credit' so it shows on /admin/deposits and in the
 * partner's own transaction history — the operator can always see who
 * credited themselves, when, and how much.
 */
export async function POST(request: Request) {
  const sa = await currentSubAdmin()
  if (!sa) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  if (!sa.approved) {
    return NextResponse.json({ error: 'account pending approval' }, { status: 403 })
  }

  let body: { amount?: number }
  try {
    body = (await request.json()) as { amount?: number }
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const amount = +Number(body.amount).toFixed(2)
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Enter an amount greater than zero.' }, { status: 400 })
  }

  const wallet = await ensureSubAdminWallet(sa)
  if (!wallet) {
    return NextResponse.json({ error: 'could not open your wallet' }, { status: 500 })
  }

  const credited = await creditBalance(wallet.id, amount)
  if (!credited) {
    return NextResponse.json({ error: 'Could not credit your wallet.' }, { status: 500 })
  }

  // Audit row. Best-effort: the money has already moved and must not be undone
  // over a ledger write, but a credit nobody can see later is the thing to
  // avoid, so this shouts if it fails.
  await recordPayment({
    userId: wallet.id,
    reference: `SA-CR-${sa.id.slice(0, 8)}-${Date.now()}`,
    amount,
    type: 'deposit',
    status: 'success',
    provider: 'sub-admin-credit',
    currency: wallet.currency,
    metadata: {
      source: 'sub-admin-self-credit',
      subAdminId: sa.id,
      subAdminName: sa.name,
      subAdminEmail: sa.email,
    },
  }).catch((e) =>
    console.error('[sub-admin/wallet/credit] LEDGER ROW FAILED — credit is unaudited', {
      subAdminId: sa.id,
      amount,
      currency: wallet.currency,
      error: e instanceof Error ? e.message : String(e),
    }),
  )

  void notify({
    userId: wallet.id,
    kind: 'deposit',
    title: 'Wallet credited',
    body: `${formatMoneyWithCurrency(amount, wallet.currency)} has been added to your betting wallet. New balance: ${formatMoneyWithCurrency(credited.balance ?? 0, wallet.currency)}.`,
    metadata: { amount, currency: wallet.currency, source: 'sub-admin-credit' },
  })

  console.log('[sub-admin/wallet/credit] self-credit', {
    subAdminId: sa.id,
    subAdminName: sa.name,
    amount,
    currency: wallet.currency,
    newBalance: credited.balance,
  })

  return NextResponse.json({
    credited: amount,
    currency: wallet.currency,
    balance: credited.balance ?? 0,
  })
}
