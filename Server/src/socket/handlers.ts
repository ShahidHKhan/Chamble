import type { Server } from "socket.io";
import {
  addPlayerToRoom,
  createRoom,
  getRoom,
  getRoomPlayers,
  getRoomSnapshot,
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
      const snapshot = getRoomSnapshot(room.code);
      if (snapshot) {
        io.to(room.code).emit("room-state", snapshot);
      }
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
      const snapshot = getRoomSnapshot(room.code);
      if (snapshot) {
        io.to(room.code).emit("room-state", snapshot);
      }
      ack?.({ ok: true, roomCode: room.code });
    });

    socket.on("make-move", (payload, ack) => {
      const room = getRoom(payload.roomCode);
      if (!room) {
        ack?.({ ok: false, error: "Room not found" });
        return;
      }

      const player = room.players.find((entry) => entry.id === payload.userId);
      if (!player) {
        ack?.({ ok: false, error: "Player not in room" });
        return;
      }

      if (room.turn !== player.color) {
        ack?.({ ok: false, error: "Not your turn" });
        return;
      }

      const move = room.chess.move({
        from: payload.from,
        to: payload.to,
        promotion: payload.promotion
      });

      if (!move) {
        ack?.({ ok: false, error: "Illegal move" });
        return;
      }

      room.fen = room.chess.fen();
      room.turn = room.chess.turn() === "w" ? "white" : "black";
      room.lastMove = {
        from: move.from,
        to: move.to,
        san: move.san,
        capture: Boolean(move.captured)
      };
      room.moveHistory = [...room.moveHistory, move.san];

      const snapshot = getRoomSnapshot(room.code);
      if (snapshot) {
        io.to(room.code).emit("room-state", snapshot);
      }

      ack?.({ ok: true });
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
        const snapshot = getRoomSnapshot(roomCode);
        if (snapshot) {
          io.to(roomCode).emit("room-state", snapshot);
        }
      });
    });
  });
}
