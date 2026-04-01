import { Router } from "express";

import { getMe, patchMyDailyRate } from "../../controllers/users";
import { verifySession } from "../../middleware/auth";

export const usersRouter = Router();

usersRouter.use(verifySession);

usersRouter.get("/me", getMe);
usersRouter.patch("/me/daily-rate", patchMyDailyRate);
