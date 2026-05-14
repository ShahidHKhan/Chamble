import { RoomState } from "./types";

const rooms = new Map<string, RoomState>();

export function createRoom(code: string) {
  const state: RoomState = {
    code,
    players: [],
    createdAt: Date.now()
  };
  rooms.set(code, state);
  return state;
}

export function getRoom(code: string) {
  return rooms.get(code) ?? null;
}

export function removeRoom(code: string) {
  rooms.delete(code);
}
