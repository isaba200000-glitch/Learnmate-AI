import {
  pgTable,
  serial,
  integer,
  text,
  date,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

// One row per (exam, subscription, reminder offset, calendar date).
// Granularity is per-subscription so a transient failure on one device
// doesn't suppress the retry for that device the next time the job runs.
// Records are inserted ONLY after a successful webpush.sendNotification —
// a failed send leaves no row, so the next job invocation retries it.
export const pushReminderLogsTable = pgTable(
  "push_reminder_logs",
  {
    id: serial("id").primaryKey(),
    examId: integer("exam_id").notNull(),
    subscriptionId: integer("subscription_id").notNull(),
    userId: text("user_id").notNull(),
    reminderDays: integer("reminder_days").notNull(),
    sentDate: date("sent_date").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Idempotency key: each (exam, device, days-before, calendar-day) fires at most once.
    unique("push_reminder_logs_unique").on(
      table.examId,
      table.subscriptionId,
      table.reminderDays,
      table.sentDate,
    ),
  ],
);
