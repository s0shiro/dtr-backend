import { and, desc, eq, gt, gte, isNull, lt, or } from "drizzle-orm";

import { env } from "../config/db.js";
import { db } from "../db/index.js";
import { holidays } from "../db/schema/holidays.js";
import { logs } from "../db/schema/logs.js";
import { getHolidayMonthData } from "./holidays.js";

export interface ClockLocationPayload {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface ClockPayload {
  note?: string;
  location?: ClockLocationPayload;
}

export interface AdjustLogPayload {
  target: "clockIn" | "clockOut";
  /** Absolute ISO 8601 timestamp to set (preferred) */
  targetTime?: string;
  /** Legacy: relative minutes delta to add */
  minutesDelta?: number;
}

export interface CreateManualLogPayload {
  clockInAt: string;
  clockOutAt: string;
  note?: string;
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

interface LocationEvaluation {
  tag: "On-site" | "Remote";
  latitude: number | null;
  longitude: number | null;
  distanceMeters: number | null;
}

function getCurrentMonthKey(): string {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function getDistanceMeters(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
): number {
  const earthRadiusMeters = 6371e3;
  const dLat = degreesToRadians(toLatitude - fromLatitude);
  const dLon = degreesToRadians(toLongitude - fromLongitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degreesToRadians(fromLatitude)) *
      Math.cos(degreesToRadians(toLatitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(earthRadiusMeters * c);
}

function getDateKeyInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new LogsServiceError("Failed to resolve calendar date.", 500);
  }

  return `${year}-${month}-${day}`;
}

function isWeekendInTimezone(date: Date, timezone: string): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(date);

  return weekday === "Sat" || weekday === "Sun";
}

function evaluateLocation(location?: ClockLocationPayload): LocationEvaluation {
  if (!location) {
    return {
      tag: "Remote",
      latitude: null,
      longitude: null,
      distanceMeters: null,
    };
  }

  const { OFFICE_LATITUDE, OFFICE_LONGITUDE, OFFICE_RADIUS_METERS } = env;

  if (OFFICE_LATITUDE === undefined || OFFICE_LONGITUDE === undefined) {
    return {
      tag: "Remote",
      latitude: location.latitude,
      longitude: location.longitude,
      distanceMeters: null,
    };
  }

  const distanceMeters = getDistanceMeters(
    location.latitude,
    location.longitude,
    OFFICE_LATITUDE,
    OFFICE_LONGITUDE,
  );

  return {
    tag: distanceMeters <= OFFICE_RADIUS_METERS ? "On-site" : "Remote",
    latitude: location.latitude,
    longitude: location.longitude,
    distanceMeters,
  };
}

export async function listLogs(userId: string, monthStr?: string): Promise<{
  logs: Array<{
    id: string;
    userId: string;
    clockInAt: string;
    clockOutAt: string | null;
    note: string | null;
    clockInLocationTag: "On-site" | "Remote";
    clockOutLocationTag: "On-site" | "Remote" | null;
    clockInDistanceMeters: number | null;
    clockOutDistanceMeters: number | null;
  }>;
  holidays: Array<{
    date: string;
    name: string;
  }>;
  monthSummary: {
    month: string;
    workingDays: number;
    requiredMinutes: number;
    requiredHours: number;
  };
}> {
  let whereCondition = eq(logs.userId, userId);
  let resolvedMonth = getCurrentMonthKey();

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
        resolvedMonth = monthStr;
      }
    }
  }

  const [userLogs, holidayData] = await Promise.all([
    db
      .select({
        id: logs.id,
        userId: logs.userId,
        clockIn: logs.clockIn,
        clockOut: logs.clockOut,
        notes: logs.notes,
        clockInLocationTag: logs.clockInLocationTag,
        clockOutLocationTag: logs.clockOutLocationTag,
        clockInDistanceMeters: logs.clockInDistanceMeters,
        clockOutDistanceMeters: logs.clockOutDistanceMeters,
      })
      .from(logs)
      .where(whereCondition)
      .orderBy(desc(logs.clockIn)),
    getHolidayMonthData(resolvedMonth),
  ]);

  return {
    logs: userLogs.map((log) => ({
      id: log.id,
      userId: log.userId,
      clockInAt: log.clockIn.toISOString(),
      clockOutAt: log.clockOut?.toISOString() ?? null,
      note: log.notes,
      clockInLocationTag: (log.clockInLocationTag === "On-site" ? "On-site" : "Remote"),
      clockOutLocationTag: log.clockOutLocationTag
        ? log.clockOutLocationTag === "On-site"
          ? "On-site"
          : "Remote"
        : null,
      clockInDistanceMeters: log.clockInDistanceMeters,
      clockOutDistanceMeters: log.clockOutDistanceMeters,
    })),
    holidays: holidayData.holidays,
    monthSummary: {
      month: resolvedMonth,
      workingDays: holidayData.workingDays,
      requiredMinutes: holidayData.requiredMinutes,
      requiredHours: holidayData.requiredHours,
    },
  };
}

