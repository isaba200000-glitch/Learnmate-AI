import { pgTable, text, serial, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Focus Mode: completed fullscreen study sessions with distraction tracking.
export const focusSessionsTable = pgTable(
  "focus_sessions",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    plannedMinutes: integer("planned_minutes").notNull(),
    focusedSeconds: integer("focused_seconds").notNull(),
    distractions: integer("distractions").notNull().default(0),
    score: integer("score").notNull().default(0), // 0-100, computed server-side
    strict: boolean("strict").notNull().default(false),
    failed: boolean("failed").notNull().default(false), // strict mode: too many distractions
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("focus_sessions_user_idx").on(t.userId)],
);

export const insertFocusSessionSchema = createInsertSchema(focusSessionsTable).omit({
  id: true,
  completedAt: true,
});
export type InsertFocusSession = z.infer<typeof insertFocusSessionSchema>;
export type FocusSession = typeof focusSessionsTable.$inferSelect;
