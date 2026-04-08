import { and, isNull, lt, sql, inArray, eq, or } from "drizzle-orm";
import cron from "node-cron";

import { db } from "../db/index.js";
import { logs } from "../db/schema/logs.js";
import { users } from "../db/schema/users.js";
import { syncPublicHolidaysByYear } from "./holidays.js";

/**
 * Automatically clocks out any open logs to the current time, truncated to the minute.
 */
export async function executeAutoClockOut(currentHHMM?: string) {
  try {
    const timezone = process.env['APP_TIMEZONE'] || "Asia/Manila";
    const targetDate = new Date();
    // Zero out seconds and ms to map exactly to the cron minute trigger
    targetDate.setSeconds(0, 0);

    if (!currentHHMM) {
      currentHHMM = targetDate.toLocaleTimeString("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    const activeUsersQuery = db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.autoClockOutEnabled, true),
          or(
            eq(users.autoClockOutAmTime, currentHHMM),
            eq(users.autoClockOutPmTime, currentHHMM)
          )
        )
      );

    // Update all logs that don't have a clockOut yet AND their clockIn is < targetDate
    await db
      .update(logs)
      .set({
        clockOut: targetDate,
        notes: sql`COALESCE(${logs.notes} || e'\\n\\n', '') || '[System: Auto-clocked out]'`,
      })
      .where(
        and(
          isNull(logs.clockOut),
          lt(logs.clockIn, targetDate),
          inArray(logs.userId, activeUsersQuery)
        )
      );
      
    console.log(`[Cron] Auto clock-out checked for ${currentHHMM} at ${targetDate.toISOString()}`);
  } catch (error) {
    console.error(`[Cron] Auto clock-out failed`, error);
  }
}

/**
 * Initializes all cron jobs for the application.
 */
async function syncHolidayCalendar() {
  try {
    const now = new Date();
    const currentYear = now.getUTCFullYear();

    await Promise.all([
      syncPublicHolidaysByYear(currentYear),
      syncPublicHolidaysByYear(currentYear + 1),
    ]);

    console.log(`[Cron] Holiday calendar synced for ${currentYear} and ${currentYear + 1}`);
  } catch (error) {
    console.error("[Cron] Holiday sync failed", error);
  }
}

export function initCronJobs() {
  const timezone = process.env['APP_TIMEZONE'] || "Asia/Manila";

  console.log(`[Cron] Starting cron scheduler (Timezone: ${timezone})`);

  // Run every minute
  cron.schedule("* * * * *", () => {
    const now = new Date();
    const currentHHMM = now.toLocaleTimeString("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
    });
    executeAutoClockOut(currentHHMM);
  }, { timezone });

  // Sync holiday calendar every day at 01:00 local time
  cron.schedule("0 1 * * *", () => {
    void syncHolidayCalendar();
  }, { timezone });

  // Prime cache on startup
  void syncHolidayCalendar();
}


