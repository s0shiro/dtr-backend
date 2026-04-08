import { relations } from "drizzle-orm";
import {
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./users.js";

export const logs = pgTable("logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  clockIn: timestamp("clock_in").notNull(),
  clockOut: timestamp("clock_out"),
  notes: text("notes"),
  clockInLocationTag: text("clock_in_location_tag").notNull().default("Remote"),
  clockInLatitude: doublePrecision("clock_in_latitude"),
  clockInLongitude: doublePrecision("clock_in_longitude"),
  clockInDistanceMeters: integer("clock_in_distance_meters"),
  clockOutLocationTag: text("clock_out_location_tag"),
  clockOutLatitude: doublePrecision("clock_out_latitude"),
  clockOutLongitude: doublePrecision("clock_out_longitude"),
  clockOutDistanceMeters: integer("clock_out_distance_meters"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("logs_user_id_idx").on(table.userId),
  index("logs_user_clock_out_idx").on(table.userId, table.clockOut),
]);

export const logsRelations = relations(logs, ({ one }) => ({
  user: one(users, {
    fields: [logs.userId],
    references: [users.id],
  }),
}));
