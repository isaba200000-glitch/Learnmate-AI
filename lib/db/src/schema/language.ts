import { pgTable, text, serial, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Daily practice time ─────────────────────────────────────────────────────
// One row per student per (Dhaka-local) day. `secondsUsed` is advanced by the
// heartbeat endpoint with SQL-side math — never read-then-write.
export const languageUsageTable = pgTable(
  "language_usage",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    day: text("day").notNull(), // YYYY-MM-DD in Asia/Dhaka
    secondsUsed: integer("seconds_used").notNull().default(0),
    lastTickAt: timestamp("last_tick_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    oneRowPerUserDay: uniqueIndex("language_usage_user_day_idx").on(t.userId, t.day),
  }),
);

// ─── Lifetime practice progress ──────────────────────────────────────────────
export const languageProgressTable = pgTable("language_progress", {
  userId: text("user_id").primaryKey(),
  streak: integer("streak").notNull().default(0),
  bestStreak: integer("best_streak").notNull().default(0),
  lastActiveDay: text("last_active_day"), // YYYY-MM-DD in Asia/Dhaka
  exercisesCompleted: integer("exercises_completed").notNull().default(0),
  correctAnswers: integer("correct_answers").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ─── Vocabulary the student has learned ──────────────────────────────────────
export const languageWordsTable = pgTable(
  "language_words",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    word: text("word").notNull(),
    language: text("language").notNull().default("English"),
    meaning: text("meaning").notNull().default(""),
    meaningBangla: text("meaning_bangla").notNull().default(""),
    example: text("example").notNull().default(""),
    learnedAt: timestamp("learned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    oneWordPerUser: uniqueIndex("language_words_user_word_lang_idx").on(t.userId, t.word, t.language),
  }),
);

// ─── Per-answer log ──────────────────────────────────────────────────────────
// One row per graded exercise answer. Recent rows (per language + difficulty)
// drive automatic "level up / level down" suggestions.
export const languageAnswersTable = pgTable("language_answers", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  language: text("language").notNull().default("English"),
  difficulty: text("difficulty").notNull().default("intermediate"), // beginner | intermediate | advanced
  correct: integer("correct").notNull(), // 1 = correct, 0 = wrong
  answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLanguageUsageSchema = createInsertSchema(languageUsageTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLanguageUsage = z.infer<typeof insertLanguageUsageSchema>;
export type LanguageUsage = typeof languageUsageTable.$inferSelect;

export const insertLanguageProgressSchema = createInsertSchema(languageProgressTable).omit({
  updatedAt: true,
});
export type InsertLanguageProgress = z.infer<typeof insertLanguageProgressSchema>;
export type LanguageProgress = typeof languageProgressTable.$inferSelect;

export const insertLanguageWordSchema = createInsertSchema(languageWordsTable).omit({
  id: true,
  learnedAt: true,
});
export type InsertLanguageWord = z.infer<typeof insertLanguageWordSchema>;
export type LanguageWord = typeof languageWordsTable.$inferSelect;

export const insertLanguageAnswerSchema = createInsertSchema(languageAnswersTable).omit({
  id: true,
  answeredAt: true,
});
export type InsertLanguageAnswer = z.infer<typeof insertLanguageAnswerSchema>;
export type LanguageAnswer = typeof languageAnswersTable.$inferSelect;
