import { NextResponse } from 'next/server'
import {
  addSubAdmin,
  findSubAdminByEmail,
  generateUniqueReferralCode,
} from '@/lib/sub-admins-store'
import { hashPassword } from '@/lib/password'
import {
  SUB_ADMIN_COOKIE,
  SUB_ADMIN_COOKIE_MAX_AGE,
  signSubAdminSession,
} from '@/lib/sub-admin-auth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: { name?: string; email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const name = (body.name ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: 'name, email, and password are required' },
      { status: 400 },
    )
  }
  if (!email.includes('@')) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: 'password must be at least 6 characters' },
      { status: 400 },
    )
  }

  const existing = await findSubAdminByEmail(email)
  if (existing) {
    return NextResponse.json(
      { error: 'a sub-admin with that email already exists' },
      { status: 409 },
    )
  }

  const passwordHash = hashPassword(password)
  const referralCode = await generateUniqueReferralCode()

  const sa = await addSubAdmin({
    name,
    email,
    passwordHash,
    referralCode,
    approved: true,
  })

  const token = await signSubAdminSession(sa.id, sa.passwordHash)
  const res = NextResponse.json(
    {
      subAdmin: {
        id: sa.id,
        name: sa.name,
        email: sa.email,
        referralCode: sa.referralCode,
        approved: sa.approved,
      },
    },
    { status: 201 },
  )
  res.cookies.set(SUB_ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SUB_ADMIN_COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  })
  return res
}
