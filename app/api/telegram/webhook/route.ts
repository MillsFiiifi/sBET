import { NextResponse } from 'next/server'
import { findPaymentById, markPaymentResolved } from '@/lib/payments-store'
import { supabaseServer } from '@/lib/supabase'
import { applyDepositCredit } from '@/lib/deposit-credit'
import {
  answerCallbackQuery,
  finalizeApprovalMessage,
  verifyWebhookSecret,
} from '@/lib/telegram'

export const dynamic = 'force-dynamic'

// Telegram updates we care about. We only handle callback_query (inline
// keyboard button taps). Other update types are acked with 200 so Telegram
// doesn't keep retrying.
interface TelegramUpdate {
  update_id?: number
  callback_query?: {
    id: string
    from?: { id: number; username?: string; first_name?: string }
    data?: string
    message?: {
      message_id: number
      chat: { id: number | string }
    }
  }
}

export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    console.warn('[telegram/webhook] secret mismatch — rejecting')
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch (e) {
    console.warn('[telegram/webhook] invalid json body', e)
    return NextResponse.json({ ok: true })
  }

  console.log('[telegram/webhook] received update', JSON.stringify(update).slice(0, 500))

  const cb = update.callback_query
  if (!cb || !cb.data || !cb.message) {
    console.warn('[telegram/webhook] no callback_query.data/message on update', {
      hasCb: Boolean(cb),
      hasData: Boolean(cb?.data),
      hasMessage: Boolean(cb?.message),
    })
    return NextResponse.json({ ok: true })
  }

  const [action, paymentId] = cb.data.split(':')
  console.log('[telegram/webhook] action', { action, paymentId, callbackQueryId: cb.id })

  if (!paymentId || (action !== 'approve' && action !== 'reject')) {
    console.warn('[telegram/webhook] unknown action', { cbData: cb.data })
    await answerCallbackQuery({ callbackQueryId: cb.id, text: 'Unknown action' })
    return NextResponse.json({ ok: true })
  }

  const payment = await findPaymentById(paymentId)
  if (!payment) {
    console.warn('[telegram/webhook] payment row not found', { paymentId })
    await answerCallbackQuery({ callbackQueryId: cb.id, text: 'Payment not found' })
    return NextResponse.json({ ok: true })
  }
  console.log('[telegram/webhook] payment row loaded', {
    paymentId: payment.id,
    status: payment.status,
    amount: payment.amount,
  })

  // Already resolved (operator double-clicked, or a different path credited
  // it). Just clean up the message and ack.
  if (payment.status === 'success' || payment.status === 'failed') {
    await answerCallbackQuery({
      callbackQueryId: cb.id,
      text: `Already ${payment.status}`,
    })
    await finalizeApprovalMessage({
      chatId: String(cb.message.chat.id),
      messageId: cb.message.message_id,
      text: `Payment \`${payment.reference}\` — already *${payment.status}*. No action taken.`,
    })
    return NextResponse.json({ ok: true })
  }

  const operator = cb.from?.username || cb.from?.first_name || `tg:${cb.from?.id ?? '?'}`

  if (action === 'reject') {
    await markPaymentRejected(payment.id, `rejected by ${operator} via telegram`)
    await answerCallbackQuery({ callbackQueryId: cb.id, text: 'Rejected.' })
    await finalizeApprovalMessage({
      chatId: String(cb.message.chat.id),
      messageId: cb.message.message_id,
      text: `❌ Rejected by *${operator}*\n\nReference: \`${payment.reference}\`\nAmount: ${payment.currency} ${payment.amount.toFixed(2)}`,
    })
    return NextResponse.json({ ok: true })
  }

  // action === 'approve'
  if (!payment.userId) {
    await answerCallbackQuery({ callbackQueryId: cb.id, text: 'Missing user on row' })
    return NextResponse.json({ ok: true })
  }

  try {
    const resolved = await markPaymentResolved(payment.id, `approved by ${operator} via telegram`)
    if (!resolved) {
      await answerCallbackQuery({
        callbackQueryId: cb.id,
        text: 'Another path already resolved this',
      })
      return NextResponse.json({ ok: true })
    }
    await applyDepositCredit(payment.userId, payment.amount)
  } catch (e) {
    console.error('[telegram/webhook] credit pipeline failed:', e)
    await answerCallbackQuery({
      callbackQueryId: cb.id,
      text: 'Credit failed — check Vercel logs',
    })
    return NextResponse.json({ ok: true })
  }

  await answerCallbackQuery({ callbackQueryId: cb.id, text: 'Approved & credited.' })
  await finalizeApprovalMessage({
    chatId: String(cb.message.chat.id),
    messageId: cb.message.message_id,
    text: `✅ Approved by *${operator}* — user credited.\n\nReference: \`${payment.reference}\`\nAmount: ${payment.currency} ${payment.amount.toFixed(2)}`,
  })
  return NextResponse.json({ ok: true })
}

// payments-store doesn't expose a "mark as failed" path because none of
// the existing flows need it — Paystack / Moolre only ever flip to
// success. Telegram rejections need it though. Inline a small helper
// here that flips the row to 'failed' with a note in metadata.
async function markPaymentRejected(id: string, note: string): Promise<void> {
  const existing = await findPaymentById(id)
  if (!existing || existing.status === 'success' || existing.status === 'failed') return
  const mergedMeta = {
    ...existing.metadata,
    type: existing.type,
    adminResolved: true,
    resolvedAt: new Date().toISOString(),
    resolutionNote: note,
    failureReason: note,
  }
  await supabaseServer()
    .from('payments')
    .update({
      status: 'failed',
      verified_at: new Date().toISOString(),
      metadata: mergedMeta,
    })
    .eq('id', id)
    .in('status', ['pending'])
}
