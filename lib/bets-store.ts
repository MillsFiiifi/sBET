import { randomInt } from 'crypto'
import type { BetSelection, Match, PlacedBet } from '@/lib/types'
import { supabaseServer } from '@/lib/supabase'

export type { PlacedBet }

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

interface BetRow {
  id: string
  code: string
  user_id: string | null
  placed_at: string
  stake: number
  total_odds: number
  potential_win: number
  status: 'pending' | 'won' | 'lost'
  settled_at: string | null
  payout: number | null
}

interface BetSelectionRow {
  id: string
  bet_id: string
  match_id: string
  home_team: string
  away_team: string
  league: string
  country: string
  market_key: string
  market_label: string
  outcome_key: string
  outcome_label: string
  odds: number
}

function rowToSelection(row: BetSelectionRow): BetSelection {
  const match: Match = {
    id: row.match_id,
    league: row.league,
    country: row.country,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    isLive: false,
    odds: { home: 0, draw: 0, away: 0 },
  }
  return {
    id: row.id,
    matchId: row.match_id,
    match,
    marketKey: row.market_key,
    marketLabel: row.market_label,
    outcomeKey: row.outcome_key,
    outcomeLabel: row.outcome_label,
    odds: Number(row.odds),
    selection: row.market_key === '1x2'
      ? (row.outcome_key as 'home' | 'draw' | 'away')
      : undefined,
  }
}

function rowToBet(row: BetRow, selections: BetSelection[]): PlacedBet {
  return {
    id: row.id,
    code: row.code,
    userId: row.user_id ?? undefined,
    placedAt: row.placed_at,
    stake: Number(row.stake),
    totalOdds: Number(row.total_odds),
    potentialWin: Number(row.potential_win),
    status: row.status,
    selections,
    settledAt: row.settled_at ?? undefined,
    payout: row.payout != null ? Number(row.payout) : undefined,
  }
}

function generateCode(length = 6): string {
  let s = ''
  for (let i = 0; i < length; i++) s += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)]
  return s
}

export async function generateUniqueCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = generateCode()
    const { data, error } = await supabaseServer()
      .from('bets')
      .select('id')
      .eq('code', code)
      .maybeSingle()
    if (error) throw new Error(`bets.generateCode: ${error.message}`)
    if (!data) return code
  }
  return generateCode(8)
}

async function loadSelectionsFor(betIds: string[]): Promise<Map<string, BetSelection[]>> {
  const map = new Map<string, BetSelection[]>()
  if (betIds.length === 0) return map
  const { data, error } = await supabaseServer()
    .from('bet_selections')
    .select('*')
    .in('bet_id', betIds)
  if (error) throw new Error(`bet_selections.load: ${error.message}`)
  for (const row of (data ?? []) as BetSelectionRow[]) {
    const existing = map.get(row.bet_id) ?? []
    existing.push(rowToSelection(row))
    map.set(row.bet_id, existing)
  }
  return map
}

export async function readBets(): Promise<PlacedBet[]> {
  const { data, error } = await supabaseServer()
    .from('bets')
    .select('*')
    .order('placed_at', { ascending: false })
    .limit(200)
  if (error) throw new Error(`bets.readAll: ${error.message}`)
  const rows = (data ?? []) as BetRow[]
  const selectionsByBet = await loadSelectionsFor(rows.map((r) => r.id))
  return rows.map((r) => rowToBet(r, selectionsByBet.get(r.id) ?? []))
}

export async function readBetsForUser(userId: string): Promise<PlacedBet[]> {
  const { data, error } = await supabaseServer()
    .from('bets')
    .select('*')
    .eq('user_id', userId)
    .order('placed_at', { ascending: false })
    .limit(200)
  if (error) throw new Error(`bets.readForUser: ${error.message}`)
  const rows = (data ?? []) as BetRow[]
  const selectionsByBet = await loadSelectionsFor(rows.map((r) => r.id))
  return rows.map((r) => rowToBet(r, selectionsByBet.get(r.id) ?? []))
}

export async function findBetByCode(code: string): Promise<PlacedBet | null> {
  const upper = code.trim().toUpperCase()
  const { data, error } = await supabaseServer()
    .from('bets')
    .select('*')
    .eq('code', upper)
    .maybeSingle()
  if (error) throw new Error(`bets.findByCode: ${error.message}`)
  if (!data) return null
  const selectionsByBet = await loadSelectionsFor([data.id])
  return rowToBet(data as BetRow, selectionsByBet.get(data.id) ?? [])
}

export async function addBet(bet: PlacedBet): Promise<void> {
  const { data, error } = await supabaseServer()
    .from('bets')
    .insert({
      id: bet.id,
      code: bet.code.toUpperCase(),
      user_id: bet.userId ?? null,
      placed_at: bet.placedAt,
      stake: bet.stake,
      total_odds: bet.totalOdds,
      potential_win: bet.potentialWin,
      status: bet.status,
      settled_at: bet.settledAt ?? null,
      payout: bet.payout ?? null,
    })
    .select('id')
    .single()
  if (error) throw new Error(`bets.add: ${error.message}`)
  const betId = data.id

  if (bet.selections.length > 0) {
    const rows = bet.selections.map((s) => ({
      bet_id: betId,
      match_id: s.matchId,
      home_team: s.match.homeTeam,
      away_team: s.match.awayTeam,
      league: s.match.league,
      country: s.match.country,
      market_key: s.marketKey,
      market_label: s.marketLabel,
      outcome_key: s.outcomeKey,
      outcome_label: s.outcomeLabel,
      odds: s.odds,
    }))
    const { error: selErr } = await supabaseServer().from('bet_selections').insert(rows)
    if (selErr) throw new Error(`bet_selections.add: ${selErr.message}`)
  }
}

export async function updateBet(
  id: string,
  patch: Partial<Pick<PlacedBet, 'status' | 'settledAt' | 'payout'>>,
): Promise<PlacedBet | null> {
  const dbPatch: Record<string, unknown> = {}
  if (patch.status !== undefined) dbPatch.status = patch.status
  if (patch.settledAt !== undefined) dbPatch.settled_at = patch.settledAt
  if (patch.payout !== undefined) dbPatch.payout = patch.payout

  if (Object.keys(dbPatch).length === 0) {
    const all = await readBets()
    return all.find((b) => b.id === id) ?? null
  }

  const { data, error } = await supabaseServer()
    .from('bets')
    .update(dbPatch)
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) throw new Error(`bets.update: ${error.message}`)
  if (!data) return null
  const selectionsByBet = await loadSelectionsFor([data.id])
  return rowToBet(data as BetRow, selectionsByBet.get(data.id) ?? [])
}

export async function deleteBet(id: string): Promise<boolean> {
  const { error, count } = await supabaseServer()
    .from('bets')
    .delete({ count: 'exact' })
    .eq('id', id)
  if (error) throw new Error(`bets.delete: ${error.message}`)
  return (count ?? 0) > 0
}
