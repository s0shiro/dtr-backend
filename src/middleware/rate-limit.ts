import rateLimit from "express-rate-limit";

import { env } from "../config/db.js";
import { logSecurityEvent } from "../utils/security-log.js";

const TOO_MANY_REQUESTS_RESPONSE = {
  success: false,
  data: null,
  error: "Too many requests. Please try again later.",
};

export const authRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
  max: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logSecurityEvent("rate_limit_exceeded", {
      req,
      userId: req.user?.id,
      context: {
        reason: "auth_limiter",
        keyType: req.user?.id ? "user+ip" : "ip",
      },
    });

    res.status(429).json(TOO_MANY_REQUESTS_RESPONSE);
  },
});

export const automationRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_AUTOMATION_WINDOW_MS,
  max: env.RATE_LIMIT_AUTOMATION_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logSecurityEvent("rate_limit_exceeded", {
      req,
      userId: req.user?.id,
      context: {
        reason: "automation_limiter",
        keyType: req.user?.id ? "user+ip" : "ip",
      },
    });

    res.status(429).json(TOO_MANY_REQUESTS_RESPONSE);
  },
});

export const userApiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_USER_WINDOW_MS,
  max: env.RATE_LIMIT_USER_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = req.ip ?? "unknown";

    if (req.user?.id) {
      return `${req.user.id}:${ip}`;
    }

    return ip;
  },
  handler: (req, res) => {
    logSecurityEvent("rate_limit_exceeded", {
      req,
      userId: req.user?.id,
      context: {
        reason: "user_api_limiter",
        keyType: req.user?.id ? "user+ip" : "ip",
      },
    });

    res.status(429).json(TOO_MANY_REQUESTS_RESPONSE);
  },
});
