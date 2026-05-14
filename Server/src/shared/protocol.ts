export type RoomCode = string;

export type CreateRoomPayload = {
  code: RoomCode;
  userId: string;
  displayName: string;
};

export type JoinRoomPayload = {
  code: RoomCode;
  userId: string;
  displayName: string;
};

export type RoomPresencePlayer = {
  id: string;
  displayName: string;
};

export type MovePayload = {
  roomCode: RoomCode;
  userId: string;
  from: string;
  to: string;
  promotion?: string;
};

export type MoveAck = {
  ok: boolean;
  error?: string;
};

export type LastMove = {
  from: string;
  to: string;
  san: string;
  capture: boolean;
};

export type GamePhase = "CHESS" | "BLACKJACK" | "GAME_OVER";

export type RoomStatePayload = {
  roomCode: RoomCode;
  fen: string;
  turn: "white" | "black";
  phase: GamePhase;
  players: RoomPresencePlayer[];
  lastMove?: LastMove;
  moveHistory: string[];
  createdAt: number;
};

export type RoomAck = {
  ok: boolean;
  roomCode?: RoomCode;
  error?: string;
};

export type ClientToServerEvents = {
  "create-room": (payload: CreateRoomPayload, ack?: (response: RoomAck) => void) => void;
  "join-room": (payload: JoinRoomPayload, ack?: (response: RoomAck) => void) => void;
  "make-move": (payload: MovePayload, ack?: (response: MoveAck) => void) => void;
  "blackjack-hit": (payload: { roomCode: RoomCode }) => void;
  "blackjack-stand": (payload: { roomCode: RoomCode }) => void;
};

export type ServerToClientEvents = {
  "room-created": (payload: { roomCode: RoomCode }) => void;
  "room-joined": (payload: { roomCode: RoomCode }) => void;
  "room-presence": (payload: { roomCode: RoomCode; players: RoomPresencePlayer[] }) => void;
  "room-state": (payload: RoomStatePayload) => void;
  "state-updated": (payload: { roomCode: RoomCode }) => void;
  "blackjack-start": (payload: { roomCode: RoomCode }) => void;
};
