// Settling a manual withdrawal — the operator has sent (or refused to send)
// the money by hand, and the ledger plus the player need to catch up.
//
// This exists because Flutterwave's Transfers API is gated behind an IP
// allow-list that Vercel's dynamic egress can't satisfy, so GH/KE payouts
// fall back to being paid by a human. Both the Telegram buttons and the admin
// dashboard route through here so the two can't drift apart.
//
// The one rule worth remembering: the player's "payment received" text is sent
// from here and nowhere else, because here is the only place we know the money
// actually left.

import type { CurrencyCode } from '@/lib/countries'
import {
  findPaymentById,
  markPaymentResolved,
  resolveWithdrawalByReference,
  updatePayment,
} from '@/lib/payments-store'
import { addWithdrawnTotal, creditBalance, findUserById } from '@/lib/users-store'
import { reverseCommissionOnWithdrawal } from '@/lib/withdrawal-commission'
import { notifyWithdrawalPaid } from '@/lib/withdrawal-sms'
import { emailWithdrawalPaid } from '@/lib/withdrawal-email'
import { notify } from '@/lib/notifications-store'
import { withdrawalPaidNotification, withdrawalRejectedMessage } from '@/lib/withdrawal-messages'

export type SettleOutcome =
  | { ok: true; amount: number; currency: string; refunded: boolean }
  | { ok: false; reason: 'not-found' | 'not-a-withdrawal' | 'already-settled' | 'raced' }

/**
 * Mark a pending withdrawal paid, and tell the player.
 *
 * Call this only once the money is genuinely on its way — the SMS it sends
 * says the payment has been received.
 */
export async function markWithdrawalPaid(
  paymentId: string,
  note: string,
): Promise<SettleOutcome> {
  const payment = await findPaymentById(paymentId)
  if (!payment) return { ok: false, reason: 'not-found' }
  if (payment.type !== 'withdrawal') return { ok: false, reason: 'not-a-withdrawal' }
  if (payment.status !== 'pending') return { ok: false, reason: 'already-settled' }

  // Flip to success first. If someone else got here between our read and this
  // write, they own the settlement and we stop — otherwise the player is
  // notified twice and the lifetime total is counted twice.
  const resolved = await markPaymentResolved(paymentId, note)
  if (!resolved) return { ok: false, reason: 'raced' }

  if (payment.userId) {
    await addWithdrawnTotal(payment.userId, payment.amount).catch((e) =>
      console.error('[withdrawal-settle] total_withdrawn bump failed:', e),
    )
    // The money has left the platform, so the referrer's cut on it goes back.
    await reverseCommissionOnWithdrawal(
      payment.userId,
      payment.amount,
      payment.currency as CurrencyCode,
    ).catch((e) => console.error('[withdrawal-settle] commission reversal failed:', e))

    const user = await findUserById(payment.userId).catch(() => null)
    const destination = (payment.metadata?.phone as string | undefined) ?? user?.phone ?? null
    const network = (payment.metadata?.network as string | undefined) ?? null

    // Awaited, not fired and forgotten.
    //
    // These used to be `void`, which on serverless means the work is handed to
    // an instance that is about to be frozen the moment the response returns.
    // It resumes whenever that instance is next woken — so the text arrived
    // minutes late, or on the back of somebody else's unrelated request. The
    // delay was ours, not the network's.
    //
    // allSettled because they are independent: a missing Resend key must not
    // stop the SMS, and a failing SMS must not stop the in-app copy. Each one
    // already logs its own failure.
    await Promise.allSettled([
      // Player only — the operator already acted on the approval prompt.
      notifyWithdrawalPaid({
        phone: destination,
        country: user?.country,
        amount: payment.amount,
        currency: payment.currency,
        reference: payment.reference,
        balance: user?.balance,
      }),

      // In-app, which lands whether or not SMS and email are configured. This
      // is the copy the player can still find next week.
      notify({
        userId: payment.userId,
        kind: 'withdrawal',
        title: 'Withdrawal sent',
        // The full receipt wording. Only lives here: Arkesel holds anything
        // containing "Payment received", so the SMS says it differently.
        body: withdrawalPaidNotification({
          amount: payment.amount,
          currency: payment.currency,
          reference: payment.reference,
          balance: user?.balance,
        }),
        metadata: {
          reference: payment.reference,
          amount: payment.amount,
          currency: payment.currency,
        },
      }),

      // Email carries the same news with the reference attached, so the player
      // has something searchable if the payout is ever queried.
      emailWithdrawalPaid({
        email: user?.email,
        name: user?.name,
        amount: payment.amount,
        currency: payment.currency,
        reference: payment.reference,
        destination,
        network,
      }),
    ])
  }

  return { ok: true, amount: payment.amount, currency: payment.currency, refunded: false }
}

/**
 * Reject a pending withdrawal and hand the money back.
 *
 * Only paths that reserved the balance up front get a refund — the bank-country
 * queue records the request without debiting, so refunding there would mint
 * money. `metadata.balanceReserved` records which kind a row is.
 */
export async function rejectWithdrawal(
  paymentId: string,
  note: string,
): Promise<SettleOutcome> {
  const payment = await findPaymentById(paymentId)
  if (!payment) return { ok: false, reason: 'not-found' }
  if (payment.type !== 'withdrawal') return { ok: false, reason: 'not-a-withdrawal' }
  if (payment.status !== 'pending') return { ok: false, reason: 'already-settled' }

  // Flip pending → failed under the store's `.eq('status','pending')` guard so
  // two operators tapping Reject can't both refund. updatePayment has no such
  // guard, so it only ever runs after we've won the race, to attach the note.
  const failed = await resolveWithdrawalByReference(payment.reference, 'failed')
  if (!failed) return { ok: false, reason: 'raced' }
  await updatePayment(paymentId, {
    metadata: {
      adminResolved: true,
      resolvedAt: new Date().toISOString(),
      resolutionNote: note,
      failureReason: note,
    },
  }).catch((e) => console.error('[withdrawal-settle] note write failed:', e))

  const reserved = payment.metadata?.balanceReserved === true
  if (reserved && payment.userId) {
    await creditBalance(payment.userId, payment.amount).catch((e) =>
      console.error('[withdrawal-settle] refund failed:', e),
    )
  }

  // Rejections were silent before this — the money reappeared in the balance
  // with no explanation, which reads as a bug to the player.
  void notify({
    userId: payment.userId,
    kind: 'withdrawal',
    title: reserved ? 'Withdrawal declined — money returned' : 'Withdrawal declined',
    body: withdrawalRejectedMessage({
      amount: payment.amount,
      currency: payment.currency,
      reference: payment.reference,
      refunded: reserved,
      note,
    }),
    metadata: { reference: payment.reference, amount: payment.amount, currency: payment.currency },
  })

  return {
    ok: true,
    amount: payment.amount,
    currency: payment.currency,
    refunded: reserved,
  }
}
