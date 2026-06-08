import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

let client: ReturnType<typeof createClient<Database>> | null = null

export function getSupabase() {
  if (!client) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY

    if (!url || !key) {
      throw new Error(
        'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in server .env'
      )
    }

    client = createClient<Database>(url, key)
  }

  return client
}