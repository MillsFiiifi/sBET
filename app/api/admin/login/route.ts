import { NextResponse } from 'next/server'
import { ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE, sessionTokenFor } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: 'admin disabled — set ADMIN_PASSWORD in .env.local' },
      { status: 503 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const { password } = body as { password?: string }
  if (typeof password !== 'string' || password.length === 0) {
    return NextResponse.json({ error: 'password required' }, { status: 400 })
  }

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'invalid password' }, { status: 401 })
  }

  const token = await sessionTokenFor(password)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  })
  return res
}
