import type { Request, Response } from "express";
import { z } from "zod";

import { env } from "../config/db.js";
import { ERROR_MESSAGES } from "../constants/errors.js";
import { syncPublicHolidaysByYear } from "../services/holidays.js";
import { hasN8nGeofenceWebhook, triggerGeofenceReminder } from "../services/n8n.js";
import { validateInternalSecret } from "../utils/internal-secret.js";
import { logSecurityEvent } from "../utils/security-log.js";

const internalHolidaySyncSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  includeNextYear: z.coerce.boolean().optional().default(true),
});

const geofenceEntrySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive().optional(),
  distanceMeters: z.number().nonnegative().nullable().optional(),
  enteredAt: z.string().datetime().optional(),
});

function invalidResponse(res: Response, message: string) {
  return res.status(400).json({
    success: false,
    data: null,
    error: message,
  });
}

function unauthorizedResponse(res: Response) {
  return res.status(401).json({
    success: false,
    data: null,
    error: "Unauthorized",
  });
}

function ensureInternalSecret(req: Request): boolean {
  const validationResult = validateInternalSecret(req);

  if (validationResult.valid) {
    return true;
  }

  logSecurityEvent("internal_secret_auth_failure", {
    req,
    userId: req.user?.id,
    context: {
      reason: validationResult.reason,
    },
  });

  return false;
}

export async function syncHolidaysInternal(req: Request, res: Response): Promise<void> {
  if (!ensureInternalSecret(req)) {
    unauthorizedResponse(res);
    return;
  }

  const parsed = internalHolidaySyncSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    invalidResponse(res, "Invalid holiday sync payload");
    return;
  }

  try {
    const year = parsed.data.year ?? new Date().getUTCFullYear();
    const yearsToSync = parsed.data.includeNextYear ? [year, year + 1] : [year];

    await Promise.all(yearsToSync.map((targetYear) => syncPublicHolidaysByYear(targetYear)));

    res.status(200).json({
      success: true,
      data: {
        yearsSynced: yearsToSync,
      },
      error: null,
    });
  } catch {
    res.status(500).json({
      success: false,
      data: null,
      error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
}

export async function postGeofenceEntry(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    unauthorizedResponse(res);
    return;
  }

  const parsed = geofenceEntrySchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    invalidResponse(res, "Invalid geofence entry payload");
    return;
  }

  if (!hasN8nGeofenceWebhook()) {
    res.status(202).json({
      success: true,
      data: {
        queued: false,
        reason: "n8n geofence webhook is not configured",
      },
      error: null,
    });
    return;
  }

  try {
    await triggerGeofenceReminder({
      userId: req.user.id,
      userEmail: req.user.email,
      enteredAt: parsed.data.enteredAt ?? new Date().toISOString(),
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      accuracy: parsed.data.accuracy ?? null,
      distanceMeters: parsed.data.distanceMeters ?? null,
      radiusMeters: env.OFFICE_RADIUS_METERS,
    });

    res.status(202).json({
      success: true,
      data: {
        queued: true,
      },
      error: null,
    });
  } catch {
    res.status(502).json({
      success: false,
      data: null,
      error: "Failed to queue reminder webhook.",
    });
  }
}
