import { pgTable, text, serial, integer, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studyPlansTable = pgTable("study_plans", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  examDate: date("exam_date", { mode: "string" }),
  subjects: text("subjects").array().notNull().default([]),
  studyHoursPerDay: integer("study_hours_per_day").notNull().default(2),
  goals: text("goals"),
  status: text("status").notNull().default("active"),
  taskCount: integer("task_count").notNull().default(0),
  completedTaskCount: integer("completed_task_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studyTasksTable = pgTable("study_tasks", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull(),
  title: text("title").notNull(),
  subject: text("subject"),
  scheduledDate: date("scheduled_date", { mode: "string" }).notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  completed: boolean("completed").notNull().default(false),
});

export const insertStudyPlanSchema = createInsertSchema(studyPlansTable).omit({ id: true, taskCount: true, completedTaskCount: true, createdAt: true });
export type InsertStudyPlan = z.infer<typeof insertStudyPlanSchema>;
export type StudyPlan = typeof studyPlansTable.$inferSelect;

export const insertStudyTaskSchema = createInsertSchema(studyTasksTable).omit({ id: true });
export type InsertStudyTask = z.infer<typeof insertStudyTaskSchema>;
export type StudyTask = typeof studyTasksTable.$inferSelect;
