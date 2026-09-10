import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import webpush from "web-push";
import {
  db,
  pushSubscriptionsTable,
  pushReminderLogsTable,
  examEventsTable,
} from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { verifyAdminToken } from "../lib/adminToken";
import type { Request, Response, NextFunction } from "express";

// ── Admin token middleware ───────────────────────────────────────────────────
function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  const token =
    (req.headers["x-admin-token"] as string | undefined) ??
    (req.query["adminToken"] as string | undefined);
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: "Invalid or missing admin token." });
    return;
  }
  next();
}

// ── VAPID setup ──────────────────────────────────────────────────────────────
// Keep only valid URL-safe base64 characters — strips spaces, newlines, "=", etc.
function cleanVapidKey(key: string): string {
  return key.replace(/[^A-Za-z0-9\-_]/g, "");
}

const VAPID_PUBLIC_KEY  = cleanVapidKey(process.env.VAPID_PUBLIC_KEY  ?? "");
const VAPID_PRIVATE_KEY = cleanVapidKey(process.env.VAPID_PRIVATE_KEY ?? "");
const VAPID_SUBJECT     = process.env.VAPID_SUBJECT ?? "mailto:admin@learnmate.app";

let vapidReady = false;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    vapidReady = true;
  } catch (err) {
    console.error(
      "[push] VAPID setup failed — push notifications disabled:",
      err instanceof Error ? err.message : err,
    );
  }
}

const router: IRouter = Router();

// ── POST /api/push/subscribe ─────────────────────────────────────────────────
router.post("/push/subscribe", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const { endpoint, keys } = req.body ?? {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: "endpoint and keys (p256dh, auth) are required." });
    return;
  }

  await db
    .insert(pushSubscriptionsTable)
    .values({ userId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
    .onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set: { userId, p256dh: keys.p256dh, auth: keys.auth },
    });

  res.json({ ok: true });
});

// ── DELETE /api/push/unsubscribe ─────────────────────────────────────────────
router.delete("/push/unsubscribe", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const { endpoint } = req.body ?? {};
  if (endpoint) {
    await db
      .delete(pushSubscriptionsTable)
      .where(
        and(
          eq(pushSubscriptionsTable.userId, userId),
          eq(pushSubscriptionsTable.endpoint, endpoint),
        ),
      );
  } else {
    await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userId, userId));
  }
  res.json({ ok: true });
});

// ── GET /api/push/vapid-public-key ───────────────────────────────────────────
router.get("/push/vapid-public-key", (_req, res): void => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// ── POST /api/push/send-exam-reminders ──────────────────────────────────────
// Admin-only trigger (also called internally by the daily scheduler).
router.post("/push/send-exam-reminders", requireAdminToken, async (_req, res): Promise<void> => {
  if (!vapidReady) {
    res.status(503).json({ error: "Push notifications not configured (VAPID keys missing or invalid)." });
    return;
  }
  const { sent, failed, skipped } = await sendExamReminders();
  res.json({ ok: true, sent, failed, skipped });
});

export default router;

// ── Core reminder logic (idempotent) ─────────────────────────────────────────
//
// Each (examId, reminderDays, sentDate) triple is guarded by a unique DB
// constraint in push_reminder_logs.  An INSERT conflict means the reminder
// was already dispatched for this calendar day — skip it.  This makes the
// function safe to call multiple times per day (server restarts, duplicate
// invocations) without sending duplicate notifications.
//
// ── sendExamReminders ────────────────────────────────────────────────────────
// Idempotency: granularity is (exam × subscription × days-before × calendar-day).
// A log row is inserted ONLY after webpush.sendNotification succeeds.
// A transient failure leaves no row, so the next invocation retries that
// (exam, device) pair.  A permanent 410 cleans up the stale subscription.
// This function is safe to call multiple times per day (e.g. after restart).
export async function sendExamReminders(): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  if (!vapidReady) return { sent: 0, failed: 0, skipped: 0 };

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const todayStr = now.toISOString().slice(0, 10); // "YYYY-MM-DD"

  const REMINDER_DAYS = [1, 3, 7];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const days of REMINDER_DAYS) {
    const target = new Date(now);
    target.setDate(target.getDate() + days);
    const targetStr = target.toISOString().slice(0, 10);

    const exams = await db
      .select()
      .from(examEventsTable)
      .where(eq(examEventsTable.examDate, targetStr));

    for (const exam of exams) {
      const subs = await db
        .select()
        .from(pushSubscriptionsTable)
        .where(eq(pushSubscriptionsTable.userId, exam.userId));

      if (subs.length === 0) continue;

      const label = days === 1 ? "tomorrow" : `in ${days} days`;
      const payload = JSON.stringify({
        title: `📚 Exam reminder: ${exam.subject}`,
        body: `Your ${exam.subject} exam is ${label}. Stay focused!`,
        url: "/learnmate/exam-calendar",
      });

      for (const sub of subs) {
        // ── Per-subscription idempotency check ───────────────────────────
        // Query first — if already sent today for this (exam, device, offset),
        // skip without attempting delivery.
        const existing = await db
          .select({ id: pushReminderLogsTable.id })
          .from(pushReminderLogsTable)
          .where(
            and(
              eq(pushReminderLogsTable.examId, exam.id),
              eq(pushReminderLogsTable.subscriptionId, sub.id),
              eq(pushReminderLogsTable.reminderDays, days),
              eq(pushReminderLogsTable.sentDate, todayStr),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        // ── Attempt delivery ─────────────────────────────────────────────
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );

          // Record success AFTER the send — a failed send leaves no row so
          // the next invocation will retry this (exam, device) pair.
          await db
            .insert(pushReminderLogsTable)
            .values({
              examId: exam.id,
              subscriptionId: sub.id,
              userId: exam.userId,
              reminderDays: days,
              sentDate: todayStr,
            })
            .onConflictDoNothing(); // safety net for rare concurrent calls

          sent++;
        } catch (err: any) {
          failed++;
          if (err?.statusCode === 410) {
            // Subscription expired — remove it; future runs will ignore it.
            await db
              .delete(pushSubscriptionsTable)
              .where(eq(pushSubscriptionsTable.id, sub.id));
          }
        }
      }
    }
  }

  return { sent, failed, skipped };
}
