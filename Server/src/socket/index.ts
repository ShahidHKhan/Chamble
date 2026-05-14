import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { registerHandlers } from "./handlers";

export function registerSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*"
    }
  });

  registerHandlers(io);
  return io;
}
