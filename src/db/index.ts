import "dotenv/config";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { dbConfig } from "../config/db.js";

const queryClient = postgres(dbConfig.connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

import * as dailyNotesSchema from "./schema/daily_notes.js";
import * as logsSchema from "./schema/logs.js";
import * as usersSchema from "./schema/users.js";

const schema = { ...usersSchema, ...logsSchema, ...dailyNotesSchema };

export const db = drizzle({ client: queryClient, schema });

export * from "./schema/daily_notes.js";
export * from "./schema/logs.js";
export * from "./schema/users.js";

export async function closeDbConnection(): Promise<void> {
  await queryClient.end({ timeout: 5 });
}
