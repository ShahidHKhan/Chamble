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

export type RoomAck = {
  ok: boolean;
  roomCode?: RoomCode;
  error?: string;
};

export type ClientToServerEvents = {
  "create-room": (payload: CreateRoomPayload, ack?: (response: RoomAck) => void) => void;
  "join-room": (payload: JoinRoomPayload, ack?: (response: RoomAck) => void) => void;
  "make-move": (payload: { roomCode: RoomCode; move: string }) => void;
  "blackjack-hit": (payload: { roomCode: RoomCode }) => void;
  "blackjack-stand": (payload: { roomCode: RoomCode }) => void;
};

export type ServerToClientEvents = {
  "room-created": (payload: { roomCode: RoomCode }) => void;
  "room-joined": (payload: { roomCode: RoomCode }) => void;
  "room-presence": (payload: { roomCode: RoomCode; players: RoomPresencePlayer[] }) => void;
  "state-updated": (payload: { roomCode: RoomCode }) => void;
  "blackjack-start": (payload: { roomCode: RoomCode }) => void;
};
