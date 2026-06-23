// Run once to create/update the three test accounts.
// Usage: npx tsx src/seed.ts  (from apps/server)

import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './lib/database.types'

const ACCOUNTS = [
  { username: 'demo',   displayName: 'Demo User',  email: 'demo@chamble.dev',   password: 'demo123',   elo: 1200, wins: 14,  losses: 18, draws: 3  },
  { username: 'magnus', displayName: 'Magnus C.',  email: 'magnus@chamble.dev', password: 'magnus123', elo: 2847, wins: 312, losses: 44, draws: 89 },
  { username: 'hikaru', displayName: 'Hikaru N.',  email: 'hikaru@chamble.dev', password: 'hikaru123', elo: 2789, wins: 289, losses: 61, draws: 72 },
]

async function seed() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY

  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env')
    process.exit(1)
  }

  const db = createClient<Database>(url, key)

  for (const account of ACCOUNTS) {
    const passwordHash = await bcrypt.hash(account.password, 12)

    const { data: existing } = await db
      .from('users')
      .select('id, password_hash')
      .ilike('username', account.username)
      .maybeSingle()

    if (existing) {
      // Update password hash (and stats) for existing row
      await db.from('users').update({
        password_hash: passwordHash,
        email:         account.email,
        elo:           account.elo,
        wins:          account.wins,
        losses:        account.losses,
        draws:         account.draws,
        display_name:  account.displayName,
      }).eq('id', existing.id)
      console.log(`✓ ${account.username} updated`)
    } else {
      // Create new row
      const { error } = await db.from('users').insert({
        username:      account.username,
        display_name:  account.displayName,
        email:         account.email,
        password_hash: passwordHash,
        elo:           account.elo,
        wins:          account.wins,
        losses:        account.losses,
        draws:         account.draws,
        role:          'user',
      })
      if (error) {
        console.error(`✗ ${account.username}: ${error.message}`)
      } else {
        console.log(`✓ ${account.username} created`)
      }
    }
  }

  console.log('\nDone.')
}

seed()
