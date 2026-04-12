import { Router } from "express";

import {
  getMe,
  getMyDailyMotivation,
  getMyLatestReleaseNotes,
  getMyOfficeConfig,
  patchMyDailyRate,
  patchMySettings,
} from "../../controllers/users.js";
import { verifySession } from "../../middleware/auth.js";
import { userApiRateLimiter } from "../../middleware/rate-limit.js";

export const usersRouter = Router();

usersRouter.use(verifySession);
usersRouter.use(userApiRateLimiter);

usersRouter.get("/me", getMe);
usersRouter.get("/me/office-config", getMyOfficeConfig);
usersRouter.get("/me/release-notes/latest", getMyLatestReleaseNotes);
usersRouter.get("/me/motivation/daily", getMyDailyMotivation);
usersRouter.patch("/me/daily-rate", patchMyDailyRate);
usersRouter.patch("/me/settings", patchMySettings);
