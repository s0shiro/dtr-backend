import { Router } from "express";

import { getMe, patchMyDailyRate, patchMySettings } from "../../controllers/users.js";
import { verifySession } from "../../middleware/auth.js";

export const usersRouter = Router();

usersRouter.use(verifySession);

usersRouter.get("/me", getMe);
usersRouter.patch("/me/daily-rate", patchMyDailyRate);
usersRouter.patch("/me/settings", patchMySettings);
