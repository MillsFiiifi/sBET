import { cookies } from 'next/headers'
import { SUB_ADMIN_COOKIE, isValidSubAdminCookie, parseSubAdminCookie } from '@/lib/sub-admin-auth'
import { findSubAdminById } from '@/lib/sub-admins-store'
import type { SubAdmin } from '@/lib/domain-types'

export async function currentSubAdmin(): Promise<SubAdmin | null> {
  const jar = await cookies()
  const value = jar.get(SUB_ADMIN_COOKIE)?.value
  const parsed = parseSubAdminCookie(value)
  if (!parsed) return null
  const sa = await findSubAdminById(parsed.id)
  if (!sa) return null
  const ok = await isValidSubAdminCookie(value, sa.passwordHash)
  if (!ok) return null
  return sa
}
