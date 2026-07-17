import { supabaseServer } from '@/lib/supabase'
import { DEFAULT_CURRENCY, isCurrencyCode, type CurrencyCode } from '@/lib/countries'

export type TransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'bet_win'
  | 'bet_loss'
  | 'bonus'
  | 'adjustment'
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled'

export interface Transaction {
  id: string
  userId: string | null
  type: TransactionType
  amount: number
  currency: CurrencyCode
  method: string
  status: TransactionStatus
  note?: string
  createdAt: string
  processedAt?: string
}

interface Row {
  id: string
  user_id: string | null
  type: TransactionType
  amount: number
  currency: string | null
  method: string
  status: TransactionStatus
  note: string | null
  created_at: string
  processed_at: string | null
}

function rowToTx(r: Row): Transaction {
  return {
    id: r.id,
    userId: r.user_id,
    type: r.type,
    amount: Number(r.amount),
    currency: isCurrencyCode(r.currency) ? r.currency : DEFAULT_CURRENCY,
    method: r.method ?? '',
    status: r.status,
    note: r.note ?? undefined,
    createdAt: r.created_at,
    processedAt: r.processed_at ?? undefined,
  }
}

export async function readTransactionsForUser(userId: string): Promise<Transaction[]> {
  const { data, error } = await supabaseServer()
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(`transactions.readForUser: ${error.message}`)
  return (data ?? []).map((r) => rowToTx(r as Row))
}

export async function readPendingTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabaseServer()
    .from('transactions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new Error(`transactions.readPending: ${error.message}`)
  return (data ?? []).map((r) => rowToTx(r as Row))
}

export async function readAllTransactions(limit = 200): Promise<Transaction[]> {
  const { data, error } = await supabaseServer()
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`transactions.readAll: ${error.message}`)
  return (data ?? []).map((r) => rowToTx(r as Row))
}

export async function findTransactionById(id: string): Promise<Transaction | null> {
  const { data, error } = await supabaseServer()
    .from('transactions')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`transactions.findById: ${error.message}`)
  return data ? rowToTx(data as Row) : null
}

export interface TransactionInput {
  userId: string
  type: TransactionType
  amount: number
  currency: CurrencyCode
  method?: string
  status?: TransactionStatus
  note?: string
}

export async function addTransaction(input: TransactionInput): Promise<Transaction> {
  const insert = {
    user_id: input.userId,
    type: input.type,
    amount: +input.amount.toFixed(2),
    currency: input.currency,
    method: input.method?.trim() || '',
    status: input.status ?? 'pending',
    note: input.note?.trim() || null,
    processed_at: (input.status ?? 'pending') === 'completed' ? new Date().toISOString() : null,
  }
  const { data, error } = await supabaseServer()
    .from('transactions')
    .insert(insert)
    .select('*')
    .single()
  if (error) throw new Error(`transactions.add: ${error.message}`)
  return rowToTx(data as Row)
}

export async function setTransactionStatus(
  id: string,
  status: TransactionStatus,
): Promise<Transaction | null> {
  const { data, error } = await supabaseServer()
    .from('transactions')
    .update({
      status,
      processed_at: status === 'pending' ? null : new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) throw new Error(`transactions.setStatus: ${error.message}`)
  return data ? rowToTx(data as Row) : null
}
