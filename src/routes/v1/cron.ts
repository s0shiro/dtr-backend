import { Router } from "express";
import { autoClockOut } from "../../controllers/cron.js";

export const cronRouter = Router();

cronRouter.post("/auto-clock-out", autoClockOut);