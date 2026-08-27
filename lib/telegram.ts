// Telegram bot helper for the Nigeria "Pay via Telegram (Manual)" flow.
//
// The operator flow:
//   1. User taps "Pay via Telegram" on the deposit screen.
//   2. /api/payments/telegram/start writes a pending payment row, then
//      calls sendApprovalRequest below. The bot posts a message into the
//      configured admin chat with two inline buttons: Approve / Reject.
//   3. Operator taps a button. Telegram POSTs the callback to
//      /api/telegram/webhook, which credits or rejects the payment.
//
// Required env vars:
//   TELEGRAM_BOT_TOKEN       — from @BotFather
//   TELEGRAM_ADMIN_CHAT_ID   — the chat (group / DM) the bot posts into
//   TELEGRAM_WEBHOOK_SECRET  — random string, set when registering the
//                              webhook so we can authenticate incoming
//                              callbacks (Telegram echoes it as a header)

const TG_API = 'https://api.telegram.org'

export interface SendApprovalRequestInput {
  paymentId: string
  reference: string
  amount: number
  currency: string
  userName: string
  userEmail: string
  userPhone: string | null
  country: string
  /** How the user paid, e.g. "MTN MoMo 0594395361" — shown as a Method line. */
  method?: string | null
  /**
   * Public URL of the receipt the user uploaded. When set the approval is
   * posted as a photo with the details as its caption, so the operator can
   * eyeball the proof and approve from the same message.
   */
  screenshotUrl?: string | null
}

export interface TelegramSendResult {
  messageId: number
  chatId: string
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) throw new Error(`${name} is not configured`)
  return v
}

/**
 * Post the "approve this deposit?" message into the admin chat with two
 * inline buttons. The button's `callback_data` carries the action and the
 * payment id so the webhook handler knows exactly what to do.
 *
 * Telegram's `callback_data` is capped at 64 bytes — `approve:<uuid>`
 * (~40 bytes) fits comfortably.
 */
