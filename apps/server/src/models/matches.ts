// apps/server/src/models/matches.ts
//
// ── What this file does ──────────────────────────────────────────────────────
// Handles all database operations for the "matches" table.
// A match record is created when a game ends (win, loss, or draw).
// The ProfilePage reads these to show "Recent Matches".
//
// This replaces the static matches.json that ProfilePage currently imports.
// Instead of:   import matchesData from '../data/matches.json'
// The client:   calls the matches service → hits the controller → calls this model
//
// ── Supabase table this file expects ─────────────────────────────────────────
//
//   CREATE TABLE matches (
//     id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//     user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
//     opponent_name TEXT NOT NULL,
//     result        TEXT NOT NULL CHECK (result IN ('win', 'loss', 'draw')),
//     color         TEXT NOT NULL,
//     moves         INTEGER NOT NULL DEFAULT 0,
//     game_variant  TEXT NOT NULL DEFAULT 'chess21',
//     played_at     TIMESTAMPTZ DEFAULT now()
//   );
//
//   -- Index for the most common query: "get matches for user X, newest first"
//   CREATE INDEX idx_matches_user_date ON matches (user_id, played_at DESC);
//
// ─────────────────────────────────────────────────────────────────────────────

import { getSupabase } from '../lib/supabase'
import type { TablesInsert } from '../lib/database.types'
import type { MatchRecord, MatchRow, PagingRequest } from '@chess/shared'

const TABLE = 'matches'

// ── Row conversion ───────────────────────────────────────────────────────────

function fromRow(row: MatchRow): MatchRecord {
  return {
    id:           row.id,
    userId:       row.user_id,
    opponentName: row.opponent_name,
    result:       row.result as MatchRecord['result'],
    color:        row.color,
    moves:        row.moves,
    gameVariant:  row.game_variant as MatchRecord['gameVariant'],
    playedAt:     row.played_at,
  }
}

function toRow(
  match: Omit<MatchRecord, 'id' | 'playedAt'>
): TablesInsert<'matches'> {
  return {
    user_id:       match.userId,
    opponent_name: match.opponentName,
    result:        match.result,
    color:         match.color,
    moves:         match.moves,
    game_variant:  match.gameVariant,
    // played_at uses the DB default (now()) so we don't set it
  }
}

// ── Queries ──────────────────────────────────────────────────────────────────

// Get all matches for a specific user, newest first.
// This is the primary query — it powers the ProfilePage match history.
export async function getByUserId(
  userId: string,
  params: PagingRequest = {}
): Promise<{ list: MatchRecord[]; count: number }> {
  const db = getSupabase()

  let query = db
    .from(TABLE)
    .select('*', { count: 'estimated' })
    .eq('user_id', userId)

  // Search — filter by opponent name
  if (params.search) {
    query = query.ilike('opponent_name', `%${params.search}%`)
  }

  // Sort — default to newest first
  if (params.sortBy) {
    const column = camelToSnake(params.sortBy)
    query = query.order(column, { ascending: !params.descending })
  } else {
    query = query.order('played_at', { ascending: false })
  }

  // Pagination
  const page     = params.page     ?? 1
  const pageSize = params.pageSize ?? 20
  const start    = (page - 1) * pageSize
  query = query.range(start, start + pageSize - 1)

  const { data, error, count } = await query
  if (error) throw error

  return {
    list:  (data ?? []).map(row => fromRow(row as MatchRow)),
    count: count ?? 0,
  }
}

// Get all matches across all users (admin dashboard, leaderboards, etc.)
export async function getAll(
  params: PagingRequest = {}
): Promise<{ list: MatchRecord[]; count: number }> {
  const db = getSupabase()

  let query = db.from(TABLE).select('*', { count: 'estimated' })

  if (params.search) {
    query = query.ilike('opponent_name', `%${params.search}%`)
  }

  query = query.order('played_at', { ascending: false })

  const page     = params.page     ?? 1
  const pageSize = params.pageSize ?? 20
  const start    = (page - 1) * pageSize
  query = query.range(start, start + pageSize - 1)

  const { data, error, count } = await query
  if (error) throw error

  return {
    list:  (data ?? []).map(row => fromRow(row as MatchRow)),
    count: count ?? 0,
  }
}

export async function getById(id: string): Promise<MatchRecord> {
  const db = getSupabase()
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return fromRow(data as MatchRow)
}

// Called when a game ends. Creates one match record for one player.
// A completed game produces TWO calls:
//   create({ userId: white.id, result: 'win',  opponentName: 'Black' ... })
//   create({ userId: black.id, result: 'loss', opponentName: 'White' ... })
//
// Each player gets their own row with their own perspective (win vs loss).
export async function create(
  input: Omit<MatchRecord, 'id' | 'playedAt'>
): Promise<MatchRecord> {
  const db = getSupabase()
  const { data, error } = await db
    .from(TABLE)
    .insert(toRow(input))
    .select('*')
    .single()

  if (error) throw error
  return fromRow(data as MatchRow)
}

export async function remove(id: string): Promise<MatchRecord> {
  const existing = await getById(id)
  const db = getSupabase()
  const { error } = await db.from(TABLE).delete().eq('id', id)
  if (error) throw error
  return existing
}

// ── Aggregate helpers ────────────────────────────────────────────────────────
// Useful for stats that the ProfilePage might want beyond the raw list.

export async function getStats(userId: string): Promise<{
  totalGames: number
  winRate: number
  byVariant: Record<string, { wins: number; losses: number; draws: number }>
}> {
  const db = getSupabase()
  const { data, error } = await db
    .from(TABLE)
    .select('result, game_variant')
    .eq('user_id', userId)

  if (error) throw error

  const rows = data ?? []
  const total = rows.length
  const wins  = rows.filter(r => r.result === 'win').length

  // Group by game variant
  const byVariant: Record<string, { wins: number; losses: number; draws: number }> = {}
  for (const row of rows) {
    const v = row.game_variant
    if (!byVariant[v]) byVariant[v] = { wins: 0, losses: 0, draws: 0 }
    if (row.result === 'win')  byVariant[v].wins++
    if (row.result === 'loss') byVariant[v].losses++
    if (row.result === 'draw') byVariant[v].draws++
  }

  return {
    totalGames: total,
    winRate:    total > 0 ? Math.round((wins / total) * 100) : 0,
    byVariant,
  }
}

// ── Utility ──────────────────────────────────────────────────────────────────

function camelToSnake(str: string): string {
  return str.replace(/([A-Z])/g, m => `_${m.toLowerCase()}`)
}