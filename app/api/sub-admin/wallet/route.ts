import { NextResponse } from 'next/server'
import { currentSubAdmin } from '@/lib/sub-admin-session'
import {
  ensureSubAdminWallet,
  markWalletReady,
  moveCommissionToWallet,
} from '@/lib/sub-admin-wallet'

export const dynamic = 'force-dynamic'

/**
 * GET — the sub-admin's own betting wallet, creating it on first ask.
 *
 * Returns the wallet id as well, which is what the dashboard hands to
 * saveUserSession so the same login can place bets.
 */
export async function GET() {
  const sa = await currentSubAdmin()
  if (!sa) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const wallet = await ensureSubAdminWallet(sa)
  if (!wallet) {
    return NextResponse.json({ error: 'could not open a wallet' }, { status: 500 })
  }

  // Self-heal a wallet funded before the gates were being cleared — otherwise
  // a partner already holding a balance stays stuck on "make your first
  // deposit" until they credit themselves again. No-ops once they are clear.
  if ((wallet.balance ?? 0) > 0) await markWalletReady(wallet.id)

  return NextResponse.json({
    wallet: {
      id: wallet.id,
      name: wallet.name,
      balance: wallet.balance ?? 0,
      currency: wallet.currency,
    },
    // What is actually movable — commission in any other currency cannot go
    // into this wallet, so the UI should not offer it.
    available: sa.commissionBalances[wallet.currency as keyof typeof sa.commissionBalances] ?? 0,
  })
}

/**
 * POST — move commission into that wallet.
 *
 * Self-service, and deliberately so: this is the sub-admin's own earned
 * commission moving between two balances that both already belong to them.
 * Nothing leaves the platform here, so it needs no operator approval — cashing
 * out to mobile money still goes through the normal withdrawal flow, with the
 * same limits and the same manual payout every player gets.
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

  const result = await moveCommissionToWallet(sa.id, Number(body.amount))

  if (!result.ok) {
    const messages: Record<string, string> = {
      'bad-amount': 'Enter an amount greater than zero.',
      insufficient: `You only have ${result.currency} ${(result.available ?? 0).toFixed(2)} available.`,
      'wrong-currency': `You have no commission in ${result.currency}. Commission earned in other currencies is paid out by the admin.`,
      'no-wallet': 'Could not open your betting wallet. Try again.',
      'not-found': 'Could not complete the transfer. Try again.',
    }
    const status = result.reason === 'no-wallet' || result.reason === 'not-found' ? 500 : 400
    return NextResponse.json(
      { error: messages[result.reason] ?? 'Transfer failed.', reason: result.reason },
      { status },
    )
  }

  console.log('[sub-admin/wallet] commission moved to wallet', {
    subAdminId: sa.id,
    amount: result.moved,
    currency: result.currency,
  })

  return NextResponse.json({
    moved: result.moved,
    currency: result.currency,
    balance: result.balance,
  })
}
