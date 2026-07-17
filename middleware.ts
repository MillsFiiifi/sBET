import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ADMIN_COOKIE, isValidSessionCookie } from '@/lib/admin-auth'
import { SUB_ADMIN_COOKIE, parseSubAdminCookie } from '@/lib/sub-admin-auth'

/**
 * Gate the /admin dashboard and the /sub-admin/dashboard. The API routes verify
 * the session cookie server-side, but the pages rendered nothing to stop an
 * unauthenticated visitor from loading the shell — redirect them to login.
 *
 * Runs on the Edge runtime. Admin validation is full (HMAC); sub-admin can only
 * be parse-checked here (full validation needs a DB lookup), and the dashboard
 * itself re-validates via /api/sub-admin/me and redirects on 401.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Sub-admin dashboard ──
  if (pathname.startsWith('/sub-admin/dashboard')) {
    const cookie = request.cookies.get(SUB_ADMIN_COOKIE)?.value
    if (parseSubAdminCookie(cookie)) return NextResponse.next()
    const url = request.nextUrl.clone()
    url.pathname = '/sub-admin/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // ── Admin ──
  if (pathname === '/admin/login') {
    return NextResponse.next()
  }
  const cookie = request.cookies.get(ADMIN_COOKIE)?.value
  if (await isValidSessionCookie(cookie)) {
    return NextResponse.next()
  }
  const url = request.nextUrl.clone()
  url.pathname = '/admin/login'
  url.searchParams.set('next', pathname)
  return NextResponse.redirect(url)
}

export const config = {
  // Guard the admin + sub-admin dashboard pages (not /api/* — those self-verify).
  matcher: ['/admin', '/admin/:path*', '/sub-admin/dashboard', '/sub-admin/dashboard/:path*'],
}
