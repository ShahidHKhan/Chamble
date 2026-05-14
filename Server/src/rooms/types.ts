export type PlayerColor = "white" | "black";

export type RoomPlayer = {
  id: string;
  color: PlayerColor;
};

export type RoomState = {
  code: string;
  players: RoomPlayer[];
  createdAt: number;
};
