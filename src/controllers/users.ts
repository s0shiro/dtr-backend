import type { Request, Response } from "express";
import { z } from "zod";

import { ERROR_MESSAGES } from "../constants/errors.js";
import * as usersService from "../services/users.js";

const dailyRatePayloadSchema = z.object({
  dailyRate: z.number().finite().nonnegative().max(1_000_000),
});

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
  if (error instanceof usersService.UsersServiceError) {
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

export async function getMe(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    unauthorizedError(res);
    return;
  }

  try {
    const data = await usersService.getMyProfile(req.user.id);

    res.status(200).json({
      success: true,
      data,
      error: null,
    });
  } catch (error) {
    serviceError(res, error);
  }
}

export async function patchMyDailyRate(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    unauthorizedError(res);
    return;
  }

  const parsedBody = dailyRatePayloadSchema.safeParse(req.body ?? {});

  if (!parsedBody.success) {
    validationError(res, "Invalid daily rate payload");
    return;
  }

  try {
    const data = await usersService.updateDailyRate(req.user.id, parsedBody.data.dailyRate);

    res.status(200).json({
      success: true,
      data,
      error: null,
    });
  } catch (error) {
    serviceError(res, error);
  }
}
