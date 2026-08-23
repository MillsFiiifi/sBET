// In-app notifications — the one channel that works with nothing configured.
//
// SMS goes through Arkesel and email through Resend, and both are no-ops when
// their keys are missing: the send silently does nothing and the player is
// never told. This channel has no such dependency, and unlike a text it leaves
// a record we own and can show again tomorrow.
//
// Writes are best-effort by design. A notification that fails must never take
// down the payout, credit or bet that triggered it — the money is the point,
// the message is the courtesy.

import { supabaseServer } from '@/lib/supabase'

export type NotificationKind = 'withdrawal' | 'deposit' | 'bet' | 'system'

export interface AppNotification {
  id: string
  userId: string
  kind: NotificationKind
  title: string
  body: string
  metadata: Record<string, unknown>
  readAt: string | null
  createdAt: string
}

interface NotificationRow {
  id: string
  user_id: string
  kind: string
  title: string
  body: string
  metadata: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

const KINDS: NotificationKind[] = ['withdrawal', 'deposit', 'bet', 'system']

function rowToNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    kind: (KINDS as string[]).includes(row.kind) ? (row.kind as NotificationKind) : 'system',
    title: row.title,
    body: row.body,
    metadata: row.metadata ?? {},
    readAt: row.read_at,
    createdAt: row.created_at,
  }
}

/**
 * Write one notification. Never throws — see the note at the top of the file.
 * Returns null when it could not be stored, so callers that care can log it.
 */
export async function notify(input: {
  userId: string | null | undefined
  kind: NotificationKind
  title: string
  body: string
  metadata?: Record<string, unknown>
}): Promise<AppNotification | null> {
  if (!input.userId) return null
  try {
    const { data, error } = await supabaseServer()
      .from('notifications')
      .insert({
        user_id: input.userId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        metadata: input.metadata ?? {},
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return rowToNotification(data as NotificationRow)
  } catch (e) {
    // Loud, because a missing notification is invisible to everyone otherwise —
    // which is the failure mode this whole table exists to fix.
    console.error('[notifications] write failed', {
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      error: e instanceof Error ? e.message : String(e),
    })
    return null
  }
}

export async function listNotifications(
  userId: string,
  limit = 50,
): Promise<AppNotification[]> {
  const { data, error } = await supabaseServer()
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`notifications.list: ${error.message}`)
  return (data ?? []).map((r) => rowToNotification(r as NotificationRow))
}

export async function countUnread(userId: string): Promise<number> {
  const { count, error } = await supabaseServer()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)
  if (error) throw new Error(`notifications.countUnread: ${error.message}`)
  return count ?? 0
}

/** Mark one notification read, or all of them when no id is given. */
export async function markRead(userId: string, id?: string): Promise<number> {
  let q = supabaseServer()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
  if (id) q = q.eq('id', id)
  const { data, error } = await q.select('id')
  if (error) throw new Error(`notifications.markRead: ${error.message}`)
  return (data ?? []).length
}
