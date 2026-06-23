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
