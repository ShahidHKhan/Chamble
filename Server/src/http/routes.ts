import type { Express } from "express";
import { apiRouter } from "./api";
import { usersRouter } from "./users";

export function registerRoutes(app: Express) {
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/v1", apiRouter);
  app.use("/users", usersRouter);
}
