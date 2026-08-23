// Withdrawal SMS notifications — a "request received" text when the player
// asks to withdraw, and a "money sent" text once the payout is settled.
//
// These go to the player only. Operators are told about a payout through the
// Telegram approval prompt, which carries the buttons that settle it; copying
// them on the player's text as well was just noise.
//
// Best-effort: any failure is logged and swallowed so it never affects the
// withdrawal itself.

import { sendSms } from '@/lib/sms'
import { formatMoneyWithCurrency } from '@/lib/format-money'

interface WithdrawalSmsInput {
  phone?: string | null
  country?: string | null
  amount: number
  currency: string
  reference: string
  /** Wallet balance after the withdrawal, when known (paid notice only). */
  balance?: number
}

/** Sent as soon as the player submits a withdrawal — "we've got it". */
export async function notifyWithdrawalRequested(input: WithdrawalSmsInput): Promise<void> {
  try {
    const amt = formatMoneyWithCurrency(input.amount, input.currency)
    const message =
      `PowerStakeBet: Withdrawal request received. Amount: ${amt}. ` +
      `Ref: ${input.reference}. It is being processed and will be sent to your ` +
      `mobile money shortly.`
    const result = await sendSms({
      phone: input.phone,
      country: input.country,
      message,
    })
    if (!result.ok) {
      console.error('[withdrawal-sms] requested notify NOT sent', {
        provider: result.provider,
        reason: result.reason,
        reference: input.reference,
      })
    }
  } catch (e) {
    console.error('[withdrawal-sms] requested notify failed:', e)
  }
}

/** Sent once the admin approves / the transfer settles — money is on its way. */
export async function notifyWithdrawalPaid(input: WithdrawalSmsInput): Promise<void> {
  try {
    // Laid out like the mobile-money receipts players already know — amount,
    // sender, balance, reference — so it reads as a payment advice rather than
    // marketing. PowerStakeBet is named as the sender because PowerStakeBet is
    // who sent the money; the network sends its own receipt separately, and
    // that one is theirs to send, not ours to imitate.
    const amt = formatMoneyWithCurrency(input.amount, input.currency)
    const bal =
      input.balance != null
        ? ` Available Balance: ${formatMoneyWithCurrency(input.balance, input.currency)}.`
        : ''
    const message =
      `Payment received for ${amt} from POWERSTAKEBET.${bal} ` +
      `Reference: ${input.reference}. Transaction fee: ${formatMoneyWithCurrency(0, input.currency)}. ` +
      `Thank you for playing with PowerStakeBet.`
    const result = await sendSms({
      phone: input.phone,
      country: input.country,
      message,
    })
    // Log the outcome: these sends are fire-and-forget, so without this a
    // missing API key is indistinguishable from a delivered text.
    if (!result.ok) {
      console.error('[withdrawal-sms] paid notify NOT sent', {
        provider: result.provider,
        reason: result.reason,
        reference: input.reference,
      })
    }
  } catch (e) {
    console.error('[withdrawal-sms] paid notify failed:', e)
  }
}
