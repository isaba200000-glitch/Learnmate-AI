import { pgTable, serial, text, integer, timestamp, unique } from "drizzle-orm/pg-core";

// Shared AI-generated lesson content cache (same content for all students)
export const courseLessonCacheTable = pgTable(
  "course_lesson_cache",
  {
    id: serial("id").primaryKey(),
    topic: text("topic").notNull(),
    lessonIndex: integer("lesson_index").notNull(),
    content: text("content").notNull(),
    imageUrl: text("image_url"), // nullable — AI illustration generated on first view
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("course_lesson_cache_topic_lesson_idx").on(t.topic, t.lessonIndex)],
);

// AI-generated hero image per course topic (generated once, cached globally)
export const courseTopicImagesTable = pgTable("course_topic_images", {
  id: serial("id").primaryKey(),
  topicSlug: text("topic_slug").notNull().unique(),
  imageUrl: text("image_url").notNull(), // base64 data URL (data:image/png;base64,…)
  photographerName: text("photographer_name"), // Pexels attribution (nullable — curated fallbacks have none)
  photographerUrl: text("photographer_url"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});

// AI-generated illustration per lesson — kept separate from courseLessonCacheTable
// so image generation never touches the content cache and cannot corrupt it.
export const courseLessonImagesTable = pgTable(
  "course_lesson_images",
  {
    id: serial("id").primaryKey(),
    topic: text("topic").notNull(),
    lessonIndex: integer("lesson_index").notNull(),
    imageUrl: text("image_url").notNull(), // base64 data URL
    photographerName: text("photographer_name"), // Pexels attribution (nullable)
    photographerUrl: text("photographer_url"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("course_lesson_images_topic_lesson_idx").on(t.topic, t.lessonIndex)],
);

// Step-by-step visual guide images per lesson (concept → process → real-world)
// Three images per lesson stored with stepNumber 0, 1, 2 and a human-readable label.
export const courseLessonStepImagesTable = pgTable(
  "course_lesson_step_images",
  {
    id: serial("id").primaryKey(),
    topic: text("topic").notNull(),
    lessonIndex: integer("lesson_index").notNull(),
    stepNumber: integer("step_number").notNull(), // 0 = Concept, 1 = How It Works, 2 = Real-World Use
    stepLabel: text("step_label").notNull(),
    imageUrl: text("image_url").notNull(), // base64 data URL
    photographerName: text("photographer_name"), // Pexels attribution (nullable)
    photographerUrl: text("photographer_url"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("course_lesson_step_images_uq").on(t.topic, t.lessonIndex, t.stepNumber)],
);

// Per-student lesson completion tracking
export const courseProgressTable = pgTable(
  "course_progress",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    topic: text("topic").notNull(),
    lessonIndex: integer("lesson_index").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("course_progress_user_topic_lesson_idx").on(t.userId, t.topic, t.lessonIndex)],
);

// Daily lesson usage for free-tier limiting
export const courseUsageTable = pgTable(
  "course_usage",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    day: text("day").notNull(), // "YYYY-MM-DD" in Asia/Dhaka
    lessonsGenerated: integer("lessons_generated").notNull().default(0),
  },
  (t) => [unique("course_usage_user_day_idx").on(t.userId, t.day)],
);
