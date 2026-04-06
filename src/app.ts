import cors from "cors";
import express from "express";
import { toNodeHandler } from "better-auth/node";

import { auth } from "./config/auth.js";
import { env } from "./config/db.js";
import { logsRouter } from "./routes/v1/logs.js";
import { usersRouter } from "./routes/v1/users.js";

export const app = express();
app.set("trust proxy", 1);

/**
 * Validates if the origin is allowed based on configured patterns.
 * Supports:
 * - Exact matches (http://localhost:3000)
 * - Wildcard patterns (https://*.vercel.app)
 */
function isAllowedOrigin(origin: string, allowedOrigins: string[]): boolean {
  return allowedOrigins.some((allowedOrigin) => {
    // Exact match
    if (allowedOrigin === origin) {
      return true;
    }

    // Wildcard pattern matching (e.g., https://*.vercel.app)
    if (allowedOrigin.includes("*")) {
      const pattern = allowedOrigin
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // Escape special regex chars
        .replace(/\*/g, ".*"); // Replace * with .*
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(origin);
    }

    return false;
  });
}

// Parse FRONTEND_ORIGIN - supports comma-separated list
const allowedOrigins = env.FRONTEND_ORIGIN.split(",").map((origin) =>
  origin.trim(),
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }

      if (isAllowedOrigin(origin, allowedOrigins)) {
        callback(null, true);
      } else {
        callback(
          new Error(
            `Origin ${origin} not allowed by CORS policy. Allowed origins: ${allowedOrigins.join(", ")}`,
          ),
        );
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    exposedHeaders: ["Set-Cookie"],
    maxAge: 86400, // 24 hours - cache preflight requests
  }),
);
app.all("/api/auth/{*any}", toNodeHandler(auth));
app.use(express.json());

app.use("/api/v1/logs", logsRouter);
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
