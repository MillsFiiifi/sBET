import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ADMIN_COOKIE, isValidSessionCookie } from '@/lib/admin-auth'
import { SUB_ADMIN_COOKIE, parseSubAdminCookie } from '@/lib/sub-admin-auth'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isAdminPage = pathname.startsWith('/admin')
  const isAdminApi = pathname.startsWith('/api/admin')
  const isSubAdminGuarded =
    pathname.startsWith('/sub-admin/dashboard') ||
    pathname === '/api/sub-admin/me'

  if (!isAdminPage && !isAdminApi && !isSubAdminGuarded) return NextResponse.next()

  // === Sub-admin gate ===
  if (isSubAdminGuarded) {
    const value = request.cookies.get(SUB_ADMIN_COOKIE)?.value
    const parsed = parseSubAdminCookie(value)
    if (parsed) return NextResponse.next()
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/sub-admin/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // === Main admin gate ===
  if (pathname === '/admin/login') return NextResponse.next()
  if (pathname.startsWith('/api/admin/login') || pathname.startsWith('/api/admin/logout')) {
    return NextResponse.next()
  }

  if (!process.env.ADMIN_PASSWORD) {
    if (isAdminApi) {
      return NextResponse.json({ error: 'admin disabled' }, { status: 503 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    url.searchParams.set('disabled', '1')
    return NextResponse.redirect(url)
  }

  const cookie = request.cookies.get(ADMIN_COOKIE)?.value
  const ok = await isValidSessionCookie(cookie)
  if (ok) return NextResponse.next()

  if (isAdminApi) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  const url = request.nextUrl.clone()
  url.pathname = '/admin/login'
  url.searchParams.set('next', pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/sub-admin/dashboard/:path*',
    '/api/sub-admin/me',
    '/api/sub-admin/wallet',
    '/api/sub-admin/withdraw',
  ],
}
