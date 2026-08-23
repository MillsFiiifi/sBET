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
 * Opens "You have received" rather than "Payment received", and that is the
 * whole of the difference. Arkesel holds the exact phrase "Payment received"
 * in a moderation queue: it is how mobile-money receipts open and how fake
 * credit alerts open, so their filter takes it wherever it appears.
 *
 * Measured on the live API, same number and sender, minutes apart:
 *
 *   "Payment received for GHS X from POWERSTAKEBET..."         HELD
 *   "PowerStakeBet: Payment received for GHS X..."             HELD
 *   "You have received GHS X from POWERSTAKEBET..."            DELIVERED
 *   "GHS X received from POWERSTAKEBET..."                     DELIVERED
 *   "Payment credited: GHS X from POWERSTAKEBET..."            DELIVERED
 *
 * So the receipt layout is fine, the word "received" is fine, and only that
 * one opening pair is not. Everything else here — amount, sender, available
 * balance, reference, transaction fee — is exactly as the operator wanted it.
 *
 * Worth knowing when this next appears broken: a held message still returns
 * success from the API and still costs a credit, so from our side it is
 * indistinguishable from a delivered one. Check the delivery status endpoint,
 * not the send response.
 */
export function withdrawalPaidMessage(input: WithdrawalMessageInput): string {
  const amt = formatMoneyWithCurrency(input.amount, input.currency)
  const bal =
    input.balance != null
      ? ` Available Balance: ${formatMoneyWithCurrency(input.balance, input.currency)}.`
      : ''
  return (
    `You have received ${amt} from POWERSTAKEBET.${bal} ` +
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
