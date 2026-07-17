/**
 * Edge-compatible sub-admin session helpers.
 *
 * The session cookie stores "<subAdminId>:<sig>" where sig is
 * sha256(`primebet:sub-admin:<id>:<passwordHash>`). To validate, we load the
 * sub-admin record and recompute. Changing a sub-admin's password invalidates
 * any existing sessions for them, which is the behaviour we want.
 */

export const SUB_ADMIN_COOKIE = 'sub_admin_session'
export const SUB_ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12 // 12 hours

export async function signSubAdminSession(
  subAdminId: string,
  passwordHash: string,
): Promise<string> {
  const bytes = new TextEncoder().encode(
    `primebet:sub-admin:${subAdminId}:${passwordHash}`,
  )
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const sig = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `${subAdminId}:${sig}`
}

export function parseSubAdminCookie(
  cookieValue: string | undefined,
): { id: string; sig: string } | null {
  if (!cookieValue) return null
  const colon = cookieValue.indexOf(':')
  if (colon < 1) return null
  const id = cookieValue.slice(0, colon)
  const sig = cookieValue.slice(colon + 1)
  if (!id || sig.length !== 64) return null
  return { id, sig }
}

export async function isValidSubAdminCookie(
  cookieValue: string | undefined,
  expectedPasswordHash: string,
): Promise<boolean> {
  const parsed = parseSubAdminCookie(cookieValue)
  if (!parsed) return false
  const expected = await signSubAdminSession(parsed.id, expectedPasswordHash)
  if (expected.length !== cookieValue!.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ cookieValue!.charCodeAt(i)
  }
  return diff === 0
}
