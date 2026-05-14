import type { Request, Response } from "express";
import type { DataEnvelope } from "../types";

export function getProfile(req: Request, res: Response) {
  const user = req.user ?? null;

  const response: DataEnvelope<typeof user> = {
    isSuccess: true,
    data: user
  };

  res.json(response);
}
