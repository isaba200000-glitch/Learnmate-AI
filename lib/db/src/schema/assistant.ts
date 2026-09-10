import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// AI Study Assistant chat: conversations + messages, and per-day question
// usage for free-tier limiting (Asia/Dhaka day, like language practice).

export const assistantConversationsTable = pgTable(
  "assistant_conversations",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.userId, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("assistant_conversations_user_idx").on(t.userId),
    index("assistant_conversations_updated_idx").on(t.updatedAt),
  ],
);

export const assistantMessagesTable = pgTable(
  "assistant_messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => assistantConversationsTable.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assistant_messages_conversation_idx").on(t.conversationId)],
);

export const assistantUsageTable = pgTable(
  "assistant_usage",
  {
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.userId, { onDelete: "cascade" }),
    day: text("day").notNull(), // YYYY-MM-DD in Asia/Dhaka
    questionsUsed: integer("questions_used").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);

export type AssistantConversation = typeof assistantConversationsTable.$inferSelect;
export type AssistantMessage = typeof assistantMessagesTable.$inferSelect;
