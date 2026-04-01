import cors from "cors";
import express from "express";
import { toNodeHandler } from "better-auth/node";

import { auth } from "./config/auth";
import { env } from "./config/db";
import { logsRouter } from "./routes/v1/logs";
import { usersRouter } from "./routes/v1/users";

export const app = express();

app.use(
  cors({
    origin: env.FRONTEND_ORIGIN,
    credentials: true,
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
