// packages/shared/src/types/user.types.ts
//
// This replaces the User interface in apps/web/src/context/AuthContext.tsx.
// Now both the server (models, controllers) and client (services, context)
// import the same definition — they can't drift out of sync.
 
export interface User {
  id: string
  username: string
  displayName: string
  email: string
  elo: number
  wins: number
  losses: number
  draws: number
  role: 'admin' | 'user'
  createdAt?: string
  lastDailyClaimAt?: string | null
}

// What the DB row looks like (snake_case). Only used inside models.
// Exported so the model's fromRow/toRow helpers can reference it,
// but controllers and services never touch this.
export interface UserRow {
  id: string
  username: string
  display_name: string
  email: string
  elo: number
  wins: number
  losses: number
  draws: number
  role: string
  created_at: string
  last_daily_claim: string | null
}
 