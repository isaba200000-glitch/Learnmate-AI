import { pgTable, text, serial, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const quizSessionsTable = pgTable("quiz_sessions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  subject: text("subject").notNull(),
  examType: text("exam_type"),
  totalQuestions: integer("total_questions").notNull(),
  correctAnswers: integer("correct_answers"),
  score: real("score"),
  source: text("source").notNull().default("manual"), // "manual" | "photo"
  status: text("status").notNull().default("pending"),
  // The photographed page (for source = "photo"), stored as a data: URL.
  // Persisted so the student can review the original material alongside the
  // AI-generated questions. null for non-photo quizzes.
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const quizQuestionsTable = pgTable("quiz_questions", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  question: text("question").notNull(),
  type: text("type").notNull().default("multiple_choice"),
  options: text("options").array().notNull().default([]),
  correctAnswer: text("correct_answer").notNull(),
  userAnswer: text("user_answer"),
  explanation: text("explanation"),
  isCorrect: boolean("is_correct"),
});

export const insertQuizSessionSchema = createInsertSchema(quizSessionsTable).omit({ id: true, correctAnswers: true, score: true, completedAt: true, createdAt: true });
export type InsertQuizSession = z.infer<typeof insertQuizSessionSchema>;
export type QuizSession = typeof quizSessionsTable.$inferSelect;

export const insertQuizQuestionSchema = createInsertSchema(quizQuestionsTable).omit({ id: true, userAnswer: true, isCorrect: true });
export type InsertQuizQuestion = z.infer<typeof insertQuizQuestionSchema>;
export type QuizQuestion = typeof quizQuestionsTable.$inferSelect;
