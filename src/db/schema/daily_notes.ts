import { relations } from "drizzle-orm";
import { date, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./users.js";

export const dailyNotes = pgTable(
  "daily_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(), // PostgreSQL date type handles YYYY-MM-DD
    content: text("content").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("daily_notes_user_id_date_unique_idx").on(table.userId, table.date),
    index("daily_notes_user_id_idx").on(table.userId),
  ],
);

export const dailyNotesRelations = relations(dailyNotes, ({ one }) => ({
  user: one(users, {
    fields: [dailyNotes.userId],
    references: [users.id],
  }),
}));
