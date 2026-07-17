import { NextResponse } from 'next/server'
import { SUB_ADMIN_COOKIE } from '@/lib/sub-admin-auth'

export const dynamic = 'force-dynamic'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SUB_ADMIN_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
