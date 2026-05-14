import type { Request, Response } from "express";
import { authenticateMockUser, listMockUsers } from "../models/userModel";
import type { DataEnvelope } from "../types";

export function mockLogin(req: Request, res: Response) {
  const userId = (req.body?.userId as string | undefined) ?? undefined;
  const payload = authenticateMockUser(userId);

  const response: DataEnvelope<typeof payload> = {
    isSuccess: true,
    data: payload
  };

  res.json(response);
}

export function listMockAccounts(_req: Request, res: Response) {
  const users = listMockUsers();
  const response: DataEnvelope<typeof users> = {
    isSuccess: true,
    data: users
  };

  res.json(response);
}
