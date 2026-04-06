import { and, desc, eq, gte, isNull, lt } from "drizzle-orm";

import { db } from "../db/index.js";
import { logs } from "../db/schema/logs.js";

export interface ClockPayload {
  note?: string;
}

export interface AdjustLogPayload {
  target: "clockIn" | "clockOut";
  /** Absolute ISO 8601 timestamp to set (preferred) */
  targetTime?: string;
  /** Legacy: relative minutes delta to add */
  minutesDelta?: number;
}

export class LogsServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "LogsServiceError";
  }
}

export async function listLogs(userId: string, monthStr?: string): Promise<{
  logs: Array<{
    id: string;
    userId: string;
    clockInAt: string;
    clockOutAt: string | null;
    note: string | null;
  }>;
}> {
  let whereCondition = eq(logs.userId, userId);

  if (monthStr) {
    const monthPattern = /^\d{4}-\d{2}$/;

    if (monthPattern.test(monthStr)) {
      const start = new Date(`${monthStr}-01T00:00:00.000Z`);

      if (!Number.isNaN(start.getTime())) {
        const end = new Date(start);
        end.setUTCMonth(end.getUTCMonth() + 1);

        whereCondition = and(
          eq(logs.userId, userId),
          gte(logs.clockIn, start),
          lt(logs.clockIn, end),
        )!;
      }
    }
  }

  const userLogs = await db
    .select({
      id: logs.id,
      userId: logs.userId,
      clockIn: logs.clockIn,
      clockOut: logs.clockOut,
      notes: logs.notes,
    })
    .from(logs)
    .where(whereCondition)
    .orderBy(desc(logs.clockIn));

  return {
    logs: userLogs.map((log) => ({
      id: log.id,
      userId: log.userId,
      clockInAt: log.clockIn.toISOString(),
      clockOutAt: log.clockOut?.toISOString() ?? null,
      note: log.notes,
    })),
  };
}

export async function clockIn(userId: string, payload: ClockPayload): Promise<{
  id: string;
  userId: string;
  clockInAt: string;
  note: string | null;
}> {
  const [openLog] = await db
    .select({ id: logs.id })
    .from(logs)
    .where(and(eq(logs.userId, userId), isNull(logs.clockOut)))
    .orderBy(desc(logs.clockIn))
    .limit(1);

  if (openLog) {
    throw new LogsServiceError("You already have an active clock-in.", 409);
  }

  const now = new Date();

  const [createdLog] = await db
    .insert(logs)
    .values({
      userId,
      clockIn: now,
      notes: payload.note ?? null,
    })
    .returning({
      id: logs.id,
      userId: logs.userId,
      clockIn: logs.clockIn,
      notes: logs.notes,
    });

  if (!createdLog) {
    throw new LogsServiceError("Failed to create clock-in log.", 500);
  }

  return {
    id: createdLog.id,
    userId: createdLog.userId,
    clockInAt: createdLog.clockIn.toISOString(),
    note: createdLog.notes,
  };
}

export async function clockOut(userId: string, payload: ClockPayload): Promise<{
  id: string;
  userId: string;
  clockOutAt: string;
  note: string | null;
}> {
  const [openLog] = await db
    .select({ id: logs.id })
    .from(logs)
    .where(and(eq(logs.userId, userId), isNull(logs.clockOut)))
    .orderBy(desc(logs.clockIn))
    .limit(1);

  if (!openLog) {
    throw new LogsServiceError("No active clock-in found.", 400);
  }

  const now = new Date();
  const updateValues: { clockOut: Date; notes?: string | null } = {
    clockOut: now,
  };

  if (payload.note !== undefined) {
    updateValues.notes = payload.note;
  }

  const [updatedLog] = await db
    .update(logs)
    .set(updateValues)
    .where(eq(logs.id, openLog.id))
    .returning({
      id: logs.id,
      userId: logs.userId,
      clockOut: logs.clockOut,
      notes: logs.notes,
    });

  if (!updatedLog?.clockOut) {
    throw new LogsServiceError("Failed to clock out active log.", 500);
  }

  return {
    id: updatedLog.id,
    userId: updatedLog.userId,
    clockOutAt: updatedLog.clockOut.toISOString(),
    note: updatedLog.notes,
  };
}

export async function deleteLog(logId: string, userId: string): Promise<{ id: string }> {
  const [deletedLog] = await db
    .delete(logs)
    .where(and(eq(logs.id, logId), eq(logs.userId, userId)))
    .returning({ id: logs.id });

  if (!deletedLog) {
    throw new LogsServiceError("Log not found.", 404);
  }

  return {
    id: deletedLog.id,
  };
}

export async function adjustLogTime(
  logId: string,
  userId: string,
  payload: AdjustLogPayload,
): Promise<{
  id: string;
  userId: string;
  clockInAt: string;
  clockOutAt: string | null;
  note: string | null;
}> {
  const [existingLog] = await db
    .select({
      id: logs.id,
      userId: logs.userId,
      clockIn: logs.clockIn,
      clockOut: logs.clockOut,
      notes: logs.notes,
    })
    .from(logs)
    .where(and(eq(logs.id, logId), eq(logs.userId, userId)))
    .limit(1);

  if (!existingLog) {
    throw new LogsServiceError("Log not found.", 404);
  }

  // Resolve the target date — prefer absolute targetTime, fall back to minutesDelta
  let targetDate: Date;
  if (payload.targetTime) {
    targetDate = new Date(payload.targetTime);
    if (Number.isNaN(targetDate.getTime())) {
      throw new LogsServiceError("Invalid targetTime value.", 400);
    }
  } else if (payload.minutesDelta !== undefined) {
    const base = payload.target === "clockIn" ? existingLog.clockIn : existingLog.clockOut;
    if (!base) {
      throw new LogsServiceError("Cannot adjust clock-out on an active log.", 400);
    }
    targetDate = new Date(base.getTime() + payload.minutesDelta * 60 * 1000);
  } else {
    throw new LogsServiceError("Either targetTime or minutesDelta must be provided.", 400);
  }

  const nextClockIn = payload.target === "clockIn" ? targetDate : existingLog.clockIn;
  const nextClockOut =
    payload.target === "clockOut" && existingLog.clockOut ? targetDate : existingLog.clockOut;

  if (nextClockOut && nextClockOut.getTime() < nextClockIn.getTime()) {
    throw new LogsServiceError("clockOut cannot be earlier than clockIn.", 400);
  }

  const updateValues: { clockIn?: Date; clockOut?: Date | null } = {};

  if (payload.target === "clockIn") {
    updateValues.clockIn = nextClockIn;
  }

  if (payload.target === "clockOut") {
    updateValues.clockOut = nextClockOut;
  }

  const [updatedLog] = await db
    .update(logs)
    .set(updateValues)
    .where(and(eq(logs.id, logId), eq(logs.userId, userId)))
    .returning({
      id: logs.id,
      userId: logs.userId,
      clockIn: logs.clockIn,
      clockOut: logs.clockOut,
      notes: logs.notes,
    });

  if (!updatedLog) {
    throw new LogsServiceError("Failed to adjust log time.", 500);
  }

  return {
    id: updatedLog.id,
    userId: updatedLog.userId,
    clockInAt: updatedLog.clockIn.toISOString(),
    clockOutAt: updatedLog.clockOut?.toISOString() ?? null,
    note: updatedLog.notes,
  };
}