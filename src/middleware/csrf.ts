import type { NextFunction, Request, Response } from "express";

import type { AllowedOriginRule } from "../utils/origin-matcher.js";
import { isAllowedOrigin } from "../utils/origin-matcher.js";
import { logSecurityEvent } from "../utils/security-log.js";

const CSRF_PROTECTED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

interface CreateCsrfMiddlewareOptions {
  allowedOriginRules: AllowedOriginRule[];
}

function extractOriginFromReferer(refererHeader: string | undefined): string | null {
  if (!refererHeader) {
    return null;
  }

  try {
    return new URL(refererHeader).origin;
  } catch {
    return null;
  }
}

export function createCsrfMiddleware(options: CreateCsrfMiddlewareOptions) {
  return function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!CSRF_PROTECTED_METHODS.has(req.method.toUpperCase())) {
      next();
      return;
    }

    const isInternalAutomationRoute = req.path.startsWith("/automation/internal/");

    if (isInternalAutomationRoute && Boolean(req.header("x-internal-secret"))) {
      next();
      return;
    }

    if (!req.header("cookie")) {
      next();
      return;
    }

    const originHeader = req.header("origin");
    const refererHeader = req.header("referer");

    const candidateOrigin = originHeader ?? extractOriginFromReferer(refererHeader) ?? undefined;

    if (candidateOrigin && isAllowedOrigin(candidateOrigin, options.allowedOriginRules)) {
      next();
      return;
    }

    logSecurityEvent("csrf_reject", {
      req,
      userId: req.user?.id,
      context: {
        reason: candidateOrigin ? "origin_not_allowed" : "missing_origin_and_referer",
        originPresent: Boolean(originHeader),
        refererPresent: Boolean(refererHeader),
      },
    });

    res.status(403).json({
      success: false,
      data: null,
      error: "Forbidden",
    });
  };
}
