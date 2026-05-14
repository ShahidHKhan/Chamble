import express from "express";
import cors from "cors";
import { createServer } from "http";
import { registerRoutes } from "./http/routes";
import { registerSocket } from "./socket";

const app = express();
app.use(cors());
app.use(express.json());

registerRoutes(app);

const httpServer = createServer(app);
registerSocket(httpServer);

const port = Number(process.env.PORT ?? 3001);
httpServer.listen(port, () => {
  console.log(`Chamble server listening on ${port}`);
});
