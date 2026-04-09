import { Router } from "express";

import { postGeofenceEntry, syncHolidaysInternal } from "../../controllers/automation.js";
import { verifySession } from "../../middleware/auth.js";

export const automationRouter = Router();

automationRouter.post("/internal/holidays/sync", syncHolidaysInternal);
automationRouter.post("/geofence-entry", verifySession, postGeofenceEntry);
