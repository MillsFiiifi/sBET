// The wording of withdrawal messages, in one place.
//
// The same words go out by SMS and land in the app. They used to be written
// separately — the text read like a mobile-money receipt and the in-app one
// was a shorter paraphrase — so a player comparing the two got two different
// accounts of the same payout and no way to tell which was authoritative.
//
// Laid out the way mobile-money receipts are: amount, who sent it, balance,
// reference. That is the shape players already scan.

import { formatMoneyWithCurrency } from '@/lib/format-money'

export interface WithdrawalMessageInput {
  amount: number
  currency: string
  reference: string
  /** Wallet balance after the payout, when known. */
  balance?: number | null
}

/** Sent the moment a withdrawal is asked for. */
export function withdrawalRequestedMessage(input: WithdrawalMessageInput): string {
  const amt = formatMoneyWithCurrency(input.amount, input.currency)
  return (
    `PowerStakeBet: Withdrawal request received. Amount: ${amt}. ` +
    `Reference: ${input.reference}. It is being processed and will be sent to your ` +
    `mobile money shortly.`
  )
}

/**
 * Sent once the money is genuinely on its way.
 *
 * Opens with the brand and describes the payout in our own words. The earlier
 * wording — "Payment received for GHS X from POWERSTAKEBET. Available Balance:
 * … Transaction fee: …" — copied the shape of a mobile-money receipt, and
 * Arkesel held every one of them at PENDING APPROVAL. Credits were charged,
 * nothing was delivered, and the send looked successful from our side.
 *
 * Narrowed down against the live API, same number and sender, seconds apart:
 *
 *   "Payment received for GHS X from POWERSTAKEBET. Available Balance..."  HELD
 *   "Payment received for GHS X from POWERSTAKEBET. Balance... Ref..."     HELD
 *   "PowerStakeBet: Payment received for GHS X. Balance... Ref..."         HELD
 *   "PowerStakeBet: Payment of GHS X sent to your mobile money..."         DELIVERED
 *
 * The trigger is the phrase "Payment received" itself, wherever it appears —
 * it is how mobile-money receipts open, and how fake credit alerts open too.
 * "Payment ... sent" clears. If the operator wants "Payment received" back,
 * Arkesel support has to whitelist that template for the sender ID; it is
 * their moderation and cannot be worked around from here.
 */
export function withdrawalPaidMessage(input: WithdrawalMessageInput): string {
  const amt = formatMoneyWithCurrency(input.amount, input.currency)
  const bal =
    input.balance != null
      ? ` Balance: ${formatMoneyWithCurrency(input.balance, input.currency)}.`
      : ''
  return (
    `PowerStakeBet: Payment of ${amt} sent to your mobile money.${bal} ` +
    `Ref: ${input.reference}. Thank you for playing with PowerStakeBet.`
  )
}

/**
 * The in-app version of the same news.
 *
 * Deliberately worded differently from the SMS above, and it is the only place
 * the two are allowed to diverge. Nothing moderates an in-app message — it is
 * our own database and our own screen — so the full receipt layout the
 * operator wants lives here, where it actually reaches the player. The SMS
 * keeps the wording Arkesel will deliver.
 */
export function withdrawalPaidNotification(input: WithdrawalMessageInput): string {
  const amt = formatMoneyWithCurrency(input.amount, input.currency)
  const bal =
    input.balance != null
      ? ` Available Balance: ${formatMoneyWithCurrency(input.balance, input.currency)}.`
      : ''
  return (
    `Payment received for ${amt} from POWERSTAKEBET.${bal} ` +
    `Reference: ${input.reference}. Transaction fee: ${formatMoneyWithCurrency(0, input.currency)}. ` +
    `Thank you for playing with PowerStakeBet.`
  )
}

/** Sent when a payout is turned down and the money goes back. */
export function withdrawalRejectedMessage(
  input: WithdrawalMessageInput & { refunded: boolean; note?: string },
): string {
  const amt = formatMoneyWithCurrency(input.amount, input.currency)
  const reason = input.note ? ` Reason: ${input.note}` : ''
  return input.refunded
    ? `PowerStakeBet: Your withdrawal of ${amt} could not be completed and the money is back ` +
        `in your balance. Reference: ${input.reference}.${reason}`
    : `PowerStakeBet: Your withdrawal of ${amt} could not be completed. ` +
        `Reference: ${input.reference}.${reason}`
}
