// Tower Rush is hosted on the partner site spinxpress.casino. When a signed-in
// user opens it we append their id (+ name) as query params so the partner can
// identify them and skip a fresh login — IF spinxpress is built to read these
// params. Adjust the param names to match the partner's actual contract.
//
// SECURITY: only pass the public user id / display name here — never a
// password, session secret, or anything sensitive. For verified single
// sign-on you'd send a server-signed token agreed with the partner instead.
export const SPINXPRESS_BASE = 'https://spinxpress.casino'

export function spinxpressHref(userId?: string | null, name?: string | null): string {
  if (!userId) return SPINXPRESS_BASE
  const params = new URLSearchParams({ uid: userId })
  if (name) params.set('name', name)
  return `${SPINXPRESS_BASE}/?${params.toString()}`
}
