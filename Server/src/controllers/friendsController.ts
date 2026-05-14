import type { Request, Response } from "express";
import { listMockFriends } from "../models/friendModel";
import type { DataListEnvelope, PagingRequest } from "../types";

export function getFriends(req: Request, res: Response) {
  const query = req.query as PagingRequest;
  const page = Number(query.page ?? 1);
  const pageSize = Number(query.pageSize ?? 10);

  const { data, total } = listMockFriends(page, pageSize);

  const response: DataListEnvelope<typeof data> = {
    isSuccess: true,
    data,
    total
  };

  res.json(response);
}
