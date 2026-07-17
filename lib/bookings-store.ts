import { randomInt } from 'crypto'
import { supabaseServer } from '@/lib/supabase'

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export interface Booking {
  id: string
  code: string
  matchIds: string[]
  createdAt: string
  expiresAt?: string
}

interface Row {
  id: string
  code: string
  match_ids: unknown
  created_at: string
  expires_at: string | null
}

function rowToBooking(r: Row): Booking {
  const ids = Array.isArray(r.match_ids)
    ? (r.match_ids as unknown[]).filter((x): x is string => typeof x === 'string')
    : []
  return {
    id: r.id,
    code: r.code,
    matchIds: ids,
    createdAt: r.created_at,
    expiresAt: r.expires_at ?? undefined,
  }
}

function generateCode(length = 6): string {
  let s = ''
  for (let i = 0; i < length; i++) s += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)]
  return s
}

async function generateUniqueCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = generateCode()
    const { data, error } = await supabaseServer()
      .from('bookings')
      .select('id')
      .eq('code', code)
      .maybeSingle()
    if (error) throw new Error(`bookings.generateCode: ${error.message}`)
    if (!data) return code
  }
  return generateCode(8)
}

export async function createBooking(matchIds: string[]): Promise<Booking> {
  const code = await generateUniqueCode()
  const { data, error } = await supabaseServer()
    .from('bookings')
    .insert({ code, match_ids: matchIds })
    .select('*')
    .single()
  if (error) throw new Error(`bookings.create: ${error.message}`)
  return rowToBooking(data as Row)
}

export async function findBookingByCode(code: string): Promise<Booking | null> {
  const upper = code.trim().toUpperCase()
  if (!upper) return null
  const { data, error } = await supabaseServer()
    .from('bookings')
    .select('*')
    .eq('code', upper)
    .maybeSingle()
  if (error) throw new Error(`bookings.findByCode: ${error.message}`)
  return data ? rowToBooking(data as Row) : null
}
