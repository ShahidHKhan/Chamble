import type { Express } from "express";
import { usersRouter } from "./users";

export function registerRoutes(app: Express) {
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/users", usersRouter);
}
