import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

// Whop hosted-checkout sessions created for card payments.
// One row per checkout config; premium is granted only after the matching
// Whop payment is verified server-side. status: "created" | "completed"
export const whopCheckoutsTable = pgTable("whop_checkouts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  checkoutId: text("checkout_id").notNull().unique(), // ch_xxx
  planId: text("plan_id").notNull(),
  status: text("status").notNull().default("created"),
  whopPaymentId: text("whop_payment_id"), // pay_xxx once verified
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type WhopCheckout = typeof whopCheckoutsTable.$inferSelect;
