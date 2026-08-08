// Withdrawal SMS notifications — a "request received" text when the player
// asks to withdraw, and a MoMo-style "money sent" text once the payout is
// approved/settled. Best-effort: any failure is logged and swallowed so it
// never affects the withdrawal itself.

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
    await sendSms({ phone: input.phone, country: input.country, message })
  } catch (e) {
    console.error('[withdrawal-sms] requested notify failed:', e)
  }
}

/** Sent once the admin approves / the transfer settles — money is on its way. */
export async function notifyWithdrawalPaid(input: WithdrawalSmsInput): Promise<void> {
  try {
    const amt = formatMoneyWithCurrency(input.amount, input.currency)
    const bal =
      input.balance != null
        ? ` Available Balance: ${formatMoneyWithCurrency(input.balance, input.currency)}.`
        : ''
    const message =
      `Payment received. You have received ${amt} to your mobile money from ` +
      `PowerStakeBet.${bal} Ref: ${input.reference}. Thank you for playing with PowerStakeBet.`
    await sendSms({ phone: input.phone, country: input.country, message })
  } catch (e) {
    console.error('[withdrawal-sms] paid notify failed:', e)
  }
}
