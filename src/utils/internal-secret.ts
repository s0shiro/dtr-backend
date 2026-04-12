import { createHash, timingSafeEqual } from "node:crypto";

import type { Request } from "express";

import { env } from "../config/db.js";

export type InternalSecretFailureReason =
  | "missing_config"
  | "missing_header"
  | "mismatch"
  | "invalid_input";

export interface InternalSecretValidationResult {
  valid: boolean;
  reason?: InternalSecretFailureReason;
}

function toSecretDigest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function isTimingSafeSecretMatch(
  incomingSecret: string,
  configuredSecret: string,
): InternalSecretValidationResult {
  try {
    const isMatch = timingSafeEqual(
      toSecretDigest(incomingSecret),
      toSecretDigest(configuredSecret),
    );

    if (isMatch) {
      return {
        valid: true,
      };
    }

    return {
      valid: false,
      reason: "mismatch",
    };
  } catch {
    return {
      valid: false,
      reason: "invalid_input",
    };
  }
}

export function validateInternalSecret(req: Request): InternalSecretValidationResult {
  const configuredSecret = env.INTERNAL_AUTOMATION_SECRET;

  if (!configuredSecret) {
    return {
      valid: false,
      reason: "missing_config",
    };
  }

  const incomingSecret = req.header("x-internal-secret");

  if (!incomingSecret) {
    return {
      valid: false,
      reason: "missing_header",
    };
  }

  return isTimingSafeSecretMatch(incomingSecret, configuredSecret);
}
