// A sub-admin's own betting wallet.
//
// Sub-admins earn commission but had nowhere to spend it: the dashboard
// reported a balance and the only way it moved was the main admin paying out
// by hand. This gives each sub-admin a row in `users` — the same table players
// bet from — so the account they log into the dashboard with is the account
// they stake with, and moving commission into it is an internal transfer.
//
// The wallet is created on demand rather than at signup. A sub-admin who never
// bets never gets a users row, and existing sub-admins need no backfill.

import type { AppUser, SubAdmin } from '@/lib/types'
import { DEFAULT_COUNTRY, type CurrencyCode } from '@/lib/countries'
import {
  addUser,
  creditBalance,
  findUserByEmail,
  findUserById,
  setUserPassword,
} from '@/lib/users-store'
import { debitCommission, findSubAdminById, updateSubAdmin } from '@/lib/sub-admins-store'
import { recordPayment } from '@/lib/payments-store'
import { supabaseServer } from '@/lib/supabase'

/**
 * The sub-admin's wallet, creating and linking one if they haven't got it yet.
 *
 * Three ways this resolves, in order:
 *   1. Already linked — load it.
 *   2. A player account exists on the same email. They signed up as a punter
 *      before becoming a partner, so adopt that account rather than making a
 *      second one and splitting their money across two balances.
 *   3. Neither — create one from their sub-admin details.
 *
 * Never throws for the caller's benefit: a dashboard that cannot make a wallet
 * should still render everything else.
 */
export async function ensureSubAdminWallet(sa: SubAdmin): Promise<AppUser | null> {
  try {
    if (sa.userId) {
      const existing = await findUserById(sa.userId)
      if (existing) return existing
      // Linked to a row that no longer exists (the player was deleted, and the
      // FK nulled out under us or the id went stale). Fall through and make a
      // new one rather than leaving them walletless.
      console.warn('[sub-admin-wallet] linked user missing, recreating', {
        subAdminId: sa.id,
        userId: sa.userId,
      })
    }

    const byEmail = await findUserByEmail(sa.email)
    if (byEmail) {
      await updateSubAdmin(sa.id, { userId: byEmail.id })
      return byEmail
    }

    // Country decides the wallet's currency, and a wallet's currency is fixed
    // for life — so this is not a detail. Sub-admin signup doesn't ask for a
    // country, so it lands on the platform default; they can only move
    // commission earned in that same currency (see moveCommissionToWallet).
    const created = await addUser({
      name: sa.name,
      email: sa.email,
      passwordHash: sa.passwordHash,
      country: DEFAULT_COUNTRY,
    })

    await updateSubAdmin(sa.id, { userId: created.id })
    return created
  } catch (e) {
    console.error('[sub-admin-wallet] could not resolve a wallet', {
      subAdminId: sa.id,
      error: e instanceof Error ? e.message : String(e),
    })
    return null
  }
}

/**
 * Keep the wallet's password in step with the sub-admin's.
 *
 * They are one account to the person using them, so a password change on the
 * dashboard side has to carry over — otherwise the same credentials open the
 * dashboard but not the betting site, which reads as a broken login.
 */
