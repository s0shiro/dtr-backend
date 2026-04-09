import { eq } from "drizzle-orm";

import { env } from "../config/db.js";
import { db } from "../db/index.js";
import { users } from "../db/schema/users.js";

export class UsersServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "UsersServiceError";
  }
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  dailyRate: number | null;
  autoClockOutEnabled: boolean;
  autoClockOutAmTime: string;
  autoClockOutPmTime: string;
}

export interface OfficeConfig {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  configured: boolean;
}

export interface ReleaseNotes {
  releaseId: string;
  releasedAt: string;
  title: string;
  highlights: string[];
}

export interface DailyMotivation {
  dateKey: string;
  quote: string;
  author: string;
}

export async function getMyProfile(userId: string): Promise<UserProfile> {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      dailyRate: users.dailyRate,
      autoClockOutEnabled: users.autoClockOutEnabled,
      autoClockOutAmTime: users.autoClockOutAmTime,
      autoClockOutPmTime: users.autoClockOutPmTime,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new UsersServiceError("User not found.", 404);
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    dailyRate: user.dailyRate,
    autoClockOutEnabled: user.autoClockOutEnabled,
    autoClockOutAmTime: user.autoClockOutAmTime,
    autoClockOutPmTime: user.autoClockOutPmTime,
  };
}

export async function updateDailyRate(userId: string, dailyRate: number): Promise<UserProfile> {
  const [updatedUser] = await db
    .update(users)
    .set({ dailyRate })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      dailyRate: users.dailyRate,
      autoClockOutEnabled: users.autoClockOutEnabled,
      autoClockOutAmTime: users.autoClockOutAmTime,
      autoClockOutPmTime: users.autoClockOutPmTime,
    });

  if (!updatedUser) {
    throw new UsersServiceError("User not found.", 404);
  }

  return {
    id: updatedUser.id,
    email: updatedUser.email,
    name: updatedUser.name,
    dailyRate: updatedUser.dailyRate,
    autoClockOutEnabled: updatedUser.autoClockOutEnabled,
    autoClockOutAmTime: updatedUser.autoClockOutAmTime,
    autoClockOutPmTime: updatedUser.autoClockOutPmTime,
  };
}

const latestReleaseNotes: ReleaseNotes = {
  releaseId: "2026-04-09-map-geofence",
  releasedAt: "2026-04-09",
  title: "What’s new in DTR",
  highlights: [
    "Live map now shows your location and your office location in one view.",
    "You’ll get a reminder when you enter the office area so you won’t forget to clock in.",
    "Location checks are now more reliable for clock in and clock out.",
    "You can add manual time logs more easily when you need to correct missed taps.",
  ],
};

const defaultMotivationalQuote = {
  quote: "Stay consistent today—every accurate log moves you forward.",
  author: "DTR Coach",
};

interface ApiNinjasQuote {
  quote: string;
  author: string;
  category?: string;
}

let motivationCache: DailyMotivation | null = null;

function getDateKeyInAppTimezone(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: env.APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
}

async function fetchApiNinjasQuote(): Promise<ApiNinjasQuote | null> {
  if (!env.API_NINJAS_KEY) {
    return null;
  }

  const params = new URLSearchParams({
    categories: env.API_NINJAS_QUOTE_CATEGORIES,
  });

  const response = await fetch(`${env.API_NINJAS_QUOTES_URL}?${params.toString()}`, {
    method: "GET",
    headers: {
      "X-Api-Key": env.API_NINJAS_KEY,
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as ApiNinjasQuote[] | null;

  if (!payload || payload.length === 0) {
    return null;
  }

  const selected = payload[0];

  if (!selected?.quote || !selected?.author) {
    return null;
  }

  return selected;
}

export function getLatestReleaseNotes(): ReleaseNotes {
  return latestReleaseNotes;
}

export async function getDailyMotivation(): Promise<DailyMotivation> {
  const dateKey = getDateKeyInAppTimezone();

  if (motivationCache?.dateKey === dateKey) {
    return motivationCache;
  }

  const externalQuote = await fetchApiNinjasQuote();

  const resolved: DailyMotivation = {
    dateKey,
    quote: externalQuote?.quote ?? defaultMotivationalQuote.quote,
    author: externalQuote?.author ?? defaultMotivationalQuote.author,
  };

  motivationCache = resolved;

  return resolved;
}

export function getOfficeConfig(): OfficeConfig {
  const latitude = typeof env.OFFICE_LATITUDE === "number" ? env.OFFICE_LATITUDE : null;
  const longitude = typeof env.OFFICE_LONGITUDE === "number" ? env.OFFICE_LONGITUDE : null;

  return {
    latitude,
    longitude,
    radiusMeters: env.OFFICE_RADIUS_METERS,
    configured: latitude !== null && longitude !== null,
  };
}

export async function updateSettings(
  userId: string,
  autoClockOutEnabled?: boolean,
  autoClockOutAmTime?: string,
  autoClockOutPmTime?: string,
): Promise<UserProfile> {
  const settingsToUpdate: {
    autoClockOutEnabled?: boolean;
    autoClockOutAmTime?: string;
    autoClockOutPmTime?: string;
  } = {};

  if (autoClockOutEnabled !== undefined) {
    settingsToUpdate.autoClockOutEnabled = autoClockOutEnabled;
  }

  if (autoClockOutAmTime !== undefined) {
    settingsToUpdate.autoClockOutAmTime = autoClockOutAmTime;
  }

  if (autoClockOutPmTime !== undefined) {
    settingsToUpdate.autoClockOutPmTime = autoClockOutPmTime;
  }

  const [updatedUser] = await db
    .update(users)
    .set(settingsToUpdate)
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      dailyRate: users.dailyRate,
      autoClockOutEnabled: users.autoClockOutEnabled,
      autoClockOutAmTime: users.autoClockOutAmTime,
      autoClockOutPmTime: users.autoClockOutPmTime,
    });

  if (!updatedUser) {
    throw new UsersServiceError("User not found.", 404);
  }

  return {
    id: updatedUser.id,
    email: updatedUser.email,
    name: updatedUser.name,
    dailyRate: updatedUser.dailyRate,
    autoClockOutEnabled: updatedUser.autoClockOutEnabled,
    autoClockOutAmTime: updatedUser.autoClockOutAmTime,
    autoClockOutPmTime: updatedUser.autoClockOutPmTime,
  };
}
