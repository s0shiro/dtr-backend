import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import { logs } from "../db/schema/logs";
import { users } from "../db/schema/users";

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Log = InferSelectModel<typeof logs>;
export type NewLog = InferInsertModel<typeof logs>;
