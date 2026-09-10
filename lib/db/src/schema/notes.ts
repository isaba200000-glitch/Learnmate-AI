import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const notesTable = pgTable("notes", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  subject: text("subject"),
  tags: text("tags").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// AI-generated illustration cached per note subject keyword.
// Keyed by lowercase subject so the same topic always reuses one image.
export const noteSubjectImagesTable = pgTable("note_subject_images", {
  id: serial("id").primaryKey(),
  subjectKey: text("subject_key").notNull().unique(),
  imageUrl: text("image_url").notNull(), // base64 data URL
  photographerName: text("photographer_name"), // Pexels attribution (nullable)
  photographerUrl: text("photographer_url"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNoteSchema = createInsertSchema(notesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notesTable.$inferSelect;
