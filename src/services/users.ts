import { eq } from "drizzle-orm";

import { db } from "../db";
import { users } from "../db/schema/users";

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
}

export async function getMyProfile(userId: string): Promise<UserProfile> {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      dailyRate: users.dailyRate,
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
    });

  if (!updatedUser) {
    throw new UsersServiceError("User not found.", 404);
  }

  return {
    id: updatedUser.id,
    email: updatedUser.email,
    name: updatedUser.name,
    dailyRate: updatedUser.dailyRate,
  };
}
