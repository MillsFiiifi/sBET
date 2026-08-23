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
 * Verified against the live API: the receipt-shaped version sits in moderation,
 * this one comes back DELIVERED. Keep it reading like a message from a
 * bookmaker rather than one from a network.
 */
export function withdrawalPaidMessage(input: WithdrawalMessageInput): string {
  const amt = formatMoneyWithCurrency(input.amount, input.currency)
  const bal =
    input.balance != null
      ? ` Balance: ${formatMoneyWithCurrency(input.balance, input.currency)}.`
      : ''
  return (
    `PowerStakeBet: Your withdrawal of ${amt} has been sent to your mobile money.${bal} ` +
    `Ref: ${input.reference}. Thank you for playing with PowerStakeBet.`
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