export async function syncWalletPassword(sa: SubAdmin): Promise<void> {
  if (!sa.userId) return
  try {
    await setUserPassword(sa.userId, sa.passwordHash)
  } catch (e) {
    console.error('[sub-admin-wallet] password sync failed', {
      subAdminId: sa.id,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

/**
 * Mark a funded partner wallet as usable on the main site.
 *
 * Two player gates would otherwise strand a partner holding their own money:
 *
 *   1. `firstDepositAt` — /me refuses to open the withdraw form until it is
 *      set ("Make your first deposit before you can withdraw"). Crediting a
 *      wallet does not go through recordDeposit, so nothing ever set it.
 *   2. `verificationStep` — an unverified GH wallet is capped at GHS 20, so a
 *      partner with 30,000 on the account could withdraw twenty of it.
 *
 * Both gates exist to stop a fresh signup depositing once and cashing straight
 * back out. A partner funding their own float is not that, and the dashboard's
 * withdraw route already takes the same view. Every credit is still recorded
 * and every payout still approved by hand.
 *
 * Only ever raises: an already-verified wallet and an existing first-deposit
 * date are left exactly as they are.
 */
export async function markWalletReady(userId: string): Promise<void> {
  try {
    const user = await findUserById(userId)
    if (!user) return

    const patch: Record<string, unknown> = {}
    if (!user.firstDepositAt) patch.first_deposit_at = new Date().toISOString()
    if ((user.verificationStep ?? 0) < 4) patch.verification_step = 4
    if (Object.keys(patch).length === 0) return

    const { error } = await supabaseServer().from('users').update(patch).eq('id', userId)
    if (error) throw new Error(error.message)
  } catch (e) {
    // The money is already on the wallet; failing here only means the main
    // site still shows a gate, which the dashboard's own withdraw bypasses.
    console.error('[sub-admin-wallet] could not clear the player gates', {
      userId,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

export type TransferOutcome =
  | { ok: true; moved: number; currency: CurrencyCode; balance: number }
  | {
      ok: false
      reason: 'no-wallet' | 'not-found' | 'bad-amount' | 'insufficient' | 'wrong-currency'
      /** What they actually have available, for the error message. */
      available?: number
      currency?: CurrencyCode
    }

/**
 * Move commission into the sub-admin's betting wallet.
 *
 * Only commission held in the wallet's own currency can move. Commission
 * balances are per-currency and a wallet is single-currency for life, so
 * there is no honest way to put KES commission into a GHS wallet without an
 * exchange rate this system does not have. Anything in another currency stays
 * where it is, for the admin to pay out the existing way.
 *
 * Order matters: the commission is debited first. If the wallet credit then
 * fails we put the commission back, because the alternative ordering loses
 * real money — a credited wallet with the commission still showing as payable
 * lets the same balance be spent twice.
 */
export async function moveCommissionToWallet(
  subAdminId: string,
  amount: number,
): Promise<TransferOutcome> {
  const sa = await findSubAdminById(subAdminId)
  if (!sa) return { ok: false, reason: 'not-found' }

  const wallet = await ensureSubAdminWallet(sa)
  if (!wallet) return { ok: false, reason: 'no-wallet' }

  const currency = wallet.currency as CurrencyCode
  const rounded = +Number(amount).toFixed(2)
  if (!Number.isFinite(rounded) || rounded <= 0) return { ok: false, reason: 'bad-amount' }

  const available = sa.commissionBalances[currency] ?? 0
  if (available <= 0) {
    return { ok: false, reason: 'wrong-currency', available: 0, currency }
  }
  if (rounded > available) {
    return { ok: false, reason: 'insufficient', available, currency }
  }

  const debited = await debitCommission(subAdminId, rounded, currency)
  if (!debited) return { ok: false, reason: 'not-found' }

  let credited
  try {
    credited = await creditBalance(wallet.id, rounded)
    if (!credited) throw new Error('creditBalance returned null')
  } catch (e) {
    console.error('[sub-admin-wallet] wallet credit failed, refunding commission', {
      subAdminId,
      amount: rounded,
      currency,
      error: e instanceof Error ? e.message : String(e),
    })
    await creditCommissionBack(subAdminId, rounded, currency)
    return { ok: false, reason: 'not-found' }
  }

  // Ledger row so the money shows up in the sub-admin's own transaction
  // history and reconciles against the commission that left. Best-effort — the
  // transfer itself has already happened and must not be undone over an audit
  // row, but a failure here is worth shouting about.
  await recordPayment({
    userId: wallet.id,
    reference: `SA-COMM-${subAdminId.slice(0, 8)}-${Date.now()}`,
    amount: rounded,
    type: 'deposit',
    status: 'success',
    provider: 'commission',
    currency,
    metadata: {
      source: 'sub-admin-commission',
      subAdminId,
      subAdminName: sa.name,
    },
  }).catch((e) =>
    console.error('[sub-admin-wallet] ledger row failed (transfer already applied)', {
      subAdminId,
      amount: rounded,
      currency,
      error: e instanceof Error ? e.message : String(e),
    }),
  )

  // The wallet now holds money; make sure the main site will let them use it.
  await markWalletReady(wallet.id)

  return { ok: true, moved: rounded, currency, balance: credited.balance ?? 0 }
}

/**
 * Put commission back after a failed wallet credit.
 *
 * Deliberately not creditCommission(): that also bumps lifetime earnings, and
 * this is un-doing a transfer, not recording new income. Restoring the payable
 * balance is the whole job.
 */
async function creditCommissionBack(
  subAdminId: string,
  amount: number,
  currency: CurrencyCode,
): Promise<void> {
  try {
    const sa = await findSubAdminById(subAdminId)
    if (!sa) throw new Error('sub-admin vanished mid-refund')
    const balances = { ...sa.commissionBalances }
    balances[currency] = +(((balances[currency] ?? 0) + amount)).toFixed(2)
    const patch: Parameters<typeof updateSubAdmin>[1] = { commissionBalances: balances }
    if (currency === 'GHS') patch.commissionBalance = +(sa.commissionBalance + amount).toFixed(2)
    await updateSubAdmin(subAdminId, patch)
  } catch (e) {
    // Both halves failed. The commission has left the payable balance and never
    // reached the wallet, so this one needs a human.
    console.error('[sub-admin-wallet] REFUND FAILED — manual correction required', {
      subAdminId,
      amount,
      currency,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
