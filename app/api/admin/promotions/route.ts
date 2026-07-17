import { NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-guard'
import { addPromotion, readPromotions, type PromotionStatus } from '@/lib/promotions-store'

export const dynamic = 'force-dynamic'

const STATUSES: PromotionStatus[] = ['active', 'available', 'claimed']

export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const promotions = await readPromotions(true)
  return NextResponse.json({ promotions })
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const title = String(body.title ?? '').trim()
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }
  const status = STATUSES.includes(body.status as PromotionStatus)
    ? (body.status as PromotionStatus)
    : 'active'
  const promotion = await addPromotion({
    title,
    description: body.description ? String(body.description) : '',
    bonus: body.bonus ? String(body.bonus) : '',
    percentage: body.percentage ? String(body.percentage) : '',
    requirements: body.requirements ? String(body.requirements) : '',
    expiresIn: body.expiresIn ? String(body.expiresIn) : '',
    status,
    badge: body.badge ? String(body.badge) : status.charAt(0).toUpperCase() + status.slice(1),
    sortOrder: body.sortOrder === undefined ? 0 : Number(body.sortOrder),
    active: body.active === undefined ? true : !!body.active,
  })
  return NextResponse.json({ promotion }, { status: 201 })
}
