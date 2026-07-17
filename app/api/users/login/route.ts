import { NextResponse } from 'next/server'
import { findUserByEmail, findUserByPhoneLocal } from '@/lib/users-store'
import { verifyPassword } from '@/lib/password'

export const dynamic = 'force-dynamic'

// Country dial codes we support (longest-first so 3-digit codes are matched
// before the 2-/1-digit ones that could be a prefix).
const DIAL_CODES = ['233', '234', '254', '256', '255', '237', '260', '225', '250', '27', '44', '1']

/**
 * Reduce any phone the user might type — "0244123456", "244123456",
 * "+233244123456", "233 244 123 456", "+2348012345678" — to its national
 * significant number (country code + trunk "0" removed). Country-agnostic so
 * players from every supported market can log in with their number.
 */
function toLocalDigits(raw: string): string | null {
  let d = raw.replace(/\D/g, '')
  if (d.length < 7) return null
  for (const dial of DIAL_CODES) {
    const rest = d.length - dial.length
    if (d.startsWith(dial) && rest >= 7 && rest <= 11) {
      d = d.slice(dial.length)
      break
    }
  }
  d = d.replace(/^0+/, '')
  return d.length >= 7 && d.length <= 11 ? d : null
}

function looksLikePhone(s: string): boolean {
  // Cheap discriminator: phones are all-digits (or start with +). Emails
  // always contain '@'. We fall back to email lookup if phone lookup misses.
  return /^[+\d\s-]+$/.test(s)
}

export async function POST(request: Request) {
  let body: { email?: string; identifier?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  // Back-compat: existing client still sends `email`. Newer client sends
  // `identifier` (which may be either an email or a phone number).
  const raw = (body.identifier ?? body.email ?? '').trim()
  const password = body.password ?? ''

  if (!raw || !password) {
    return NextResponse.json(
      { error: 'email or phone and password are required' },
      { status: 400 },
    )
  }

  let user = null
  if (looksLikePhone(raw)) {
    const local = toLocalDigits(raw)
    if (local) user = await findUserByPhoneLocal(local)
  }
  if (!user) {
    user = await findUserByEmail(raw.toLowerCase())
  }

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json(
      { error: 'invalid email/phone or password' },
      { status: 401 },
    )
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      totalDeposited: user.totalDeposited,
    },
  })
}
