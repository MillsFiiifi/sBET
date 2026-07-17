import { NextResponse } from 'next/server'
import { findSubAdminByEmail } from '@/lib/sub-admins-store'
import { verifyPassword } from '@/lib/password'
import {
  SUB_ADMIN_COOKIE,
  SUB_ADMIN_COOKIE_MAX_AGE,
  signSubAdminSession,
} from '@/lib/sub-admin-auth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: { email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  if (!email || !password) {
    return NextResponse.json({ error: 'email and password required' }, { status: 400 })
  }

  const sa = await findSubAdminByEmail(email)
  if (!sa || !verifyPassword(password, sa.passwordHash)) {
    return NextResponse.json({ error: 'invalid email or password' }, { status: 401 })
  }
  if (!sa.approved) {
    return NextResponse.json(
      { error: 'account pending approval by the main admin' },
      { status: 403 },
    )
  }

  const token = await signSubAdminSession(sa.id, sa.passwordHash)
  const res = NextResponse.json({
    subAdmin: {
      id: sa.id,
      name: sa.name,
      email: sa.email,
      referralCode: sa.referralCode,
      approved: sa.approved,
    },
  })
  res.cookies.set(SUB_ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SUB_ADMIN_COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  })
  return res
}
