export interface Player {
  id: string
  username: string
  elo: number
}

export interface GameState {
  gameId: string
  white: Player
  black: Player
  fen: string           // current board position
  moves: string[]       // move history in PGN
  clock: { white: number; black: number }
  status: 'waiting' | 'active' | 'finished'
  result?: 'white' | 'black' | 'draw'
}

export interface Move {
  from: string
  to: string
  promotion?: string
}
