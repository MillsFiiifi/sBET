import { NextResponse } from 'next/server'
import { currentSubAdmin } from '@/lib/sub-admin-session'
import { findSubAdminByUserId } from '@/lib/sub-admins-store'

export const dynamic = 'force-dynamic'

/**
 * "Is whoever is browsing also a partner?"
 *
 * The main site's header needs this to decide whether to show a way through to
 * the partner dashboard, and it cannot work it out on its own: the sub-admin
 * session cookie is httpOnly, so client JS cannot see it.
 *
 * Two ways to answer, and both are needed:
 *
 *   1. The sub-admin cookie. Only present on the device they signed into the
 *      dashboard with, and only for 12 hours.
 *   2. The player session's `userId`, matched against the wallet linked to a
 *      sub-admin. This is the one that matters in practice — a partner betting
 *      on their phone has the player session and no dashboard cookie, so
 *      checking the cookie alone hid the link exactly where they browse most.
 *
 * The second lookup needs the caller to already know the wallet's UUID, which
 * only their own browser does.
 *
 * Kept out of the proxy matcher on purpose: it has to answer `false` for
 * everyone else rather than redirect them to a login page.
 */
export async function GET(request: Request) {
  const sa = await currentSubAdmin()
  if (sa) {
    return NextResponse.json({ isSubAdmin: true, name: sa.name, approved: sa.approved, via: 'cookie' })
  }

  const userId = new URL(request.url).searchParams.get('userId')?.trim()
  if (userId) {
    try {
      const owner = await findSubAdminByUserId(userId)
      if (owner) {
        // No dashboard cookie, so the link will bounce them through
        // /sub-admin/login — which is the correct outcome, not a bug.
        return NextResponse.json({
          isSubAdmin: true,
          name: owner.name,
          approved: owner.approved,
          via: 'wallet',
        })
      }
    } catch (e) {
      console.error('[sub-admin/session] wallet lookup failed:', e)
    }
  }

  return NextResponse.json({ isSubAdmin: false })
}
