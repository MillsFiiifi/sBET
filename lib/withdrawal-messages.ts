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
 * Sent once the money is genuinely on its way — SMS and in-app both.
 *
 * ⚠️ Arkesel holds any message containing the phrase "Payment received" in a
 * moderation queue. Tested four ways on the live API, same number and sender,
 * seconds apart:
 *
 *   "Payment received for GHS X from POWERSTAKEBET. Available Balance..."  HELD
 *   "Payment received for GHS X from POWERSTAKEBET. Balance... Ref..."     HELD
 *   "PowerStakeBet: Payment received for GHS X. Balance... Ref..."         HELD
 *   "PowerStakeBet: Payment of GHS X sent to your mobile money..."         DELIVERED
 *
 * The operator has chosen this wording anyway, knowing that: it is the wording
 * they want players to see, and Arkesel support can whitelist the template for
 * the sender ID. Until they do, the API returns success and charges a credit
 * while the text sits unsent — so if withdrawal SMS "stops working", this is
 * the first thing to check, not the key and not the sender ID.
 *
 * A delivering alternative is one edit away: "Payment of X sent to your mobile
 * money" clears the filter untouched.
 */
export function withdrawalPaidMessage(input: WithdrawalMessageInput): string {
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

/**
 * The in-app copy. Identical to the SMS by delegation rather than by
 * duplication, so the two can never drift apart again.
 */
export function withdrawalPaidNotification(input: WithdrawalMessageInput): string {
  return withdrawalPaidMessage(input)
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
