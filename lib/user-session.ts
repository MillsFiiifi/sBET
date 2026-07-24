export const USER_ID_KEY = 'powerstakebet_user_id'
export const USER_NAME_KEY = 'powerstakebet_user_name'

export function saveUserSession(id: string, name?: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(USER_ID_KEY, id)
  if (name) localStorage.setItem(USER_NAME_KEY, name)
}

export function clearUserSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(USER_ID_KEY)
  localStorage.removeItem(USER_NAME_KEY)
}

export function getUserId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(USER_ID_KEY)
}

export function getUserName(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(USER_NAME_KEY)
}
