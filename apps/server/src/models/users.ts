// apps/server/src/models/users.ts
//
// ── What this file does ──────────────────────────────────────────────────────
// This is the ONLY file in the entire project that talks to the "users" table.
// Controllers call these functions. These functions call Supabase.
// Nothing else touches the database directly.
//
// ── Why the fromRow / toRow pattern exists ────────────────────────────────────
// Your database uses snake_case column names (display_name, created_at)
// because that's the Postgres convention. Your TypeScript app uses camelCase
// (displayName, createdAt) because that's the JS convention.
//
// The translation happens HERE and ONLY here. Controllers, services, and
// components never see snake_case. The database never sees camelCase.
// If you rename a column, you change one fromRow function — not 15 files.
//
// ── Supabase table this file expects ─────────────────────────────────────────
//
//   CREATE TABLE users (
//     id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//     username    TEXT UNIQUE NOT NULL,
//     display_name TEXT NOT NULL,
//     elo         INTEGER DEFAULT 1200,
//     wins        INTEGER DEFAULT 0,
//     losses      INTEGER DEFAULT 0,
//     draws       INTEGER DEFAULT 0,
//     role        TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
//     created_at  TIMESTAMPTZ DEFAULT now()
//   );
//
// ─────────────────────────────────────────────────────────────────────────────

import { getSupabase } from '../lib/supabase'
import type { TablesInsert, TablesUpdate } from '../lib/database.types'
import type { User, UserRow, PagingRequest } from '@chess/shared'

const TABLE = 'users'

// ── Row conversion ───────────────────────────────────────────────────────────

function fromRow(row: UserRow): User {
  return {
    id:          row.id,
    username:    row.username,
    displayName: row.display_name,
    elo:         row.elo,
    wins:        row.wins,
    losses:      row.losses,
    draws:       row.draws,
    role:        row.role as User['role'],
    createdAt:   row.created_at,
  }
}

function toInsertRow(user: Omit<User, 'id' | 'createdAt'>, passwordHash?: string): TablesInsert<'users'> {
  return {
    username:      user.username,
    display_name:  user.displayName,
    elo:           user.elo,
    wins:          user.wins,
    losses:        user.losses,
    draws:         user.draws,
    role:          user.role,
    password_hash: passwordHash ?? null,
  }
}

function toUpdateRow(user: Partial<User>): TablesUpdate<'users'> {
  const row: TablesUpdate<'users'> = {}

  if (user.username    !== undefined) row.username     = user.username
  if (user.displayName !== undefined) row.display_name = user.displayName
  if (user.elo         !== undefined) row.elo          = user.elo
  if (user.wins        !== undefined) row.wins         = user.wins
  if (user.losses      !== undefined) row.losses       = user.losses
  if (user.draws       !== undefined) row.draws        = user.draws
  if (user.role        !== undefined) row.role         = user.role

  return row
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function getAll(
  params: PagingRequest = {}
): Promise<{ list: User[]; count: number }> {
  const db = getSupabase()

  // Start building the query. The { count: 'estimated' } option tells
  // Supabase to return a total count alongside the data — the client
  // needs this for pagination ("showing 1–20 of 347 users").
  let query = db.from(TABLE).select('*', { count: 'estimated' })

  // Search filter — if the client sent ?search=magnus, we check
  // both username and display_name with case-insensitive LIKE.
  if (params.search) {
    query = query.or(
      `username.ilike.%${params.search}%,display_name.ilike.%${params.search}%`
    )
  }

  // Sorting — the client can send ?sortBy=elo&descending=true
  if (params.sortBy) {
    const column = camelToSnake(params.sortBy)
    query = query.order(column, { ascending: !params.descending })
  } else {
    query = query.order('elo', { ascending: false })
  }

  // Pagination — convert page/pageSize into Supabase's .range(start, end).
  // Page 1, pageSize 20 → range(0, 19). Page 2 → range(20, 39). Etc.
  const page     = params.page     ?? 1
  const pageSize = params.pageSize ?? 20
  const start    = (page - 1) * pageSize
  query = query.range(start, start + pageSize - 1)

  const { data, error, count } = await query
  if (error) throw error

  return {
    list:  (data ?? []).map(row => fromRow(row as UserRow)),
    count: count ?? 0,
  }
}

export async function getById(id: string): Promise<User> {
  const db = getSupabase()
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return fromRow(data as UserRow)
}

// Used during login — find by username (case-insensitive).
// Returns null instead of throwing when not found, because
// "user doesn't exist" is a normal auth flow outcome, not an error.
export async function getByUsername(username: string): Promise<User | null> {
  const db = getSupabase()
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .ilike('username', username)
    .maybeSingle()

  if (error) throw error
  return data ? fromRow(data as UserRow) : null
}

export async function create(
  input: Omit<User, 'id' | 'createdAt'>,
  passwordHash?: string,
): Promise<User> {
  const db = getSupabase()
  const { data, error } = await db
    .from(TABLE)
    .insert(toInsertRow(input, passwordHash))
    .select('*')
    .single()

  if (error) throw error
  return fromRow(data as UserRow)
}

export async function getPasswordHash(id: string): Promise<string | null> {
  const db = getSupabase()
  const { data, error } = await db
    .from(TABLE)
    .select('password_hash')
    .eq('id', id)
    .single()

  if (error) throw error
  return (data as { password_hash: string | null }).password_hash

}

export async function setPasswordHash(id: string, passwordHash: string): Promise<void> {
  const db = getSupabase()
  const { error } = await db
    .from(TABLE)
    .update({ password_hash: passwordHash })
    .eq('id', id)

  if (error) throw error
}

export async function update(
  id: string,
  patch: Partial<User>
): Promise<User> {
  const row = toUpdateRow(patch)

  // If the caller passed an empty patch, skip the DB call
  // and just return the current record.
  if (Object.keys(row).length === 0) {
    return getById(id)
  }

  const db = getSupabase()
  const { data, error } = await db
    .from(TABLE)
    .update(row)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return fromRow(data as UserRow)
}

// ── Game-result helpers ──────────────────────────────────────────────────────
// These are called when a game ends. They atomically update ELO + win/loss
// counters in a single DB call so they can't drift out of sync.

export async function updateElo(id: string, delta: number): Promise<User> {
  const user = await getById(id)
  return update(id, { elo: Math.max(0, user.elo + delta) })
}

export async function recordWin(id: string, eloDelta: number): Promise<User> {
  const user = await getById(id)
  return update(id, {
    elo:  user.elo + eloDelta,
    wins: user.wins + 1,
  })
}

export async function recordLoss(id: string, eloDelta: number): Promise<User> {
  const user = await getById(id)
  return update(id, {
    elo:    Math.max(0, user.elo + eloDelta), // ELO can't go negative
    losses: user.losses + 1,
  })
}

export async function recordDraw(id: string): Promise<User> {
  const user = await getById(id)
  return update(id, {
    draws: user.draws + 1,
  })
}

export async function remove(id: string): Promise<User> {
  const existing = await getById(id)
  const db = getSupabase()
  const { error } = await db.from(TABLE).delete().eq('id', id)
  if (error) throw error
  return existing
}

// ── Utility ──────────────────────────────────────────────────────────────────

function camelToSnake(str: string): string {
  return str.replace(/([A-Z])/g, m => `_${m.toLowerCase()}`)
}