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
    provider: input.provider ?? 'moolre',
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

export async function findPaymentById(id: string): Promise<PaymentRecord | null> {
  const { data, error } = await supabaseServer()
    .from('payments')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`payments.findById: ${error.message}`)
  return data ? rowToRecord(data as PaymentRow) : null
}

export async function findPaymentByReference(
  reference: string,
): Promise<PaymentRecord | null> {
  const { data, error } = await supabaseServer()
    .from('payments')
    .select('*')
    .eq('reference', reference)
    .maybeSingle()
  if (error) throw new Error(`payments.findByReference: ${error.message}`)
  return data ? rowToRecord(data as PaymentRow) : null
}

/**
 * Compare-and-set the status of a pending payment. Returns the updated row
 * only when the row was actually pending — if it was already success/failed
 * (e.g. a concurrent webhook beat us), returns null. This is the lock that
 * protects against double-crediting when Moolre fires both the browser
 * redirect and the server webhook for the same payment.
 */
export async function claimPendingPayment(
  reference: string,
  nextStatus: PaymentStatus,
  metaPatch?: Record<string, unknown>,
): Promise<PaymentRecord | null> {
  const existing = await findPaymentByReference(reference)
  if (!existing || existing.status !== 'pending') return null
  const mergedMeta = { ...existing.metadata, ...(metaPatch ?? {}) }
  const { data, error } = await supabaseServer()
    .from('payments')
    .update({
      status: nextStatus,
      verified_at: new Date().toISOString(),
      metadata: mergedMeta,
    })
    .eq('reference', reference)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle()
  if (error) throw new Error(`payments.claimPending: ${error.message}`)
  return data ? rowToRecord(data as PaymentRow) : null
}

/**
 * Flip a failed/pending payment row to success and stamp who resolved it.
 * Returns the updated record, or null if the row didn't exist.
 */
export async function markPaymentResolved(
  id: string,
  note?: string,
): Promise<PaymentRecord | null> {
  const existing = await findPaymentById(id)
  if (!existing) return null
  const mergedMeta = {
    ...existing.metadata,
    type: existing.type,
    adminResolved: true,
    resolvedAt: new Date().toISOString(),
    resolutionNote: note || undefined,
  }
  const { data, error } = await supabaseServer()
    .from('payments')
    .update({
      status: 'success',
      verified_at: new Date().toISOString(),
      metadata: mergedMeta,
    })
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) throw new Error(`payments.markResolved: ${error.message}`)
  return data ? rowToRecord(data as PaymentRow) : null
}
