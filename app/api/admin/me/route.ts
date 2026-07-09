import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, isValidSessionCookie } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// Lightweight, read-only "is the caller an admin?" check so client pages can
// conditionally reveal admin-only affordances (e.g. settle buttons). The real
// enforcement still lives on each mutating admin route.
export async function GET() {
  const value = (await cookies()).get(ADMIN_COOKIE)?.value
  const admin = await isValidSessionCookie(value)
  return NextResponse.json({ admin })
}
