import { supabaseServer } from '@/lib/supabase'

export type PromotionStatus = 'active' | 'available' | 'claimed'

export interface Promotion {
  id: string
  title: string
  description: string
  bonus: string
  percentage: string
  requirements: string
  expiresIn: string
  status: PromotionStatus
  badge: string
  sortOrder: number
  active: boolean
  createdAt: string
}

interface Row {
  id: string
  title: string
  description: string
  bonus: string
  percentage: string
  requirements: string
  expires_in: string
  status: PromotionStatus
  badge: string
  sort_order: number
  active: boolean
  created_at: string
}

function rowToPromotion(r: Row): Promotion {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? '',
    bonus: r.bonus ?? '',
    percentage: r.percentage ?? '',
    requirements: r.requirements ?? '',
    expiresIn: r.expires_in ?? '',
    status: r.status ?? 'active',
    badge: r.badge ?? 'Active',
    sortOrder: Number(r.sort_order ?? 0),
    active: !!r.active,
    createdAt: r.created_at,
  }
}

export async function readPromotions(includeInactive = false): Promise<Promotion[]> {
  let q = supabaseServer()
    .from('promotions')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
  if (!includeInactive) q = q.eq('active', true)
  const { data, error } = await q
  if (error) throw new Error(`promotions.readAll: ${error.message}`)
  return (data ?? []).map((r) => rowToPromotion(r as Row))
}

export interface PromotionInput {
  title: string
  description?: string
  bonus?: string
  percentage?: string
  requirements?: string
  expiresIn?: string
  status?: PromotionStatus
  badge?: string
  sortOrder?: number
  active?: boolean
}

export async function addPromotion(input: PromotionInput): Promise<Promotion> {
  const insert = {
    title: input.title.trim(),
    description: input.description?.trim() || '',
    bonus: input.bonus?.trim() || '',
    percentage: input.percentage?.trim() || '',
    requirements: input.requirements?.trim() || '',
    expires_in: input.expiresIn?.trim() || '',
    status: input.status ?? 'active',
    badge: input.badge?.trim() || 'Active',
    sort_order: input.sortOrder ?? 0,
    active: input.active ?? true,
  }
  const { data, error } = await supabaseServer()
    .from('promotions')
    .insert(insert)
    .select('*')
    .single()
  if (error) throw new Error(`promotions.add: ${error.message}`)
  return rowToPromotion(data as Row)
}

export async function updatePromotion(
  id: string,
  patch: Partial<PromotionInput>,
): Promise<Promotion | null> {
  const db: Record<string, unknown> = {}
  if (patch.title !== undefined) db.title = patch.title
  if (patch.description !== undefined) db.description = patch.description
  if (patch.bonus !== undefined) db.bonus = patch.bonus
  if (patch.percentage !== undefined) db.percentage = patch.percentage
  if (patch.requirements !== undefined) db.requirements = patch.requirements
  if (patch.expiresIn !== undefined) db.expires_in = patch.expiresIn
  if (patch.status !== undefined) db.status = patch.status
  if (patch.badge !== undefined) db.badge = patch.badge
  if (patch.sortOrder !== undefined) db.sort_order = patch.sortOrder
  if (patch.active !== undefined) db.active = patch.active

  if (Object.keys(db).length === 0) {
    const all = await readPromotions(true)
    return all.find((p) => p.id === id) ?? null
  }

  const { data, error } = await supabaseServer()
    .from('promotions')
    .update(db)
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) throw new Error(`promotions.update: ${error.message}`)
  return data ? rowToPromotion(data as Row) : null
}

export async function deletePromotion(id: string): Promise<boolean> {
  const { error, count } = await supabaseServer()
    .from('promotions')
    .delete({ count: 'exact' })
    .eq('id', id)
  if (error) throw new Error(`promotions.delete: ${error.message}`)
  return (count ?? 0) > 0
}
