import { RoomPlayer, RoomState } from "./types";

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

export function addPlayerToRoom(code: string, player: RoomPlayer) {
  const room = rooms.get(code);
  if (!room) {
    return null;
  }

  const existingIndex = room.players.findIndex((entry) => entry.id === player.id);
  if (existingIndex >= 0) {
    room.players[existingIndex] = player;
  } else {
    room.players.push(player);
  }

  return room;
}

export function removePlayerFromRoom(code: string, socketId: string) {
  const room = rooms.get(code);
  if (!room) {
    return null;
  }

  room.players = room.players.filter((player) => player.socketId !== socketId);
  return room;
}

export function getRoomPlayers(code: string) {
  return rooms.get(code)?.players ?? [];
}
