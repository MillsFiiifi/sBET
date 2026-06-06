import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, isValidSessionCookie } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// Admin-only one-shot endpoint that registers the Telegram webhook for
// the deposit-approval bot. Reads the bot token + webhook secret from
// server env so neither value has to be exposed to the browser or the
// developer's terminal. Hit it after configuring the env vars; idempotent
// so re-running is safe (Telegram simply overwrites the existing hook).
//
// GET /api/admin/telegram-setup        → registers
// GET /api/admin/telegram-setup?info=1 → just reports current webhook status
// GET /api/admin/telegram-setup?delete=1 → unregisters

export async function GET(request: Request) {
  const cookieStore = await cookies()
  if (!(await isValidSessionCookie(cookieStore.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
  if (!token) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN missing' }, { status: 500 })
  }

  const url = new URL(request.url)
  const baseOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim() || `${url.protocol}//${url.host}`
  const webhookUrl = `${baseOrigin.replace(/\/$/, '')}/api/telegram/webhook`

  if (url.searchParams.get('info') === '1') {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
    const data = await res.json().catch(() => ({}))
    return NextResponse.json({ webhookUrl, telegram: data })
  }

  // ?check=1 — calls getMe to verify the token is valid. Reports just
  // the bot identity and the token's length / first-3 / last-3 chars so
  // the operator can confirm Vercel actually has what they pasted
  // without exposing the secret to the browser.
  if (url.searchParams.get('check') === '1') {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`)
    const data = await res.json().catch(() => ({}))
    return NextResponse.json({
      tokenLength: token.length,
      tokenStart: token.slice(0, 3),
      tokenEnd: token.slice(-3),
      hasWhitespace: token !== token.trim() || /\s/.test(token),
      telegram: data,
    })
  }

  if (url.searchParams.get('delete') === '1') {
    const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
      method: 'POST',
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json({ ok: data.ok, telegram: data })
  }

  if (!secret) {
    return NextResponse.json(
      { error: 'TELEGRAM_WEBHOOK_SECRET missing — set it before registering' },
      { status: 500 },
    )
  }

  const setRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ['callback_query'],
    }),
  })
  const setData = (await setRes.json().catch(() => ({}))) as {
    ok?: boolean
    description?: string
  }

  // Always read back getWebhookInfo so the operator can see the current
  // hook URL, any delivery errors, and any queued updates in one call.
  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
  const infoData = await infoRes.json().catch(() => ({}))

  if (!setRes.ok || !setData.ok) {
    return NextResponse.json(
      {
        ok: false,
        webhookUrl,
        secretLength: secret.length,
        setWebhook: { status: setRes.status, description: setData.description ?? 'unknown error' },
        webhookInfo: infoData,
      },
      { status: 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    webhookUrl,
    secretLength: secret.length,
    setWebhook: setData,
    webhookInfo: infoData,
  })
}
