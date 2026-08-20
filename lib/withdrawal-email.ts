// Withdrawal emails. Sent alongside the SMS so a player has a record with the
// reference on it — the text is what they see, this is what they can search
// for later.
//
// Both are fired from lib/withdrawal-settle.ts, at the point the payout is
// confirmed sent. Nothing here should ever be called earlier: the wording says
// the money is on its way, and it needs to be true when it lands.

import { sendEmail, emailShell } from '@/lib/email'
import { formatMoneyWithCurrency } from '@/lib/format-money'

interface WithdrawalEmailInput {
  email?: string | null
  name?: string | null
  amount: number
  currency: string
  reference: string
  /** Wallet the payout went to, e.g. "0534058809". */
  destination?: string | null
  network?: string | null
}

/** "Withdrawal sent" — after the payout has actually gone out. */
export async function emailWithdrawalPaid(input: WithdrawalEmailInput): Promise<void> {
  const to = input.email?.trim()
  if (!to) return

  try {
    const amount = formatMoneyWithCurrency(input.amount, input.currency)
    const network = (input.network ?? '').toUpperCase()
    const target = [network, input.destination].filter(Boolean).join(' ')
    const greeting = input.name ? `Good news, ${input.name}!` : 'Good news!'

    const rows: Array<[string, string]> = [['Amount', amount]]
    if (target) rows.push(['Sent to', target])
    rows.push(['Reference', input.reference])

    await sendEmail({
      to,
      subject: `Withdrawal sent — ${amount}${target ? ` to your ${network || 'wallet'}` : ''}`,
      html: emailShell({
        heading: 'Withdrawal sent',
        intro: `${greeting} Your withdrawal has been processed and sent to your mobile money account.`,
        rows,
        footnote:
          'Mobile money can take a few minutes to show up. If it has not arrived within 24 hours, reply to this email with the reference above.',
      }),
      text:
        `${greeting}\n\nYour withdrawal has been processed and sent to your mobile money account.\n\n` +
        `Amount: ${amount}\n` +
        (target ? `Sent to: ${target}\n` : '') +
        `Reference: ${input.reference}\n\n` +
        `Mobile money can take a few minutes to show up. If it has not arrived within 24 hours, reply with the reference above.`,
    })
  } catch (e) {
    console.error('[withdrawal-email] paid email failed:', e)
  }
}

/** "We've got your request" — sent when the withdrawal is queued. */
export async function emailWithdrawalRequested(input: WithdrawalEmailInput): Promise<void> {
  const to = input.email?.trim()
  if (!to) return

  try {
    const amount = formatMoneyWithCurrency(input.amount, input.currency)
    const network = (input.network ?? '').toUpperCase()
    const target = [network, input.destination].filter(Boolean).join(' ')

    const rows: Array<[string, string]> = [['Amount', amount]]
    if (target) rows.push(['Paying out to', target])
    rows.push(['Reference', input.reference])

    await sendEmail({
      to,
      subject: `Withdrawal request received — ${amount}`,
      html: emailShell({
        heading: 'Withdrawal request received',
        intro:
          'We have your request and it is being processed. You will get another email once the money has been sent.',
        rows,
        footnote: 'If you did not make this request, contact support immediately.',
      }),
      text:
        `We have your withdrawal request and it is being processed. ` +
        `You will get another email once the money has been sent.\n\n` +
        `Amount: ${amount}\n` +
        (target ? `Paying out to: ${target}\n` : '') +
        `Reference: ${input.reference}\n\n` +
        `If you did not make this request, contact support immediately.`,
    })
  } catch (e) {
    console.error('[withdrawal-email] requested email failed:', e)
  }
}
