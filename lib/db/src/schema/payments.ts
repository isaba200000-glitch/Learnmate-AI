import { pgTable, text, serial, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Manual bKash payment submissions awaiting owner verification.
// status: "pending" | "approved" | "rejected"
export const paymentsTable = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    trxId: text("trx_id").notNull().unique(),
    senderNumber: text("sender_number").notNull(),
    amount: integer("amount").notNull(),
    plan: text("plan").notNull().default("premium_monthly"),
    status: text("status").notNull().default("pending"),
    reviewNote: text("review_note"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    // At most one pending payment per student, enforced at the DB level so
    // concurrent submissions cannot slip past the application pre-check.
    onePendingPerUser: uniqueIndex("payments_one_pending_per_user_idx")
      .on(t.userId)
      .where(sql`${t.status} = 'pending'`),
  }),
);

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
