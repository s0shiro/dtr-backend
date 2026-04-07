import { and, eq, sql } from "drizzle-orm";

import { db } from "../db/index.js";
import { dailyNotes } from "../db/schema/daily_notes.js";

type CreateDailyNote = typeof dailyNotes.$inferInsert;
type UpdateDailyNote = Partial<CreateDailyNote>;

export async function getDailyNotesForUser(userId: string, month?: string) {
  const whereClause = month 
    ? and(eq(dailyNotes.userId, userId), sql`to_char(${dailyNotes.date}, 'YYYY-MM') = ${month}`)
    : eq(dailyNotes.userId, userId);

  return db
    .select()
    .from(dailyNotes)
    .where(whereClause)
    .orderBy(dailyNotes.date); // Default to desc if preferred, date string sorting
}

export async function getDailyNoteById(id: string, userId: string) {
  const result = await db
    .select()
    .from(dailyNotes)
    .where(and(eq(dailyNotes.id, id), eq(dailyNotes.userId, userId)))
    .limit(1);
    
  return result[0];
}

export async function getDailyNoteByDate(date: string, userId: string) {
  const result = await db
    .select()
    .from(dailyNotes)
    .where(and(eq(dailyNotes.date, date), eq(dailyNotes.userId, userId)))
    .limit(1);
    
  return result[0];
}

export async function createDailyNote(data: CreateDailyNote) {
  const result = await db
    .insert(dailyNotes)
    .values(data)
    .returning();
    
  return result[0];
}

export async function updateDailyNote(id: string, userId: string, data: UpdateDailyNote) {
  const result = await db
    .update(dailyNotes)
    .set(data)
    .where(and(eq(dailyNotes.id, id), eq(dailyNotes.userId, userId)))
    .returning();
    
  return result[0];
}

export async function deleteDailyNote(id: string, userId: string) {
  const result = await db
    .delete(dailyNotes)
    .where(and(eq(dailyNotes.id, id), eq(dailyNotes.userId, userId)))
    .returning();
    
  return result[0];
}