export async function clockIn(userId: string, payload: ClockPayload): Promise<{
  id: string;
  userId: string;
  clockInAt: string;
  note: string | null;
  clockInLocationTag: "On-site" | "Remote";
  clockInDistanceMeters: number | null;
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
  const locationEvaluation = evaluateLocation(payload.location);

  const [createdLog] = await db
    .insert(logs)
    .values({
      userId,
      clockIn: now,
      notes: payload.note ?? null,
      clockInLocationTag: locationEvaluation.tag,
      clockInLatitude: locationEvaluation.latitude,
      clockInLongitude: locationEvaluation.longitude,
      clockInDistanceMeters: locationEvaluation.distanceMeters,
    })
    .returning({
      id: logs.id,
      userId: logs.userId,
      clockIn: logs.clockIn,
      notes: logs.notes,
      clockInLocationTag: logs.clockInLocationTag,
      clockInDistanceMeters: logs.clockInDistanceMeters,
    });

  if (!createdLog) {
    throw new LogsServiceError("Failed to create clock-in log.", 500);
  }

  return {
    id: createdLog.id,
    userId: createdLog.userId,
    clockInAt: createdLog.clockIn.toISOString(),
    note: createdLog.notes,
    clockInLocationTag: createdLog.clockInLocationTag === "On-site" ? "On-site" : "Remote",
    clockInDistanceMeters: createdLog.clockInDistanceMeters,
  };
}

