import { pgTable, serial, text, date, timestamp } from "drizzle-orm/pg-core";
export const examEventsTable = pgTable("exam_events", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  subject: text("subject").notNull(),
  examDate: date("exam_date").notNull(),
  notes: text("notes").notNull().default(""),
  routine: text("routine").notNull().default(""),
  color: text("color").notNull().default("blue"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
