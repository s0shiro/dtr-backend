import { Router } from "express";

import {
  createDailyNote,
  deleteDailyNote,
  getDailyNote,
  getDailyNotes,
  updateDailyNote,
} from "../../controllers/daily-notes.js";
import { verifySession } from "../../middleware/auth.js";
import { userApiRateLimiter } from "../../middleware/rate-limit.js";

export const dailyNotesRouter = Router();

dailyNotesRouter.use(verifySession);
dailyNotesRouter.use(userApiRateLimiter);

dailyNotesRouter.get("/", getDailyNotes);
dailyNotesRouter.get("/:id", getDailyNote);
dailyNotesRouter.post("/", createDailyNote);
dailyNotesRouter.patch("/:id", updateDailyNote);
dailyNotesRouter.delete("/:id", deleteDailyNote);
