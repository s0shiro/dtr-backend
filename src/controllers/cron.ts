import type { Request, Response } from "express";
import { env } from "../config/db.js";
import { executeAutoClockOut } from "../services/cron.js";

export async function autoClockOut(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return res.status(401).json({ success: false, data: null, error: "Unauthorized" });
  }
  
  await executeAutoClockOut();
  res.status(200).json({ success: true, data: { message: "Auto clock-out executed" }, error: null });
}