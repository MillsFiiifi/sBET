import { NextResponse } from 'next/server'
import { countUnread, listNotifications, markRead } from '@/lib/notifications-store'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

/** This player's notifications, newest first, plus the unread badge count. */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'user id required' }, { status: 400 })

  const url = new URL(request.url)
  // The header polls for the badge and doesn't need the bodies.
  if (url.searchParams.get('countOnly') === '1') {
    try {
      return NextResponse.json({ unread: await countUnread(id) })
    } catch (e) {
      console.error('[notifications] count failed:', e)
      return NextResponse.json({ unread: 0 })
    }
  }

  try {
    const items = await listNotifications(id)
    return NextResponse.json({
      notifications: items,
      unread: items.filter((n) => !n.readAt).length,
    })
  } catch (e) {
    console.error('[notifications] list failed:', e)
    return NextResponse.json({ error: 'could not load notifications' }, { status: 500 })
  }
}

/** Mark one read (`{ id }`), or all of them when the body is empty. */
export async function POST(request: Request, { params }: Params) {
  const { id: userId } = await params
  if (!userId) return NextResponse.json({ error: 'user id required' }, { status: 400 })

  let body: { id?: string } = {}
  try {
    body = (await request.json()) as { id?: string }
  } catch {
    // Empty body means "all", which is what the notifications page sends.
  }

  try {
    const updated = await markRead(userId, body.id)
    return NextResponse.json({ updated })
  } catch (e) {
    console.error('[notifications] markRead failed:', e)
    return NextResponse.json({ error: 'could not update' }, { status: 500 })
  }
}
