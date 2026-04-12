import { Router } from "express";

import { postGeofenceEntry, syncHolidaysInternal } from "../../controllers/automation.js";
import { verifySession } from "../../middleware/auth.js";
import { userApiRateLimiter } from "../../middleware/rate-limit.js";

export const automationRouter = Router();

automationRouter.post("/internal/holidays/sync", syncHolidaysInternal);
automationRouter.post("/geofence-entry", verifySession, userApiRateLimiter, postGeofenceEntry);
