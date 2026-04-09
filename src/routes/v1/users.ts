import { Router } from "express";

import { getMe, getMyOfficeConfig, patchMyDailyRate, patchMySettings } from "../../controllers/users.js";
import { verifySession } from "../../middleware/auth.js";

export const usersRouter = Router();

usersRouter.use(verifySession);

usersRouter.get("/me", getMe);
usersRouter.get("/me/office-config", getMyOfficeConfig);
usersRouter.patch("/me/daily-rate", patchMyDailyRate);
usersRouter.patch("/me/settings", patchMySettings);
