import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import { dailyNotes } from "../db/schema/daily_notes";
import { holidays } from "../db/schema/holidays";
import { logs } from "../db/schema/logs";
import { users } from "../db/schema/users";

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Log = InferSelectModel<typeof logs>;
export type NewLog = InferInsertModel<typeof logs>;

export type DailyNote = InferSelectModel<typeof dailyNotes>;
export type NewDailyNote = InferInsertModel<typeof dailyNotes>;

export type Holiday = InferSelectModel<typeof holidays>;
export type NewHoliday = InferInsertModel<typeof holidays>;
