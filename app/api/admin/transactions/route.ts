import { NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-guard'
import { readAllTransactions, readPendingTransactions } from '@/lib/transactions-store'
import { findUserById } from '@/lib/users-store'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const scope = new URL(request.url).searchParams.get('scope')
  const txs = scope === 'all' ? await readAllTransactions() : await readPendingTransactions()

  // Attach the player's name/email for display (small N — pending list).
  const userIds = Array.from(new Set(txs.map((t) => t.userId).filter(Boolean))) as string[]
  const users = await Promise.all(userIds.map((id) => findUserById(id)))
  const byId = new Map(users.filter(Boolean).map((u) => [u!.id, u!]))

  const enriched = txs.map((t) => ({
    ...t,
    userName: t.userId ? byId.get(t.userId)?.name ?? null : null,
    userEmail: t.userId ? byId.get(t.userId)?.email ?? null : null,
  }))
  return NextResponse.json({ transactions: enriched })
}
