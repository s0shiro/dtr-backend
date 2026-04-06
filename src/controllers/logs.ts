import type { Request, Response } from "express";
import { z } from "zod";

import { ERROR_MESSAGES } from "../constants/errors.js";
import * as logsService from "../services/logs.js";

const clockPayloadSchema = z.object({
  note: z.string().trim().min(1).max(255).optional(),
});

const logIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const adjustLogPayloadSchema = z.object({
  target: z.enum(["clockIn", "clockOut"]),
  // New format: absolute ISO timestamp
  targetTime: z.string().min(1).optional(),
  // Legacy format: relative minutes delta
  minutesDelta: z.number().int().optional(),
}).refine(
  (d) => d.targetTime !== undefined || d.minutesDelta !== undefined,
  { message: "Either targetTime or minutesDelta must be provided" },
);

function normalizeClockPayload(input: z.infer<typeof clockPayloadSchema>) {
  if (input.note === undefined) {
    return {};
  }

  return { note: input.note };
}

function validationError(res: Response, message: string) {
  return res.status(400).json({
    success: false,
    data: null,
    error: message,
  });
}

function unauthorizedError(res: Response) {
  return res.status(401).json({
    success: false,
    data: null,
    error: "Unauthorized",
  });
}

function serviceError(res: Response, error: unknown) {
  if (error instanceof logsService.LogsServiceError) {
    return res.status(error.statusCode).json({
      success: false,
      data: null,
      error: error.message,
    });
  }

  return res.status(500).json({
    success: false,
    data: null,
    error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
  });
}

export async function listLogs(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    unauthorizedError(res);
    return;
  }

  try {
    const month = typeof req.query["month"] === "string" ? req.query["month"] : undefined;
    const data = await logsService.listLogs(req.user.id, month);

    res.status(200).json({
      success: true,
      data,
      error: null,
    });
  } catch (error) {
    serviceError(res, error);
  }
}

export async function clockIn(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    unauthorizedError(res);
    return;
  }

  const parsedBody = clockPayloadSchema.safeParse(req.body ?? {});

  if (!parsedBody.success) {
    validationError(res, "Invalid clock-in payload");
    return;
  }

  try {
    const data = await logsService.clockIn(
      req.user.id,
      normalizeClockPayload(parsedBody.data),
    );

    res.status(201).json({
      success: true,
      data,
      error: null,
    });
  } catch (error) {
    serviceError(res, error);
  }
}

export async function clockOut(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    unauthorizedError(res);
    return;
  }

  const parsedBody = clockPayloadSchema.safeParse(req.body ?? {});

  if (!parsedBody.success) {
    validationError(res, "Invalid clock-out payload");
    return;
  }

  try {
    const data = await logsService.clockOut(
      req.user.id,
      normalizeClockPayload(parsedBody.data),
    );

    res.status(200).json({
      success: true,
      data,
      error: null,
    });
  } catch (error) {
    serviceError(res, error);
  }
}

export async function deleteLog(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    unauthorizedError(res);
    return;
  }

  const parsedParams = logIdParamsSchema.safeParse(req.params);

  if (!parsedParams.success) {
    validationError(res, "Invalid log id");
    return;
  }

  try {
    const data = await logsService.deleteLog(parsedParams.data.id, req.user.id);

    res.status(200).json({
      success: true,
      data,
      error: null,
    });
  } catch (error) {
    serviceError(res, error);
  }
}

export async function adjustLogTime(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    unauthorizedError(res);
    return;
  }

  const parsedParams = logIdParamsSchema.safeParse(req.params);

  if (!parsedParams.success) {
    validationError(res, "Invalid log id");
    return;
  }

  const parsedBody = adjustLogPayloadSchema.safeParse(req.body ?? {});

  if (!parsedBody.success) {
    validationError(res, "Invalid adjust payload");
    return;
  }

  try {
    const adjustPayload: logsService.AdjustLogPayload = { target: parsedBody.data.target };
    if (parsedBody.data.targetTime !== undefined) {
      adjustPayload.targetTime = parsedBody.data.targetTime;
    }
    if (parsedBody.data.minutesDelta !== undefined) {
      adjustPayload.minutesDelta = parsedBody.data.minutesDelta;
    }

    const data = await logsService.adjustLogTime(
      parsedParams.data.id,
      req.user.id,
      adjustPayload,
    );

    res.status(200).json({
      success: true,
      data,
      error: null,
    });
  } catch (error) {
    serviceError(res, error);
  }
}