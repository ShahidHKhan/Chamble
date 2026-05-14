import { Router } from "express";

export const usersRouter = Router();

usersRouter.get("/:id", (_req, res) => {
  res.status(501).json({ message: "Not implemented" });
});

usersRouter.post("/", (_req, res) => {
  res.status(501).json({ message: "Not implemented" });
});

usersRouter.patch("/:id", (_req, res) => {
  res.status(501).json({ message: "Not implemented" });
});
