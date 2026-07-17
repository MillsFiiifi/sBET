import { NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-guard'
import { deletePromotion, updatePromotion, type PromotionStatus } from '@/lib/promotions-store'

export const dynamic = 'force-dynamic'

const STATUSES: PromotionStatus[] = ['active', 'available', 'claimed']

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const status =
    body.status !== undefined && STATUSES.includes(body.status as PromotionStatus)
      ? (body.status as PromotionStatus)
      : undefined
  const promotion = await updatePromotion(id, {
    title: body.title === undefined ? undefined : String(body.title),
    description: body.description === undefined ? undefined : String(body.description),
    bonus: body.bonus === undefined ? undefined : String(body.bonus),
    percentage: body.percentage === undefined ? undefined : String(body.percentage),
    requirements: body.requirements === undefined ? undefined : String(body.requirements),
    expiresIn: body.expiresIn === undefined ? undefined : String(body.expiresIn),
    status,
    badge: body.badge === undefined ? undefined : String(body.badge),
    sortOrder: body.sortOrder === undefined ? undefined : Number(body.sortOrder),
    active: body.active === undefined ? undefined : !!body.active,
  })
  if (!promotion) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ promotion })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const ok = await deletePromotion(id)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
