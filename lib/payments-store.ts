import { supabaseServer } from '@/lib/supabase'

export type PaymentType = 'deposit' | 'withdrawal'
export type PaymentStatus = 'pending' | 'success' | 'failed' | 'cancelled'

export interface PaymentRecord {
  id: string
  userId: string | null
  reference: string
  amount: number
  currency: string
  provider: string
  status: PaymentStatus
  type: PaymentType
  metadata: Record<string, unknown>
  createdAt: string
  verifiedAt: string | null
}

interface PaymentRow {
  id: string
  user_id: string | null
  reference: string
  amount: string | number
  currency: string
  provider: string
  status: PaymentStatus
  metadata: Record<string, unknown> | null
  created_at: string
  verified_at: string | null
}

function rowToRecord(row: PaymentRow): PaymentRecord {
  const meta = row.metadata ?? {}
  const rawType = typeof meta.type === 'string' ? meta.type : 'deposit'
  const type: PaymentType = rawType === 'withdrawal' ? 'withdrawal' : 'deposit'
  return {
    id: row.id,
    userId: row.user_id,
    reference: row.reference,
    amount: Number(row.amount),
    currency: row.currency,
    provider: row.provider,
    status: row.status,
    type,
    metadata: meta,
    createdAt: row.created_at,
    verifiedAt: row.verified_at,
  }
}

export interface RecordPaymentInput {
  userId: string
  reference: string
  amount: number
  type: PaymentType
  status?: PaymentStatus
  provider?: string
  currency?: string
  metadata?: Record<string, unknown>
  verifiedAt?: string | null
}

/**
 * Insert a payment row. Idempotent on `reference` — if the same reference is
 * submitted twice we silently ignore the duplicate and return the existing row,
 * so callers don't have to wrap this in their own try/catch for double-credit.
 */
export async function recordPayment(input: RecordPaymentInput): Promise<PaymentRecord | null> {
  const supabase = supabaseServer()
  const metadata = { ...(input.metadata ?? {}), type: input.type }
  const row = {
    user_id: input.userId,
    reference: input.reference,
    amount: input.amount,
    currency: input.currency ?? 'GHS',
    provider: input.provider ?? 'paystack',
    status: input.status ?? 'success',
    metadata,
    verified_at: input.verifiedAt ?? new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('payments')
    .insert(row)
    .select('*')
    .single()

  if (error) {
    // 23505 = unique_violation on `reference` — return the existing row.
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('payments')
        .select('*')
        .eq('reference', input.reference)
        .maybeSingle()
      return existing ? rowToRecord(existing as PaymentRow) : null
    }
    throw new Error(`payments.record: ${error.message}`)
  }
  return rowToRecord(data as PaymentRow)
}

export async function listPaymentsForUser(userId: string): Promise<PaymentRecord[]> {
  const { data, error } = await supabaseServer()
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`payments.listForUser: ${error.message}`)
  return ((data ?? []) as PaymentRow[]).map(rowToRecord)
}

/**
 * Admin list — every payment row, newest first. Filter by type client-side
 * (the JSONB->>'type' filter isn't typed in supabase-js without escapes, so we
 * just fetch and filter since this table stays small in the demo deployment).
 */
export async function listAllPayments(opts?: {
  type?: PaymentType
  limit?: number
}): Promise<PaymentRecord[]> {
  const { data, error } = await supabaseServer()
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 500)
  if (error) throw new Error(`payments.listAll: ${error.message}`)
  const all = ((data ?? []) as PaymentRow[]).map(rowToRecord)
  return opts?.type ? all.filter((p) => p.type === opts.type) : all
}
