import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, isValidSessionCookie } from '@/lib/admin-auth'
import { getSettings, setSetting } from '@/lib/settings-store'

export const dynamic = 'force-dynamic'

async function isAdmin(): Promise<boolean> {
  const store = await cookies()
  return isValidSessionCookie(store.get(ADMIN_COOKIE)?.value)
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const s = await getSettings(['deposit_number', 'deposit_name'])
  return NextResponse.json({
    number: s.deposit_number ?? '',
    name: s.deposit_name ?? '',
  })
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { number?: string; name?: string }
  try {
    body = (await request.json()) as { number?: string; name?: string }
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const number = (body.number ?? '').replace(/[\s-]/g, '')
  const name = (body.name ?? '').trim()
  if (!/^\d{9,12}$/.test(number)) {
    return NextResponse.json(
      { error: 'enter a valid mobile-money number (9–12 digits)' },
      { status: 400 },
    )
  }

  try {
    await setSetting('deposit_number', number)
    if (name) await setSetting('deposit_name', name)
  } catch (e) {
    // Most likely the app_settings table hasn't been created yet.
    return NextResponse.json(
      {
        error:
          (e instanceof Error ? e.message : 'failed to save') +
          ' — run migration 0018_app_settings.sql in Supabase.',
      },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, number, name })
}
