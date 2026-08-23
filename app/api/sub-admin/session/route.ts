import { NextResponse } from 'next/server'
import { currentSubAdmin } from '@/lib/sub-admin-session'

export const dynamic = 'force-dynamic'

/**
 * "Is whoever is browsing also a partner?"
 *
 * The main site's header needs this to decide whether to show a way through to
 * the partner dashboard, and it cannot work it out on its own: the sub-admin
 * session cookie is httpOnly, so client JS cannot see it.
 *
 * Deliberately tiny, because the header is on every page. For an ordinary
 * player there is no cookie to parse, so currentSubAdmin() returns before it
 * touches the database — the common case costs nothing.
 *
 * Not in the proxy matcher on purpose: it has to answer `false` for everyone
 * else rather than redirect them to a login page.
 */
export async function GET() {
  const sa = await currentSubAdmin()
  if (!sa) return NextResponse.json({ isSubAdmin: false })

  return NextResponse.json({
    isSubAdmin: true,
    name: sa.name,
    approved: sa.approved,
  })
}
