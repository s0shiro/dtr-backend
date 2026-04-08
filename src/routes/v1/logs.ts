import { Router } from "express";

import {
	adjustLogTime,
	clockIn,
	clockOut,
	createManualLog,
	deleteLog,
	listLogs,
} from "../../controllers/logs.js";
import { verifySession } from "../../middleware/auth.js";

export const logsRouter = Router();

logsRouter.use(verifySession);

logsRouter.get("/", listLogs);
logsRouter.post("/clock-in", clockIn);
logsRouter.post("/clock-out", clockOut);
logsRouter.post("/manual", createManualLog);
logsRouter.delete("/:id", deleteLog);
logsRouter.patch("/:id", adjustLogTime);