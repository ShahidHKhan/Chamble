import { getSupabase } from '../lib/supabase'
import type { TablesInsert, TablesUpdate } from '../lib/database.types'
import type { User, UserRow, PagingRequest } from '@chess/shared'

const TABLE = 'users'

// ── Row conversion ───────────────────────────────────────────────────────────

function fromRow(row: UserRow): User {
  return {
    id:                row.id,
    username:          row.username,
    displayName:       row.display_name,
    email:             row.email,
    elo:               row.elo,
    wins:              row.wins,
    losses:            row.losses,
    draws:             row.draws,
    role:              row.role as User['role'],
    createdAt:         row.created_at,
    lastDailyClaimAt:  row.last_daily_claim,
  }
}

function toInsertRow(user: Omit<User, 'id' | 'createdAt'>, passwordHash?: string): TablesInsert<'users'> {
  return {
    username:      user.username,
    display_name:  user.displayName,
    email:         user.email,
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
  if (user.email       !== undefined) row.email        = user.email
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

  let query = db.from(TABLE).select('*', { count: 'estimated' })

  if (params.search) {
    query = query.or(
      `username.ilike.%${params.search}%,display_name.ilike.%${params.search}%`
    )
  }

  if (params.sortBy) {
    const column = camelToSnake(params.sortBy)
    query = query.order(column, { ascending: !params.descending })
  } else {
    query = query.order('elo', { ascending: false })
  }

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

export async function getByEmail(email: string): Promise<User | null> {
  const db = getSupabase()
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .ilike('email', email)
    .maybeSingle()

  if (error) throw error
  return data ? fromRow(data as UserRow) : null
}

// Accepts either a username or an email address.
export async function getByUsernameOrEmail(identifier: string): Promise<User | null> {
  const isEmail = identifier.includes('@')
  return isEmail ? getByEmail(identifier) : getByUsername(identifier)
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

export async function claimDailyReward(id: string): Promise<{ user: User; alreadyClaimed: boolean }> {
  const user = await getById(id)

  const now = new Date()
  if (user.lastDailyClaimAt) {
    const lastClaim = new Date(user.lastDailyClaimAt)
    const sameDay =
      lastClaim.getUTCFullYear() === now.getUTCFullYear() &&
      lastClaim.getUTCMonth()    === now.getUTCMonth()    &&
      lastClaim.getUTCDate()     === now.getUTCDate()
    if (sameDay) return { user, alreadyClaimed: true }
  }

  const db = getSupabase()
  const { data, error } = await db
    .from(TABLE)
    .update({ elo: user.elo + 200, last_daily_claim: now.toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return { user: fromRow(data as UserRow), alreadyClaimed: false }
}

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
    elo:    Math.max(0, user.elo + eloDelta),
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