export async function sendApprovalRequest(
  input: SendApprovalRequestInput,
): Promise<TelegramSendResult> {
  const token = requireEnv('TELEGRAM_BOT_TOKEN')
  const chatId = requireEnv('TELEGRAM_ADMIN_CHAT_ID')

  const text = [
    '*New deposit awaiting approval*',
    '',
    `*User:* ${escapeMarkdown(input.userName)}`,
    `*Email:* ${escapeMarkdown(input.userEmail)}`,
    input.userPhone ? `*Phone:* ${escapeMarkdown(input.userPhone)}` : null,
    `*Country:* ${escapeMarkdown(input.country)}`,
    input.method ? `*Paid via:* ${escapeMarkdown(input.method)}` : null,
    `*Amount:* ${input.currency} ${input.amount.toFixed(2)}`,
    `*Reference:* \`${escapeMarkdown(input.reference)}\``,
  ]
    .filter(Boolean)
    .join('\n')

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '✅ Approve & credit', callback_data: `approve:${input.paymentId}` },
        { text: '✕ Reject', callback_data: `reject:${input.paymentId}` },
      ],
    ],
  }

  // With a receipt, post it as a photo carrying the details as its caption —
  // one message the operator can both inspect and act on. Telegram caps
  // captions at 1024 chars; ours is well under that.
  const endpoint = input.screenshotUrl ? 'sendPhoto' : 'sendMessage'
  const body: Record<string, unknown> = {
    chat_id: chatId,
    parse_mode: 'Markdown',
    reply_markup: replyMarkup,
    ...(input.screenshotUrl
      ? { photo: input.screenshotUrl, caption: text }
      : { text }),
  }

  const res = await fetch(`${TG_API}/bot${token}/${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    description?: string
    result?: { message_id: number; chat: { id: number | string } }
  }
  if (!res.ok || !json.ok || !json.result) {
    throw new Error(`telegram.${endpoint} failed: ${json.description ?? res.status}`)
  }
  return {
    messageId: json.result.message_id,
    chatId: String(json.result.chat.id),
  }
}

export interface SendWithdrawalRequestInput {
  paymentId: string
  reference: string
  amount: number
  currency: string
  userName: string
  userEmail: string
  /** Wallet the money must be sent to — the number the operator will pay. */
  payoutPhone: string
  network: string
  country: string
  /** Why the automatic transfer didn't run, when that's why this is manual. */
  blockedReason?: string | null
}

/**
 * Post a "go and pay this player" prompt into the operator chat.
 *
 * Deliberately worded as an instruction, not a confirmation: the buttons
 * settle the ledger and text the player that the money has arrived, so
 * "Paid" must only be tapped after the transfer has actually been sent.
 */
export async function sendWithdrawalRequest(
  input: SendWithdrawalRequestInput,
): Promise<TelegramSendResult> {
  const token = requireEnv('TELEGRAM_BOT_TOKEN')
  const chatId = requireEnv('TELEGRAM_ADMIN_CHAT_ID')

  const text = [
    '*💸 Withdrawal to pay out*',
    '',
    `*Player:* ${escapeMarkdown(input.userName)}`,
    `*Email:* ${escapeMarkdown(input.userEmail)}`,
    `*Send to:* \`${escapeMarkdown(input.payoutPhone)}\` (${escapeMarkdown(input.network.toUpperCase())})`,
    `*Amount:* ${input.currency} ${input.amount.toFixed(2)}`,
    `*Country:* ${escapeMarkdown(input.country)}`,
    `*Reference:* \`${escapeMarkdown(input.reference)}\``,
    input.blockedReason ? `\n_Auto-transfer unavailable: ${escapeMarkdown(input.blockedReason)}_` : null,
    '',
    '_Send the money first, then tap Paid — the player is told it has arrived._',
  ]
    .filter(Boolean)
    .join('\n')

  const res = await fetch(`${TG_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Paid — notify player', callback_data: `wpaid:${input.paymentId}` },
            { text: '✕ Reject & refund', callback_data: `wreject:${input.paymentId}` },
          ],
        ],
      },
    }),
  })
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    description?: string
    result?: { message_id: number; chat: { id: number | string } }
  }
  if (!res.ok || !json.ok || !json.result) {
    throw new Error(`telegram.sendMessage failed: ${json.description ?? res.status}`)
  }
  return { messageId: json.result.message_id, chatId: String(json.result.chat.id) }
}

/**
 * Edit the original approval message to show the final state (approved /
 * rejected) and strip the inline keyboard so the operator can't tap again.
 */
export async function finalizeApprovalMessage(params: {
  chatId: string
  messageId: number
  text: string
}): Promise<void> {
  const token = requireEnv('TELEGRAM_BOT_TOKEN')
  const base = {
    chat_id: params.chatId,
    message_id: params.messageId,
    parse_mode: 'Markdown',
    // Drop the buttons so the operator can't tap a resolved payment again.
    reply_markup: { inline_keyboard: [] },
  }

  async function edit(endpoint: string, payload: Record<string, unknown>) {
    const res = await fetch(`${TG_API}/bot${token}/${endpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...base, ...payload }),
    }).catch(() => null)
    return Boolean(res?.ok)
  }

  // Receipt approvals are photo messages, whose text lives in a caption —
  // editMessageText fails on those, so fall back to editMessageCaption.
  const edited = await edit('editMessageText', { text: params.text })
  if (!edited) await edit('editMessageCaption', { caption: params.text })
}

/**
 * Acknowledge a callback query so the spinner on the operator's button
 * disappears. Telegram requires this within ~15s of the button tap.
 */
export async function answerCallbackQuery(params: {
  callbackQueryId: string
  text?: string
}): Promise<void> {
  const token = requireEnv('TELEGRAM_BOT_TOKEN')
  await fetch(`${TG_API}/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: params.callbackQueryId,
      text: params.text,
    }),
  }).catch(() => null)
}

/**
 * Telegram lets you register a webhook with a `secret_token`. It echoes
 * that token back in the X-Telegram-Bot-Api-Secret-Token header on every
 * delivery so the receiver can confirm the call is genuine.
 */
export function verifyWebhookSecret(request: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
  if (!expected) return false
  const provided = request.headers.get('x-telegram-bot-api-secret-token')
  return provided === expected
}

// Telegram Markdown is strict — escape the special chars in user-supplied
// strings so a `_` in an email doesn't blow up formatting.
function escapeMarkdown(s: string): string {
  return s.replace(/([*_`\[])/g, '\\$1')
}
