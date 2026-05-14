import { io, Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents
} from "../shared/protocol";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket() {
  if (!socket) {
    const url = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";
    socket = io(url, { autoConnect: false });
  }

  return socket;
}

export function connectSocket() {
  const activeSocket = getSocket();
  if (!activeSocket.connected) {
    activeSocket.connect();
  }
  return activeSocket;
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
  }
}
