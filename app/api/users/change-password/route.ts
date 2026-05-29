import { NextResponse } from 'next/server'
import { findUserById, setUserPassword } from '@/lib/users-store'
import { hashPassword, verifyPassword } from '@/lib/password'

export const dynamic = 'force-dynamic'

interface Body {
  userId?: string
  currentPassword?: string
  newPassword?: string
}

export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const userId = (body.userId ?? '').trim()
  const currentPassword = body.currentPassword ?? ''
  const newPassword = body.newPassword ?? ''

  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'new password must be at least 6 characters' }, { status: 400 })
  }
  if (currentPassword === newPassword) {
    return NextResponse.json({ error: 'new password must differ from current' }, { status: 400 })
  }

  const user = await findUserById(userId)
  if (!user) return NextResponse.json({ error: 'user not found' }, { status: 404 })

  if (!verifyPassword(currentPassword, user.passwordHash)) {
    return NextResponse.json({ error: 'current password is incorrect' }, { status: 401 })
  }

  const updated = await setUserPassword(userId, hashPassword(newPassword))
  if (!updated) return NextResponse.json({ error: 'update failed' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