export async function clockOut(userId: string, payload: ClockPayload): Promise<{
  id: string;
  userId: string;
  clockOutAt: string;
  note: string | null;
  clockOutLocationTag: "On-site" | "Remote";
  clockOutDistanceMeters: number | null;
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
  const locationEvaluation = evaluateLocation(payload.location);
  const updateValues: {
    clockOut: Date;
    notes?: string | null;
    clockOutLocationTag: "On-site" | "Remote";
    clockOutLatitude: number | null;
    clockOutLongitude: number | null;
    clockOutDistanceMeters: number | null;
  } = {
    clockOut: now,
    clockOutLocationTag: locationEvaluation.tag,
    clockOutLatitude: locationEvaluation.latitude,
    clockOutLongitude: locationEvaluation.longitude,
    clockOutDistanceMeters: locationEvaluation.distanceMeters,
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
      clockOutLocationTag: logs.clockOutLocationTag,
      clockOutDistanceMeters: logs.clockOutDistanceMeters,
    });

  if (!updatedLog?.clockOut) {
    throw new LogsServiceError("Failed to clock out active log.", 500);
  }

  return {
    id: updatedLog.id,
    userId: updatedLog.userId,
    clockOutAt: updatedLog.clockOut.toISOString(),
    note: updatedLog.notes,
    clockOutLocationTag: updatedLog.clockOutLocationTag === "On-site" ? "On-site" : "Remote",
    clockOutDistanceMeters: updatedLog.clockOutDistanceMeters,
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

export async function createManualLog(
  userId: string,
  payload: CreateManualLogPayload,
): Promise<{
  id: string;
  userId: string;
  clockInAt: string;
  clockOutAt: string | null;
  note: string | null;
  clockInLocationTag: "On-site" | "Remote";
  clockOutLocationTag: "On-site" | "Remote" | null;
  clockInDistanceMeters: number | null;
  clockOutDistanceMeters: number | null;
}> {
  const clockIn = new Date(payload.clockInAt);
  const clockOut = new Date(payload.clockOutAt);

  if (Number.isNaN(clockIn.getTime()) || Number.isNaN(clockOut.getTime())) {
    throw new LogsServiceError("Invalid manual log timestamp.", 400);
  }

  if (clockOut.getTime() <= clockIn.getTime()) {
    throw new LogsServiceError("clockOut must be later than clockIn.", 400);
  }

  if (clockIn.getTime() > Date.now()) {
    throw new LogsServiceError("Manual logs cannot be created in the future.", 400);
  }

  const timezone = env.APP_TIMEZONE;
  const workingDateKey = getDateKeyInTimezone(clockIn, timezone);

  if (isWeekendInTimezone(clockIn, timezone)) {
    throw new LogsServiceError("Manual logs are only allowed on working days (weekdays).", 400);
  }

  const [holidayRow] = await db
    .select({ id: holidays.id })
    .from(holidays)
    .where(and(eq(holidays.countryCode, env.HOLIDAY_COUNTRY_CODE), eq(holidays.holidayDate, workingDateKey)))
    .limit(1);

  if (holidayRow) {
    throw new LogsServiceError("Manual logs are not allowed on holidays.", 400);
  }

  const [overlap] = await db
    .select({ id: logs.id })
    .from(logs)
    .where(
      and(
        eq(logs.userId, userId),
        lt(logs.clockIn, clockOut),
        or(isNull(logs.clockOut), gt(logs.clockOut, clockIn)),
      ),
    )
    .limit(1);

  if (overlap) {
    throw new LogsServiceError("Manual log overlaps with an existing entry.", 409);
  }

  const [createdLog] = await db
    .insert(logs)
    .values({
      userId,
      clockIn,
      clockOut,
      notes: payload.note ?? null,
      clockInLocationTag: "Remote",
      clockOutLocationTag: "Remote",
    })
    .returning({
      id: logs.id,
      userId: logs.userId,
      clockIn: logs.clockIn,
      clockOut: logs.clockOut,
      notes: logs.notes,
      clockInLocationTag: logs.clockInLocationTag,
      clockOutLocationTag: logs.clockOutLocationTag,
      clockInDistanceMeters: logs.clockInDistanceMeters,
      clockOutDistanceMeters: logs.clockOutDistanceMeters,
    });

  if (!createdLog) {
    throw new LogsServiceError("Failed to create manual log.", 500);
  }

  return {
    id: createdLog.id,
    userId: createdLog.userId,
    clockInAt: createdLog.clockIn.toISOString(),
    clockOutAt: createdLog.clockOut?.toISOString() ?? null,
    note: createdLog.notes,
    clockInLocationTag: createdLog.clockInLocationTag === "On-site" ? "On-site" : "Remote",
    clockOutLocationTag: createdLog.clockOutLocationTag
      ? createdLog.clockOutLocationTag === "On-site"
        ? "On-site"
        : "Remote"
      : null,
    clockInDistanceMeters: createdLog.clockInDistanceMeters,
    clockOutDistanceMeters: createdLog.clockOutDistanceMeters,
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
  clockInLocationTag: "On-site" | "Remote";
  clockOutLocationTag: "On-site" | "Remote" | null;
  clockInDistanceMeters: number | null;
  clockOutDistanceMeters: number | null;
}> {
  const [existingLog] = await db
    .select({
      id: logs.id,
      userId: logs.userId,
      clockIn: logs.clockIn,
      clockOut: logs.clockOut,
      notes: logs.notes,
      clockInLocationTag: logs.clockInLocationTag,
      clockOutLocationTag: logs.clockOutLocationTag,
      clockInDistanceMeters: logs.clockInDistanceMeters,
      clockOutDistanceMeters: logs.clockOutDistanceMeters,
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
      clockInLocationTag: logs.clockInLocationTag,
      clockOutLocationTag: logs.clockOutLocationTag,
      clockInDistanceMeters: logs.clockInDistanceMeters,
      clockOutDistanceMeters: logs.clockOutDistanceMeters,
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
    clockInLocationTag: updatedLog.clockInLocationTag === "On-site" ? "On-site" : "Remote",
    clockOutLocationTag: updatedLog.clockOutLocationTag
      ? updatedLog.clockOutLocationTag === "On-site"
        ? "On-site"
        : "Remote"
      : null,
    clockInDistanceMeters: updatedLog.clockInDistanceMeters,
    clockOutDistanceMeters: updatedLog.clockOutDistanceMeters,
  };
}
