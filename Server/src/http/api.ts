import { Router } from "express";
import { getFriends } from "../controllers/friendsController";
import { listMockAccounts, mockLogin } from "../controllers/authController";
import { getProfile } from "../controllers/profileController";
import { requireAuth } from "../middleware/auth";

export const apiRouter = Router();

apiRouter.post("/auth/mock-login", mockLogin);
apiRouter.get("/auth/mock-accounts", listMockAccounts);
apiRouter.get("/profile", requireAuth(), getProfile);
apiRouter.get("/friends", requireAuth(), getFriends);
