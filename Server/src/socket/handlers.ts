import type { Server } from "socket.io";
import { createRoom, getRoom } from "../rooms/roomManager";
import type { ClientToServerEvents, ServerToClientEvents } from "../shared/protocol";

export function registerHandlers(io: Server<ClientToServerEvents, ServerToClientEvents>) {
  io.on("connection", (socket) => {
    socket.on("create-room", (payload, ack) => {
      const existing = getRoom(payload.code);
      const room = existing ?? createRoom(payload.code);
      socket.join(room.code);
      ack?.({ ok: true, roomCode: room.code });
    });

    socket.on("join-room", (payload, ack) => {
      const room = getRoom(payload.code);
      if (!room) {
        ack?.({ ok: false, error: "Room not found" });
        return;
      }
      socket.join(room.code);
      ack?.({ ok: true, roomCode: room.code });
    });
  });
}
