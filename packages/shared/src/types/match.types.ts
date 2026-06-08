// packages/shared/src/types/match.types.ts
//
// These replace the inline Friend and Match interfaces currently
// defined inside ProfilePage.tsx. Same idea as user.types.ts:
// one source of truth shared by client and server.

export type MatchResult = 'win' | 'loss' | 'draw'
export type GameVariant = 'chess21' | 'chessmatics' | 'chessroulette'

export interface MatchRecord {
  id: string
  userId: string
  opponentName: string
  result: MatchResult
  color: string
  moves: number
  gameVariant: GameVariant
  playedAt: string
}

export interface MatchRow {
  id: string
  user_id: string
  opponent_name: string
  result: string
  color: string
  moves: number
  game_variant: string
  played_at: string
}

// ─── Friends ──────────────────────────────────────────────────────────────────

export type FriendshipStatus = 'pending' | 'accepted'

// This is the raw friendship link in the DB.
// "user_id sent a friend request to friend_id"
export interface Friendship {
  id: string
  userId: string
  friendId: string
  status: FriendshipStatus
  createdAt: string
}

export interface FriendshipRow {
  id: string
  user_id: string
  friend_id: string
  status: string
  created_at: string
}

// This is what the client actually renders — a friend's profile
// plus whether they're online. The "online/offline/in-game" status
// comes from Socket.IO presence, NOT the database. The friends model
// returns the profile data; your server can overlay presence later.
export interface FriendProfile {
  id: string
  displayName: string
  elo: number
  status: 'online' | 'offline' | 'in-game'
}