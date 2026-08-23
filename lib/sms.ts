type SendSmsResult = {
  ok: boolean
  provider: string
  reason?: string
}

function formatSmsPhone(country: string | null | undefined, raw: string): string | null {
  const cleaned = raw.replace(/[^\d+]/g, '').trim()
  if (!cleaned) return null
  if (cleaned.startsWith('+')) return cleaned

  const dialMap: Record<string, string> = {
    GH: '233',
    NG: '234',
    KE: '254',
    ZA: '27',
  }

  const key = country?.toUpperCase() ?? ''
  const prefix = dialMap[key]
  if (!prefix) return cleaned

  if (cleaned.startsWith('0')) return `+${prefix}${cleaned.slice(1)}`
  if (cleaned.startsWith(prefix)) return `+${cleaned}`
  return `+${prefix}${cleaned}`
}

export async function sendSms(input: {
  phone: string | null | undefined
  country?: string | null
  message: string
}): Promise<SendSmsResult> {
  const phone = formatSmsPhone(input.country, input.phone ?? '')
  if (!phone) {
    return { ok: false, provider: 'none', reason: 'missing-phone' }
  }

  // Arkesel (https://developers.arkesel.com — SMS API v2). Preferred when
  // configured. Recipients must be MSISDN without a leading "+".
  const arkeselKey = process.env.ARKESEL_API_KEY?.trim()
  if (arkeselKey) {
    // 'PulseAlerts', not 'Pluse' — the transposed spelling was the fallback
    // here for months and Arkesel rejects an unregistered sender ID outright
    // (code 111), so every send 403'd before it reached anyone.
    const sender = (process.env.ARKESEL_SENDER_ID || 'PulseAlerts').slice(0, 11)
    const recipient = phone.replace(/^\+/, '')
    try {
      const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
        method: 'POST',
        headers: { 'api-key': arkeselKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender, message: input.message, recipients: [recipient] }),
      })
      const data = (await res.json().catch(() => ({}))) as { status?: string; message?: string }
      if (!res.ok || (data.status && data.status !== 'success')) {
        console.error('[sms] arkesel send failed', {
          status: res.status,
          reason: data.message ?? '',
        })
        return { ok: false, provider: 'arkesel', reason: data.message || `HTTP ${res.status}` }
      }
      return { ok: true, provider: 'arkesel' }
    } catch (error) {
      console.error('[sms] arkesel send crashed', error)
      return { ok: false, provider: 'arkesel', reason: 'arkesel-failed' }
    }
  }

  const provider = (process.env.SMS_PROVIDER ?? 'twilio').toLowerCase()

  if (provider === 'twilio') {
    const sid = process.env.TWILIO_ACCOUNT_SID
    const token = process.env.TWILIO_AUTH_TOKEN
    const from = process.env.TWILIO_PHONE_NUMBER
    if (!sid || !token || !from) {
      return { ok: false, provider, reason: 'twilio-not-configured' }
    }

    try {
      const res = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json', {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: phone,
          From: from,
          Body: input.message,
        }).toString(),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        console.error('[sms] twilio send failed', { status: res.status, body: text.slice(0, 400) })
        return { ok: false, provider, reason: 'twilio-request-failed' }
      }

      return { ok: true, provider }
    } catch (error) {
      console.error('[sms] twilio send crashed', error)
      return { ok: false, provider, reason: 'twilio-failed' }
    }
  }

  if (process.env.SMS_WEBHOOK_URL || process.env.SMS_API_URL) {
    const url = process.env.SMS_WEBHOOK_URL || process.env.SMS_API_URL
    try {
      const res = await fetch(url!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phone, message: input.message }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        console.error('[sms] webhook send failed', { status: res.status, body: text.slice(0, 400) })
        return { ok: false, provider, reason: 'webhook-failed' }
      }
      return { ok: true, provider }
    } catch (error) {
      console.error('[sms] webhook send crashed', error)
      return { ok: false, provider, reason: 'webhook-failed' }
    }
  }

  console.info('[sms] no provider configured; skipping outbound message', {
    phone: phone.slice(0, 8),
    messageLength: input.message.length,
  })
  return { ok: false, provider, reason: 'provider-not-configured' }
}
