import { index, pgTable, text, date, uniqueIndex, timestamp } from "drizzle-orm/pg-core";

export const holidays = pgTable(
  "holidays",
  {
    id: text("id").primaryKey(),
    countryCode: text("country_code").notNull(),
    holidayDate: date("holiday_date", { mode: "string" }).notNull(),
    name: text("name").notNull(),
    source: text("source").notNull().default("nager"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("holidays_country_date_uidx").on(table.countryCode, table.holidayDate),
    index("holidays_country_idx").on(table.countryCode),
    index("holidays_date_idx").on(table.holidayDate),
  ],
);
