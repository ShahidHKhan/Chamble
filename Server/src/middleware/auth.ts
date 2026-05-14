import type { NextFunction, Request, Response } from "express";
import { mockUser } from "../data/mockData";
import { getMockUserById } from "../models/userModel";
import type { UserProfile } from "../types";

declare global {
  namespace Express {
    interface Request {
      user?: UserProfile;
    }
  }
}

export function validateJWT(req: Request, _res: Response, next: NextFunction) {
  const rawAuth = req.headers["authorization"] as string | undefined;
  const token = rawAuth?.replace("Bearer ", "");

  if (!token) {
    return next();
  }

  if (token?.startsWith("mock-token")) {
    const [, userId] = token.split(":");
    req.user = (userId ? getMockUserById(userId) : null) ?? mockUser;
  }

  return next();
}

export function requireAuth() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        data: null,
        isSuccess: false,
        message: "You must log in to access this resource"
      });
    }

    return next();
  };
}
