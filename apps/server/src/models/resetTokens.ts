import crypto from 'crypto'
import { getSupabase } from '../lib/supabase'

const TABLE = 'password_reset_tokens'
const EXPIRY_MINUTES = 15

function hashCode(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

// Generates a 6-digit code, stores its hash, returns the raw code to email.
// Any existing unused tokens for the same user are invalidated first.
export async function createToken(userId: string): Promise<string> {
  const code = crypto.randomInt(100_000, 1_000_000).toString()
  const tokenHash = hashCode(code)
  const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1_000).toISOString()

  const db = getSupabase()

  // Invalidate any previous unused tokens for this user
  await db
    .from(TABLE)
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('used_at', null)

  const { error } = await db
    .from(TABLE)
    .insert({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt })

  if (error) throw error
  return code
}

// Validates the raw code: checks expiry and single-use, marks it used.
// Returns the userId on success, null on any failure.
export async function consumeToken(rawCode: string): Promise<string | null> {
  const tokenHash = hashCode(rawCode)
  const db = getSupabase()

  const { data, error } = await db
    .from(TABLE)
    .select('id, user_id, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error || !data) return null
  if (data.used_at) return null
  if (new Date(data.expires_at) < new Date()) return null

  await db
    .from(TABLE)
    .update({ used_at: new Date().toISOString() })
    .eq('id', data.id)

  return data.user_id
}
