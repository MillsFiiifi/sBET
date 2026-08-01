import { NextResponse } from 'next/server'
import { updateCustomMatch, deleteCustomMatch } from '@/lib/custom-matches-store'
import type { Match } from '@/lib/domain-types'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  let body: Partial<Match>
  try {
    body = (await request.json()) as Partial<Match>
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const updated = await updateCustomMatch(id, body)
  if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ match: updated })
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const ok = await deleteCustomMatch(id)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
