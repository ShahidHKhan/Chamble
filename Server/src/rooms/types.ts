export type PlayerColor = "white" | "black";

export type RoomPlayer = {
  id: string;
  socketId: string;
  displayName: string;
  color: PlayerColor;
};

export type RoomState = {
  code: string;
  players: RoomPlayer[];
  chess: import("chess.js").Chess;
  fen: string;
  turn: PlayerColor;
  phase: "CHESS" | "BLACKJACK" | "GAME_OVER";
  lastMove?: {
    from: string;
    to: string;
    san: string;
    capture: boolean;
  };
  moveHistory: string[];
  createdAt: number;
};
