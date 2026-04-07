import type { Request, Response } from "express";
import { z } from "zod";

import * as dailyNotesService from "../services/daily-notes.js";

// Validation schemas
const createDailyNoteSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format, use YYYY-MM-DD"),
  content: z.string().min(1, "Content is required"),
});

const updateDailyNoteSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format, use YYYY-MM-DD").optional(),
  content: z.string().min(1, "Content cannot be empty").optional(),
});

export const getDailyNotes = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, data: null, error: "Unauthorized" });
      return;
    }

    const month = req.query["month"] as string | undefined;

    const notes = await dailyNotesService.getDailyNotesForUser(userId, month);
    res.json({ success: true, data: { notes }, error: null });
  } catch (error) {
    console.error("Error fetching daily notes:", error);
    res.status(500).json({ success: false, data: null, error: "Internal server error" });
  }
};

export const getDailyNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, data: null, error: "Unauthorized" });
      return;
    }

    const id = req.params["id"] as string;
    const note = await dailyNotesService.getDailyNoteById(id, userId);

    if (!note) {
      res.status(404).json({ success: false, data: null, error: "Daily note not found" });
      return;
    }

    res.json({ success: true, data: note, error: null });
  } catch (error) {
    console.error("Error fetching daily note:", error);
    res.status(500).json({ success: false, data: null, error: "Internal server error" });
  }
};

export const createDailyNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, data: null, error: "Unauthorized" });
      return;
    }

    const result = createDailyNoteSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ success: false, data: null, error: "Validation error", details: result.error.format() });
      return;
    }

    // Check if quote for date already exists for user
    const existing = await dailyNotesService.getDailyNoteByDate(result.data.date, userId);
    if (existing) {
      res.status(409).json({ success: false, data: null, error: "Daily note already exists for this date" });
      return;
    }

    const note = await dailyNotesService.createDailyNote({
      userId,
      ...result.data,
    });

    res.status(201).json({ success: true, data: note, error: null });
  } catch (error) {
    console.error("Error creating daily note:", error);
    res.status(500).json({ success: false, data: null, error: "Internal server error" });
  }
};

export const updateDailyNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, data: null, error: "Unauthorized" });
      return;
    }

    const id = req.params["id"] as string;
    
    const result = updateDailyNoteSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ success: false, data: null, error: "Validation error", details: result.error.format() });
      return;
    }

    const updateData: Partial<{ date: string; content: string }> = {};
    if (result.data.date !== undefined) updateData.date = result.data.date;
    if (result.data.content !== undefined) updateData.content = result.data.content;

    const note = await dailyNotesService.updateDailyNote(id, userId, updateData);

    if (!note) {
      res.status(404).json({ success: false, data: null, error: "Daily note not found" });
      return;
    }

    res.json({ success: true, data: note, error: null });
  } catch (error) {
    console.error("Error updating daily note:", error);
    res.status(500).json({ success: false, data: null, error: "Internal server error" });
  }
};

export const deleteDailyNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, data: null, error: "Unauthorized" });
      return;
    }

    const id = req.params["id"] as string;
    const note = await dailyNotesService.deleteDailyNote(id, userId);

    if (!note) {
      res.status(404).json({ success: false, data: null, error: "Daily note not found" });
      return;
    }

    res.json({ success: true, data: { id: note.id }, error: null });
  } catch (error) {
    console.error("Error deleting daily note:", error);
    res.status(500).json({ success: false, data: null, error: "Internal server error" });
  }
};
