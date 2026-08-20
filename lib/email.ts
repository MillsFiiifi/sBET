// Transactional email over Resend's REST API.
//
// Deliberately dependency-free — a plain fetch against api.resend.com rather
// than the SDK, so nothing new lands in the bundle and it runs anywhere a
// Vercel function does.
//
// Env:
//   RESEND_API_KEY  — from resend.com/api-keys. Unset disables email entirely
//                     (every send becomes a no-op, nothing throws).
//   EMAIL_FROM      — verified sender, e.g. "PowerStakeBet <noreply@yourdomain>"

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export interface SendEmailInput {
  to: string
  subject: string
  html: string
  /** Plain-text alternative. Worth setting — it keeps mail out of spam. */
  text?: string
}

export interface SendEmailResult {
  ok: boolean
  id?: string
  skipped?: 'not-configured' | 'no-recipient'
  error?: string
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim())
}

/**
 * Send one transactional email. Never throws — callers are notification paths
 * where a mail failure must not take down the operation that triggered it.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.EMAIL_FROM?.trim()
  if (!apiKey || !from) return { ok: false, skipped: 'not-configured' }

  const to = input.to?.trim()
  if (!to || !to.includes('@')) return { ok: false, skipped: 'no-recipient' }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
      }),
    })
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string }
    if (!res.ok) {
      console.error('[email] send failed', res.status, body.message ?? '')
      return { ok: false, error: body.message ?? `HTTP ${res.status}` }
    }
    return { ok: true, id: body.id }
  } catch (e) {
    console.error('[email] send threw:', e)
    return { ok: false, error: e instanceof Error ? e.message : 'send failed' }
  }
}

/** Shared shell so every transactional mail looks like the same product. */
export function emailShell(params: {
  heading: string
  intro: string
  rows: Array<[string, string]>
  footnote?: string
}): string {
  const rows = params.rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:6px 0;color:#6b7280;font-size:14px;">${escapeHtml(label)}</td>
          <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join('')

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="padding:24px 24px 8px;">
          <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">${escapeHtml(params.heading)}</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#374151;">${escapeHtml(params.intro)}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;">
            ${rows}
          </table>
        </td>
      </tr>
      ${
        params.footnote
          ? `<tr><td style="padding:8px 24px 24px;"><p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">${escapeHtml(params.footnote)}</p></td></tr>`
          : '<tr><td style="padding:0 0 12px;"></td></tr>'
      }
    </table>
  </body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
