import "dotenv/config";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { dbConfig } from "../config/db.js";

const queryClient = postgres(dbConfig.connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle({ client: queryClient });

export async function closeDbConnection(): Promise<void> {
  await queryClient.end({ timeout: 5 });
}
