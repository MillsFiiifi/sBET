import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, isValidSessionCookie } from '@/lib/admin-auth'
import { sendSms } from '@/lib/sms'

export const dynamic = 'force-dynamic'

/**
 * Admin-only SMS smoke test.
 *
 * Notification sends are fire-and-forget everywhere else, so a missing API key
 * looks exactly like a delivered message. This surfaces the provider's actual
 * answer, plus which credentials the running deployment can see — the usual
 * cause of "no SMS arrived" is env vars living in .env.local but never added
 * to Vercel.
 *
 * POST { phone: "0244000000", country?: "GH", message?: "..." }
 */
export async function POST(request: Request) {
  const store = await cookies()
  if (!isValidSessionCookie(store.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { phone?: string; country?: string; message?: string } = {}
  try {
    body = await request.json()
  } catch {
    /* empty body — handled below */
  }

  const phone = (body.phone ?? '').trim()
  if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 })

  const message =
    (body.message ?? '').trim() ||
    'PowerStakeBet test message. If you received this, SMS delivery is working. No action needed.'

  const result = await sendSms({
    phone,
    country: body.country ?? 'GH',
    message,
  })

  // Presence only — never the values.
  const env = {
    ARKESEL_API_KEY: Boolean(process.env.ARKESEL_API_KEY?.trim()),
    ARKESEL_SENDER_ID: process.env.ARKESEL_SENDER_ID?.trim() || '(default: PluseAlerts)',
    SMS_PROVIDER: process.env.SMS_PROVIDER?.trim() || '(unset → twilio)',
    TWILIO_ACCOUNT_SID: Boolean(process.env.TWILIO_ACCOUNT_SID?.trim()),
  }

  return NextResponse.json({ result, env }, { status: result.ok ? 200 : 502 })
}
