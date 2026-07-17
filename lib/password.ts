import { createHash, randomBytes, timingSafeEqual } from 'crypto'

/**
 * Demo-grade password hashing. Format: scrypt-like with salt.
 * For a real system, switch to argon2 or bcrypt — but those need an extra package.
 * This uses Node's crypto only.
 */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = createHash('sha256').update(`${salt}:${password}`).digest('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expected] = stored.split(':')
  if (!salt || !expected) return false
  const actual = createHash('sha256').update(`${salt}:${password}`).digest('hex')
  // constant-time compare
  const a = Buffer.from(actual, 'hex')
  const b = Buffer.from(expected, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
