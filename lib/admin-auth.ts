/**
 * Edge-compatible admin session helpers.
 * Both middleware (Edge runtime) and route handlers (Node) call these.
 */

export const ADMIN_COOKIE = 'admin_session'
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12 // 12 hours

/**
 * Derive a session token from the admin password.
 * The token is sha256("powerstakebet:admin:<password>"). Whoever knows the password can
 * derive the same token; storing this in a cookie is sufficient for a single-admin
 * demo gate. Not a substitute for real auth on a multi-user system.
 */
export async function sessionTokenFor(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(`powerstakebet:admin:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Returns the expected token for the configured ADMIN_PASSWORD, or null if no
 * password is configured (admin is disabled).
 */
export async function expectedSessionToken(): Promise<string | null> {
  const pw = process.env.ADMIN_PASSWORD
  if (!pw) return null
  return sessionTokenFor(pw)
}

export async function isValidSessionCookie(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false
  const expected = await expectedSessionToken()
  if (!expected) return false
  // Constant-time-ish comparison: both strings are fixed-length sha256 hex.
  if (cookieValue.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ cookieValue.charCodeAt(i)
  }
  return diff === 0
}
