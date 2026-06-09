// Run once to register the three test accounts in Supabase Auth + public users table.
// Usage: npx tsx src/seed.ts  (from apps/server)
//
// Handles three cases:
//   1. Both auth + public row exist → skip
//   2. Public row exists but no auth entry → create auth user with the same UUID
//   3. Neither exists → create both

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './lib/database.types'

const ACCOUNTS = [
  { username: 'demo',   displayName: 'Demo User',  email: 'demo@chamble.test',   password: 'demo123',   elo: 1200, wins: 14,  losses: 18, draws: 3  },
  { username: 'magnus', displayName: 'Magnus C.',  email: 'magnus@chamble.test', password: 'magnus123', elo: 2847, wins: 312, losses: 44, draws: 89 },
  { username: 'hikaru', displayName: 'Hikaru N.',  email: 'hikaru@chamble.test', password: 'hikaru123', elo: 2789, wins: 289, losses: 61, draws: 72 },
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
    // Check if the public users row exists
    const { data: profile } = await db
      .from('users')
      .select('id')
      .ilike('username', account.username)
      .maybeSingle()

    if (profile) {
      // Public row exists — check if the auth entry also exists
      const { data: authData } = await db.auth.admin.getUserById(profile.id)

      if (authData.user) {
        console.log(`✓ ${account.username} already fully set up — skipped`)
        continue
      }

      // Auth entry missing — create it using the same UUID so the IDs stay in sync
      const { error: authError } = await db.auth.admin.createUser({
        id:            profile.id,
        email:         account.email,
        password:      account.password,
        email_confirm: true,
      })

      if (authError) {
        console.error(`✗ ${account.username}: auth creation failed —`, authError.message)
        continue
      }

      console.log(`✓ ${account.username} auth entry created  (${account.email} / ${account.password})`)
      continue
    }

    // Neither exists — create auth user first, then the public row with the same UUID
    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email:         account.email,
      password:      account.password,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      console.error(`✗ ${account.username}: auth creation failed —`, authError?.message)
      continue
    }

    const { error: dbError } = await db.from('users').insert({
      id:           authData.user.id,
      username:     account.username,
      display_name: account.displayName,
      elo:          account.elo,
      wins:         account.wins,
      losses:       account.losses,
      draws:        account.draws,
      role:         'user',
    })

    if (dbError) {
      await db.auth.admin.deleteUser(authData.user.id)
      console.error(`✗ ${account.username}: db insert failed —`, dbError.message)
      continue
    }

    console.log(`✓ ${account.username} created  (${account.email} / ${account.password})`)
  }

  console.log('\nDone.')
}

seed()
