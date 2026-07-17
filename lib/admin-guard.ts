import { cookies } from 'next/headers'
import { ADMIN_COOKIE, isValidSessionCookie } from '@/lib/admin-auth'

/**
 * True when the current request carries a valid admin session cookie.
 * Middleware guards the /admin *pages*; the /api/admin *routes* call this so a
 * request without a session can't reach the mutating endpoints directly.
 */
export async function isAdminRequest(): Promise<boolean> {
  const store = await cookies()
  const value = store.get(ADMIN_COOKIE)?.value
  return isValidSessionCookie(value)
}
