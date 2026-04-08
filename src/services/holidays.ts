import { and, eq, gte, lte, sql } from "drizzle-orm";

import { env } from "../config/db.js";
import { db } from "../db/index.js";
import { holidays } from "../db/schema/holidays.js";

interface NagerHoliday {
  date: string;
  localName: string;
  name: string;
}

export interface HolidayItem {
  date: string;
  name: string;
}

export interface MonthHolidayData {
  holidays: HolidayItem[];
  workingDays: number;
  requiredMinutes: number;
  requiredHours: number;
}

const HOLIDAY_SOURCE = "nager";

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function monthBounds(monthStr: string): { start: Date; end: Date } {
  const start = new Date(`${monthStr}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);
  end.setUTCHours(0, 0, 0, 0);

  return { start, end };
}

function toDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function countWorkingDays(monthStr: string, holidayDates: Set<string>): number {
  const { start, end } = monthBounds(monthStr);
  const cursor = new Date(start);
  let workingDays = 0;

  while (cursor <= end) {
    const key = toDateKey(cursor);
    if (!isWeekend(cursor) && !holidayDates.has(key)) {
      workingDays += 1;
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return workingDays;
}

async function fetchHolidaysForYear(year: number, countryCode: string): Promise<NagerHoliday[]> {
  const response = await fetch(
    `${env.HOLIDAY_API_BASE_URL}/PublicHolidays/${year}/${countryCode}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Holiday sync failed for ${year}-${countryCode}: ${response.status}`);
  }

  const data = (await response.json()) as NagerHoliday[];
  return data;
}

export async function syncPublicHolidaysByYear(year: number): Promise<void> {
  const countryCode = env.HOLIDAY_COUNTRY_CODE;
  const apiHolidays = await fetchHolidaysForYear(year, countryCode);

  if (apiHolidays.length === 0) {
    return;
  }

  await db
    .insert(holidays)
    .values(
      apiHolidays.map((holiday) => ({
        id: crypto.randomUUID(),
        countryCode,
        holidayDate: holiday.date,
        name: holiday.localName || holiday.name,
        source: HOLIDAY_SOURCE,
      })),
    )
    .onConflictDoUpdate({
      target: [holidays.countryCode, holidays.holidayDate],
      set: {
        name: sql`excluded.name`,
        source: HOLIDAY_SOURCE,
        updatedAt: new Date(),
      },
    });
}

export async function ensurePublicHolidaysByYear(year: number): Promise<void> {
  const countryCode = env.HOLIDAY_COUNTRY_CODE;
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const existing = await db
    .select({ count: sql<number>`count(*)` })
    .from(holidays)
    .where(
      and(
        eq(holidays.countryCode, countryCode),
        gte(holidays.holidayDate, start),
        lte(holidays.holidayDate, end),
      ),
    );

  const count = Number(existing[0]?.count ?? 0);

  if (count > 0) {
    return;
  }

  await syncPublicHolidaysByYear(year);
}

export async function getHolidayMonthData(monthStr: string): Promise<MonthHolidayData> {
  const start = new Date(`${monthStr}-01T00:00:00.000Z`);

  if (Number.isNaN(start.getTime())) {
    return {
      holidays: [],
      workingDays: 0,
      requiredMinutes: 0,
      requiredHours: 0,
    };
  }

  await ensurePublicHolidaysByYear(start.getUTCFullYear());

  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);

  const startKey = toDateKey(start);
  const endKey = toDateKey(end);

  const rows = await db
    .select({
      holidayDate: holidays.holidayDate,
      name: holidays.name,
    })
    .from(holidays)
    .where(
      and(
        eq(holidays.countryCode, env.HOLIDAY_COUNTRY_CODE),
        gte(holidays.holidayDate, startKey),
        lte(holidays.holidayDate, endKey),
      ),
    )
    .orderBy(holidays.holidayDate);

  const holidayItems = rows.map((row) => ({
    date: row.holidayDate,
    name: row.name,
  }));

  const holidayDateSet = new Set(holidayItems.map((holiday) => holiday.date));
  const workingDays = countWorkingDays(monthStr, holidayDateSet);
  const requiredMinutes = workingDays * 8 * 60;

  return {
    holidays: holidayItems,
    workingDays,
    requiredMinutes,
    requiredHours: Number((requiredMinutes / 60).toFixed(2)),
  };
}
