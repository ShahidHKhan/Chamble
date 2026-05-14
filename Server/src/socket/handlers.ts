import type { Server } from "socket.io";
import {
  addPlayerToRoom,
  createRoom,
  getRoom,
  getRoomPlayers,
  removePlayerFromRoom
} from "../rooms/roomManager";
import type { ClientToServerEvents, ServerToClientEvents } from "../shared/protocol";

export function registerHandlers(io: Server<ClientToServerEvents, ServerToClientEvents>) {
  io.on("connection", (socket) => {
    socket.on("create-room", (payload, ack) => {
      const existing = getRoom(payload.code);
      const room = existing ?? createRoom(payload.code);
      socket.join(room.code);
      addPlayerToRoom(room.code, {
        id: payload.userId,
        displayName: payload.displayName,
        socketId: socket.id,
        color: "white"
      });
      io.to(room.code).emit("room-presence", {
        roomCode: room.code,
        players: getRoomPlayers(room.code).map((player) => ({
          id: player.id,
          displayName: player.displayName
        }))
      });
      ack?.({ ok: true, roomCode: room.code });
    });

    socket.on("join-room", (payload, ack) => {
      const room = getRoom(payload.code);
      if (!room) {
        ack?.({ ok: false, error: "Room not found" });
        return;
      }
      socket.join(room.code);
      addPlayerToRoom(room.code, {
        id: payload.userId,
        displayName: payload.displayName,
        socketId: socket.id,
        color: room.players.length ? "black" : "white"
      });
      io.to(room.code).emit("room-presence", {
        roomCode: room.code,
        players: getRoomPlayers(room.code).map((player) => ({
          id: player.id,
          displayName: player.displayName
        }))
      });
      ack?.({ ok: true, roomCode: room.code });
    });

    socket.on("disconnect", () => {
      const rooms = Array.from(socket.rooms).filter((room) => room !== socket.id);
      rooms.forEach((roomCode) => {
        const room = removePlayerFromRoom(roomCode, socket.id);
        if (!room) {
          return;
        }
        io.to(roomCode).emit("room-presence", {
          roomCode,
          players: getRoomPlayers(roomCode).map((player) => ({
            id: player.id,
            displayName: player.displayName
          }))
        });
      });
    });
  });
}
