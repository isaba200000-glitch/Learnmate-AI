import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Simple key-value store for owner-editable app settings
// (e.g. bKash number, premium price, premium duration).
export const settingsTable = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Setting = typeof settingsTable.$inferSelect;
