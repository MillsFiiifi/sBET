import { NextResponse } from 'next/server'
import { currentSubAdmin } from '@/lib/sub-admin-session'
import { ensureSubAdminWallet } from '@/lib/sub-admin-wallet'
import { creditBalance, debitBalance } from '@/lib/users-store'
import { recordPayment } from '@/lib/payments-store'
import { getCountry, normalizePhone } from '@/lib/countries'
import { sendWithdrawalRequest } from '@/lib/telegram'
import { notifyWithdrawalRequested } from '@/lib/withdrawal-sms'
import { emailWithdrawalRequested } from '@/lib/withdrawal-email'

export const dynamic = 'force-dynamic'

/**
 * Cash out a sub-admin's betting wallet to mobile money.
 *
 * Same machinery as a player withdrawal — the balance is debited up front, a
 * pending row goes in the ledger, and the operator gets the Telegram prompt
 * that pays it and marks it paid. Reusing lib/withdrawal-settle.ts on the
 * other end means a sub-admin payout cannot drift from a player one.
 *
 * What is deliberately NOT reused is the player verification gate. That gate
 * exists to stop a fresh signup depositing once and cashing straight back out;
 * a partner withdrawing commission they earned over months is not that, and
 * holding them to a GHS 20 unverified cap would make the feature pointless.
 * The operator still approves every payout by hand, so nothing moves unseen.
 */
export async function POST(request: Request) {
  const sa = await currentSubAdmin()
  if (!sa) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  if (!sa.approved) {
    return NextResponse.json({ error: 'account pending approval' }, { status: 403 })
  }

  let body: { amount?: number; phone?: string; network?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const wallet = await ensureSubAdminWallet(sa)
  if (!wallet) {
    return NextResponse.json({ error: 'could not open your wallet' }, { status: 500 })
  }

  const amount = +Number(body.amount).toFixed(2)
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Enter an amount greater than zero.' }, { status: 400 })
  }

  const cfg = getCountry(wallet.country)
  const network = (body.network ?? '').trim().toLowerCase()
  if (!cfg.payoutNetworks.some((n) => n.key === network)) {
    const labels = cfg.payoutNetworks.map((n) => n.label).join(', ')
    return NextResponse.json({ error: `Pick a payout option (${labels}).` }, { status: 400 })
  }

  const phone = normalizePhone(wallet.country, body.phone ?? '')
  if (!phone) {
    return NextResponse.json(
      { error: `Enter a valid ${cfg.name} mobile-money number.` },
      { status: 400 },
    )
  }

  // Reserve the money first. If the ledger write then fails we hand it back —
  // the reverse order would let two requests in flight both pass the balance
  // check and queue two payouts against one balance.
  const debited = await debitBalance(wallet.id, amount)
  if ('error' in debited) {
    if (debited.error === 'insufficient-funds') {
      return NextResponse.json(
        { error: `You only have ${wallet.currency} ${(wallet.balance ?? 0).toFixed(2)}.` },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: 'wallet not found' }, { status: 404 })
  }

  const reference = `SA-WDL-${sa.id.slice(0, 8)}-${Date.now()}`

  let queued
  try {
    queued = await recordPayment({
      userId: wallet.id,
      reference,
      amount,
      type: 'withdrawal',
      status: 'pending',
      provider: 'manual',
      currency: wallet.currency,
      metadata: {
        phone,
        network,
        // markWithdrawalPaid / rejectWithdrawal read this to decide whether a
        // rejection refunds. We took the money up front, so it must.
        balanceReserved: true,
        subAdminId: sa.id,
        subAdminName: sa.name,
        payoutFor: 'sub-admin',
      },
    })
  } catch (e) {
    console.error('[sub-admin/withdraw] ledger write failed, refunding:', e)
    await creditBalance(wallet.id, amount).catch((err) =>
      console.error('[sub-admin/withdraw] REFUND FAILED — manual correction required', {
        subAdminId: sa.id,
        walletId: wallet.id,
        amount,
        error: err instanceof Error ? err.message : String(err),
      }),
    )
    return NextResponse.json({ error: 'Could not queue the payout. Try again.' }, { status: 500 })
  }

  if (queued) {
    try {
      await sendWithdrawalRequest({
        paymentId: queued.id,
        reference,
        amount,
        currency: wallet.currency,
        userName: `${sa.name} (sub-admin)`,
        userEmail: sa.email,
        payoutPhone: phone,
        network,
        country: wallet.country,
        blockedReason: null,
      })
    } catch (e) {
      // The payout is queued and visible on /admin/deposits either way; a
      // Telegram outage must not lose it.
      console.warn('[sub-admin/withdraw] operator prompt failed:', e)
    }
  }

  void notifyWithdrawalRequested({
    phone,
    country: wallet.country,
    amount,
    currency: wallet.currency,
    reference,
  })

  void emailWithdrawalRequested({
    email: sa.email,
    name: sa.name,
    amount,
    currency: wallet.currency,
    reference,
    destination: phone,
    network,
  })

  console.log('[sub-admin/withdraw] queued', {
    subAdminId: sa.id,
    amount,
    currency: wallet.currency,
    reference,
  })

  return NextResponse.json(
    {
      pending: true,
      reference,
      amount,
      currency: wallet.currency,
      balance: debited.user.balance ?? 0,
      message: 'Withdrawal requested. You will be paid to your mobile money shortly.',
    },
    { status: 202 },
  )
}
