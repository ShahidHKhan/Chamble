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
  createdAt: number;
};
