import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";

import { auth } from "../config/auth.js";

export async function verifySession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sessionResult = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!sessionResult?.user || !sessionResult.session) {
      res.status(401).json({
        success: false,
        data: null,
        error: "Unauthorized",
      });
      return;
    }

    req.user = {
      id: sessionResult.user.id,
      email: sessionResult.user.email,
      user: sessionResult.user,
      session: sessionResult.session,
    };

    next();
  } catch {
    res.status(401).json({
      success: false,
      data: null,
      error: "Unauthorized",
    });
  }
}
