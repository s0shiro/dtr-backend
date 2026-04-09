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
