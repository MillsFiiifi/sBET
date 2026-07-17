import { NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-guard'
import { clearCommissionBalance, deleteSubAdmin, updateSubAdmin } from '@/lib/sub-admins-store'
import { isCurrencyCode } from '@/lib/countries'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/sub-admins/:id
 *   { action: 'approve', approved: boolean }        → enable/disable the code
 *   { action: 'mark-paid', currency: 'GHS' | ... }  → zero that balance
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params
  let body: { action?: string; approved?: boolean; currency?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  if (body.action === 'approve') {
    const sub = await updateSubAdmin(id, { approved: !!body.approved })
    if (!sub) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'mark-paid') {
    if (!isCurrencyCode(body.currency)) {
      return NextResponse.json({ error: 'valid currency required' }, { status: 400 })
    }
    const sub = await clearCommissionBalance(id, body.currency)
    if (!sub) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "action must be 'approve' or 'mark-paid'" }, { status: 400 })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const ok = await deleteSubAdmin(id)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
