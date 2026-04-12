import cors from "cors";
import express from "express";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";

import { auth } from "./config/auth.js";
import { env } from "./config/db.js";
import { createCsrfMiddleware } from "./middleware/csrf.js";
import { authRateLimiter, automationRateLimiter } from "./middleware/rate-limit.js";
import { automationRouter } from "./routes/v1/automation.js";
import { dailyNotesRouter } from "./routes/v1/daily-notes.js";
import { logsRouter } from "./routes/v1/logs.js";
import { usersRouter } from "./routes/v1/users.js";
import {
  parseAllowedOriginRule,
  isAllowedOrigin,
} from "./utils/origin-matcher.js";
import { logSecurityEvent } from "./utils/security-log.js";

export const app = express();
app.set("trust proxy", env.TRUST_PROXY);

const allowedOrigins = env.FRONTEND_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

const parsedAllowedOrigins = allowedOrigins.map((origin) => ({
  origin,
  rule: parseAllowedOriginRule(origin),
}));

const invalidAllowedOrigins = parsedAllowedOrigins
  .filter((entry) => entry.rule === null)
  .map((entry) => entry.origin);

if (invalidAllowedOrigins.length > 0) {
  throw new Error(`Invalid FRONTEND_ORIGIN value(s): ${invalidAllowedOrigins.join(", ")}`);
}

const allowedOriginRules = parsedAllowedOrigins
  .map((entry) => entry.rule)
  .filter((rule): rule is NonNullable<typeof rule> => rule !== null);

app.use(helmet());
const corsOptions = {
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "Referer",
    "x-internal-secret",
  ],
  exposedHeaders: ["Set-Cookie"],
  maxAge: 86400,
};

app.use(
  cors((req, callback) => {
    const requestOrigin = req.header("origin");

    if (!requestOrigin) {
      return callback(null, {
        ...corsOptions,
        origin: true,
      });
    }

    if (isAllowedOrigin(requestOrigin, allowedOriginRules)) {
      return callback(null, {
        ...corsOptions,
        origin: true,
      });
    }

    logSecurityEvent("cors_reject", {
      req,
      context: {
        reason: "origin_not_allowed",
        originPresent: true,
        refererPresent: Boolean(req.header("referer")),
      },
    });

    return callback(new Error("Origin not allowed by CORS policy."), {
      ...corsOptions,
      origin: false,
    });
  }),
);

const authHandler = toNodeHandler(auth);
app.use("/api/auth", authRateLimiter);
app.all("/api/auth", authHandler);
app.all("/api/auth/{*any}", authHandler);

app.use(express.json());

app.use("/api/v1", createCsrfMiddleware({ allowedOriginRules }));

app.use("/api/v1/automation", automationRateLimiter);
app.use("/api/v1/daily-notes", dailyNotesRouter);
app.use("/api/v1/logs", logsRouter);
app.use("/api/v1/automation", automationRouter);
app.use("/api/v1/users", usersRouter);

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
    error: null,
  });
});
