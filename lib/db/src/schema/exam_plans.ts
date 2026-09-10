import { pgTable, text, serial, integer, boolean, timestamp, date, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// AI Exam Planner: batch-aware (GCSE / A Level / SSC / HSC) day-by-day study
// plans with per-day topic explanations and progress check-offs.
export const examPlansTable = pgTable(
  "exam_plans",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    batch: text("batch").notNull(), // gcse | a-level | ssc | hsc
    title: text("title").notNull(),
    examDate: date("exam_date", { mode: "string" }).notNull(),
    subjects: text("subjects").array().notNull().default([]),
    weakTopics: text("weak_topics").array().notNull().default([]),
    status: text("status").notNull().default("active"), // active | archived
    dayCount: integer("day_count").notNull().default(0),
    completedDayCount: integer("completed_day_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("exam_plans_user_idx").on(t.userId)],
);

export const examPlanDaysTable = pgTable(
  "exam_plan_days",
  {
    id: serial("id").primaryKey(),
    planId: integer("plan_id").notNull(),
    dayIndex: integer("day_index").notNull(), // 1-based position in the plan
    date: date("date", { mode: "string" }).notNull(),
    subject: text("subject").notNull(),
    topic: text("topic").notNull(),
    focus: text("focus").notNull().default(""), // one-line goal for the day
    explanation: text("explanation").notNull().default(""), // markdown topic explanation
    completed: boolean("completed").notNull().default(false),
  },
  (t) => [index("exam_plan_days_plan_idx").on(t.planId)],
);

export const insertExamPlanSchema = createInsertSchema(examPlansTable).omit({
  id: true,
  dayCount: true,
  completedDayCount: true,
  createdAt: true,
});
export type InsertExamPlan = z.infer<typeof insertExamPlanSchema>;
export type ExamPlan = typeof examPlansTable.$inferSelect;

export const insertExamPlanDaySchema = createInsertSchema(examPlanDaysTable).omit({ id: true });
export type InsertExamPlanDay = z.infer<typeof insertExamPlanDaySchema>;
export type ExamPlanDay = typeof examPlanDaysTable.$inferSelect;
