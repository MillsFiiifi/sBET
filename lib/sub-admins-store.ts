import { randomInt } from 'crypto'
import type { SubAdmin } from '@/lib/types'
import { supabaseServer } from '@/lib/supabase'

interface SubAdminRow {
  id: string
  name: string
  email: string
  password_hash: string
  referral_code: string
  approved: boolean
  commission_balance: number
  total_commission_earned: number
  created_at: string
}

const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function rowToSubAdmin(row: SubAdminRow): SubAdmin {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    referralCode: row.referral_code,
    approved: row.approved,
    createdAt: row.created_at,
    commissionBalance: Number(row.commission_balance),
    totalCommissionEarned: Number(row.total_commission_earned),
  }
}

export async function readSubAdmins(): Promise<SubAdmin[]> {
  const { data, error } = await supabaseServer()
    .from('sub_admins')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(`subAdmins.readAll: ${error.message}`)
  return (data ?? []).map(rowToSubAdmin)
}

function generateReferralCode(length = 6): string {
  let s = ''
  for (let i = 0; i < length; i++) s += REF_ALPHABET[randomInt(0, REF_ALPHABET.length)]
  return s
}

export async function generateUniqueReferralCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = generateReferralCode()
    const { data, error } = await supabaseServer()
      .from('sub_admins')
      .select('id')
      .eq('referral_code', code)
      .maybeSingle()
    if (error) throw new Error(`subAdmins.generateCode: ${error.message}`)
    if (!data) return code
  }
  return generateReferralCode(8)
}

export async function findSubAdminByEmail(email: string): Promise<SubAdmin | null> {
  const { data, error } = await supabaseServer()
    .from('sub_admins')
    .select('*')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle()
  if (error) throw new Error(`subAdmins.findByEmail: ${error.message}`)
  return data ? rowToSubAdmin(data) : null
}

export async function findSubAdminById(id: string): Promise<SubAdmin | null> {
  const { data, error } = await supabaseServer()
    .from('sub_admins')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`subAdmins.findById: ${error.message}`)
  return data ? rowToSubAdmin(data) : null
}

export async function findSubAdminByReferralCode(
  code: string,
): Promise<SubAdmin | null> {
  const { data, error } = await supabaseServer()
    .from('sub_admins')
    .select('*')
    .eq('referral_code', code.trim().toUpperCase())
    .maybeSingle()
  if (error) throw new Error(`subAdmins.findByCode: ${error.message}`)
  return data ? rowToSubAdmin(data) : null
}

export async function addSubAdmin(
  input: Omit<
    SubAdmin,
    'id' | 'createdAt' | 'commissionBalance' | 'totalCommissionEarned'
  >,
): Promise<SubAdmin> {
  const { data, error } = await supabaseServer()
    .from('sub_admins')
    .insert({
      name: input.name,
      email: input.email.trim().toLowerCase(),
      password_hash: input.passwordHash,
      referral_code: input.referralCode.toUpperCase(),
      approved: input.approved ?? false,
    })
    .select('*')
    .single()
  if (error) throw new Error(`subAdmins.add: ${error.message}`)
  return rowToSubAdmin(data)
}

export async function updateSubAdmin(
  id: string,
  patch: Partial<SubAdmin>,
): Promise<SubAdmin | null> {
  const dbPatch: Record<string, unknown> = {}
  if (patch.name !== undefined) dbPatch.name = patch.name
  if (patch.email !== undefined) dbPatch.email = patch.email.trim().toLowerCase()
  if (patch.passwordHash !== undefined) dbPatch.password_hash = patch.passwordHash
  if (patch.referralCode !== undefined)
    dbPatch.referral_code = patch.referralCode.toUpperCase()
  if (patch.approved !== undefined) dbPatch.approved = patch.approved
  if (patch.commissionBalance !== undefined)
    dbPatch.commission_balance = patch.commissionBalance
  if (patch.totalCommissionEarned !== undefined)
    dbPatch.total_commission_earned = patch.totalCommissionEarned

  if (Object.keys(dbPatch).length === 0) {
    return findSubAdminById(id)
  }

  const { data, error } = await supabaseServer()
    .from('sub_admins')
    .update(dbPatch)
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) throw new Error(`subAdmins.update: ${error.message}`)
  return data ? rowToSubAdmin(data) : null
}

export async function creditCommission(
  id: string,
  amount: number,
): Promise<SubAdmin | null> {
  const current = await findSubAdminById(id)
  if (!current) return null
  return updateSubAdmin(id, {
    commissionBalance: +(current.commissionBalance + amount).toFixed(2),
    totalCommissionEarned: +(current.totalCommissionEarned + amount).toFixed(2),
  })
}

export async function deleteSubAdmin(id: string): Promise<boolean> {
  const { error, count } = await supabaseServer()
    .from('sub_admins')
    .delete({ count: 'exact' })
    .eq('id', id)
  if (error) throw new Error(`subAdmins.delete: ${error.message}`)
  return (count ?? 0) > 0
}
