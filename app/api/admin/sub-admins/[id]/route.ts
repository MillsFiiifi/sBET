import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, isValidSessionCookie } from '@/lib/admin-auth'
import { deleteSubAdmin, updateSubAdmin } from '@/lib/sub-admins-store'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

async function requireAdmin(): Promise<NextResponse | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value
  if (!(await isValidSessionCookie(token))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return null
}

export async function PATCH(request: Request, { params }: Params) {
  const denied = await requireAdmin()
  if (denied) return denied
  const { id } = await params
  let body: { approved?: boolean; clearCommissionBalance?: boolean }
  try {
    body = (await request.json()) as {
      approved?: boolean
      clearCommissionBalance?: boolean
    }
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const patch: { approved?: boolean; commissionBalance?: number } = {}
  if (typeof body.approved === 'boolean') patch.approved = body.approved
  // Clears the unpaid balance to 0 once the admin has paid the sub-admin
  // out-of-band. totalCommissionEarned stays intact so the lifetime ledger
  // is preserved.
  if (body.clearCommissionBalance === true) patch.commissionBalance = 0

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no valid fields to update' }, { status: 400 })
  }

  const updated = await updateSubAdmin(id, patch)
  if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({
    subAdmin: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      approved: updated.approved,
      commissionBalance: updated.commissionBalance,
      totalCommissionEarned: updated.totalCommissionEarned,
    },
  })
}

export async function DELETE(_req: Request, { params }: Params) {
  const denied = await requireAdmin()
  if (denied) return denied
  const { id } = await params
  const ok = await deleteSubAdmin(id)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
