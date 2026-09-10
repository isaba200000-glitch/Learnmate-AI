import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  userId: text("user_id").primaryKey(),
  name: text("name").notNull().default("Learner"),
  email: text("email").notNull().default(""),
  photoUrl: text("photo_url"),
  country: text("country"),
  educationLevel: text("education_level"),
  subjects: text("subjects").array().notNull().default([]),
  goals: text("goals"),
  learningLanguage: text("learning_language"),
  xp: integer("xp").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  level: integer("level").notNull().default(1),
  coins: integer("coins").notNull().default(0),
  premiumExpiresAt: timestamp("premium_expires_at", { withTimezone: true }),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
