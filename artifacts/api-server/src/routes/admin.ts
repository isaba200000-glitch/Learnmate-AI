import { Router, type IRouter } from "express";
import { and, eq, desc, ilike, or, sql } from "drizzle-orm";
import { db, usersTable, paymentsTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";
import { signAdminToken, passwordMatches } from "../lib/adminToken";
import { isPremiumActive, getPlanSettings, updatePlanSettings } from "../lib/premium";
import { pruneOldConversations } from "./assistant";
import { pruneOldAnswers } from "./language";

const router: IRouter = Router();

// Simple in-memory brute-force guard for the admin login.
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

function tooManyAttempts(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

const toAdminPayment = (
  p: typeof paymentsTable.$inferSelect,
  user?: { name: string | null; email: string | null } | null,
) => ({
  id: p.id,
  userId: p.userId,
  userName: user?.name ?? null,
  userEmail: user?.email ?? null,
  trxId: p.trxId,
  senderNumber: p.senderNumber,
  amount: p.amount,
  plan: p.plan,
  status: p.status,
  reviewNote: p.reviewNote ?? null,
  reviewedAt: p.reviewedAt ? p.reviewedAt.toISOString() : null,
  createdAt: p.createdAt.toISOString(),
});

const toAdminUser = (u: typeof usersTable.$inferSelect) => ({
  userId: u.userId,
  name: u.name,
  email: u.email,
  isPremium: isPremiumActive(u.premiumExpiresAt),
  premiumExpiresAt: u.premiumExpiresAt ? u.premiumExpiresAt.toISOString() : null,
  createdAt: u.createdAt.toISOString(),
});

// ─── Auth ────────────────────────────────────────────────────────────────────

router.post("/admin/login", async (req, res): Promise<void> => {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    res.status(503).json({ error: "Admin password is not configured yet" });
    return;
  }

  const ip = req.ip ?? "unknown";
  if (tooManyAttempts(ip)) {
    res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." });
    return;
  }

  const { password } = req.body ?? {};
  if (!passwordMatches(password, expected)) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }

  attempts.delete(ip);
  res.json(signAdminToken());
});

router.get("/admin/session", requireAdmin, async (_req, res): Promise<void> => {
  res.json({ ok: true });
});

// ─── Payments queue ──────────────────────────────────────────────────────────

router.get("/admin/payments", requireAdmin, async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;

  const base = db
    .select({ payment: paymentsTable, name: usersTable.name, email: usersTable.email })
    .from(paymentsTable)
    .leftJoin(usersTable, eq(paymentsTable.userId, usersTable.userId));

  const rows = status
    ? await base.where(eq(paymentsTable.status, status)).orderBy(desc(paymentsTable.createdAt))
    : await base.orderBy(desc(paymentsTable.createdAt));

  res.json(rows.map((r) => toAdminPayment(r.payment, { name: r.name, email: r.email })));
});

// Sentinel used to roll back an approval when the student's row is gone.
class StudentMissingError extends Error {}

router.post("/admin/payments/:id/approve", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  const { days: premiumDays } = await getPlanSettings();

  try {
    const result = await db.transaction(async (tx) => {
      // Atomically claim the payment: only one concurrent approve can win.
      const [payment] = await tx
        .update(paymentsTable)
        .set({ status: "approved", reviewedAt: new Date(), reviewNote: null })
        .where(and(eq(paymentsTable.id, id), eq(paymentsTable.status, "pending")))
        .returning();
      if (!payment) return null;

      // Extend expiry in SQL so concurrent approvals stack instead of
      // overwriting each other with stale reads.
      const [user] = await tx
        .update(usersTable)
        .set({
          premiumExpiresAt: sql`GREATEST(COALESCE(${usersTable.premiumExpiresAt}, NOW()), NOW()) + make_interval(days => ${premiumDays})`,
        })
        .where(eq(usersTable.userId, payment.userId))
        .returning();
      if (!user) throw new StudentMissingError();

      return { payment, user };
    });

    if (!result) {
      const [existing] = await db
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.id, id))
        .limit(1);
      if (!existing) {
        res.status(404).json({ error: "Payment not found" });
      } else {
        res.status(409).json({ error: `This payment was already ${existing.status}` });
      }
      return;
    }

    res.json(toAdminPayment(result.payment, { name: result.user.name, email: result.user.email }));
  } catch (err) {
    if (err instanceof StudentMissingError) {
      res.status(404).json({ error: "The student who submitted this payment no longer exists" });
      return;
    }
    throw err;
  }
});

router.post("/admin/payments/:id/reject", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { note } = req.body ?? {};

  // Atomic guard: only a still-pending payment can be rejected.
  const [updated] = await db
    .update(paymentsTable)
    .set({
      status: "rejected",
      reviewedAt: new Date(),
      reviewNote: typeof note === "string" && note.trim() ? note.trim() : null,
    })
    .where(and(eq(paymentsTable.id, id), eq(paymentsTable.status, "pending")))
    .returning();

  if (!updated) {
    const [existing] = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Payment not found" });
    } else {
      res.status(409).json({ error: `This payment was already ${existing.status}` });
    }
    return;
  }

  const [user] = await db
    .select({ name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.userId, updated.userId))
    .limit(1);

  res.json(toAdminPayment(updated, user ?? null));
});

// ─── Stats ───────────────────────────────────────────────────────────────────

router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  const [paymentAgg] = await db
    .select({
      totalEarnings: sql<number>`COALESCE(SUM(${paymentsTable.amount}) FILTER (WHERE ${paymentsTable.status} = 'approved'), 0)::int`,
      monthEarnings: sql<number>`COALESCE(SUM(${paymentsTable.amount}) FILTER (WHERE ${paymentsTable.status} = 'approved' AND ${paymentsTable.reviewedAt} >= date_trunc('month', NOW())), 0)::int`,
      pendingPayments: sql<number>`COUNT(*) FILTER (WHERE ${paymentsTable.status} = 'pending')::int`,
    })
    .from(paymentsTable);

  const [userAgg] = await db
    .select({
      activePremiumStudents: sql<number>`COUNT(*) FILTER (WHERE ${usersTable.premiumExpiresAt} > NOW())::int`,
    })
    .from(usersTable);

  res.json({
    totalEarnings: paymentAgg?.totalEarnings ?? 0,
    monthEarnings: paymentAgg?.monthEarnings ?? 0,
    pendingPayments: paymentAgg?.pendingPayments ?? 0,
    activePremiumStudents: userAgg?.activePremiumStudents ?? 0,
  });
});

// ─── Users ───────────────────────────────────────────────────────────────────

router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

  const base = db.select().from(usersTable);
  const rows = search
    ? await base
        .where(or(ilike(usersTable.name, `%${search}%`), ilike(usersTable.email, `%${search}%`)))
        .orderBy(desc(usersTable.createdAt))
        .limit(500)
    : await base.orderBy(desc(usersTable.createdAt)).limit(500);

  res.json(rows.map(toAdminUser));
});

router.post("/admin/users/:userId/premium", requireAdmin, async (req, res): Promise<void> => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const { action, days } = req.body ?? {};

  if (action !== "grant" && action !== "revoke") {
    res.status(400).json({ error: "action must be grant or revoke" });
    return;
  }

  const { days: defaultDays } = await getPlanSettings();
  const grantDays = Math.min(3650, Math.max(1, Number(days) || defaultDays));

  // Atomic update: extend in SQL (no stale read) or clear on revoke.
  const [updated] = await db
    .update(usersTable)
    .set({
      premiumExpiresAt:
        action === "grant"
          ? sql`GREATEST(COALESCE(${usersTable.premiumExpiresAt}, NOW()), NOW()) + make_interval(days => ${grantDays})`
          : null,
    })
    .where(eq(usersTable.userId, userId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(toAdminUser(updated));
});

// ─── Settings ────────────────────────────────────────────────────────────────

router.get("/admin/settings", requireAdmin, async (_req, res): Promise<void> => {
  res.json(await getPlanSettings());
});

router.put("/admin/settings", requireAdmin, async (req, res): Promise<void> => {
  const { bkashNumber, price, days } = req.body ?? {};
  const current = await getPlanSettings();

  // Duration is the only setting still edited in the admin panel (students pay by
  // card via Whop now). bKash number/price are legacy: keep whatever is stored
  // unless a valid new value is explicitly sent — never block the save on them.
  const cleanDays = Number(days);
  if (!Number.isInteger(cleanDays) || cleanDays < 1 || cleanDays > 3650) {
    res.status(400).json({ error: "Duration must be between 1 and 3650 days" });
    return;
  }

  const cleanNumber =
    typeof bkashNumber === "string" ? bkashNumber.replace(/[\s-]/g, "") : "";
  const nextNumber = /^01\d{9}$/.test(cleanNumber) ? cleanNumber : current.bkashNumber;

  const cleanPrice = Number(price);
  const nextPrice =
    Number.isInteger(cleanPrice) && cleanPrice >= 1 && cleanPrice <= 1_000_000
      ? cleanPrice
      : current.price;

  const settings = { bkashNumber: nextNumber, price: nextPrice, days: cleanDays };
  await updatePlanSettings(settings);
  res.json(settings);
});

// ─── Scheduled jobs (exposed for external schedulers) ────────────────────────
//
// On Replit autoscale / Render free tier / any host that suspends after a
// short idle window, an in-process `setInterval` is unreliable — the process
// is killed before the interval fires. So the same jobs are exposed as
// admin-token-guarded HTTP endpoints that an external cron / scheduled
// deployment can hit (e.g. Replit Scheduled Deployment, GitHub Actions,
// Upstash QStash, EasyCron, etc.) once per day.
//
// The boot-time in-process setInterval is kept as a best-effort fallback so
// long-running hosts still get the cleanup without needing to configure
// anything external.

router.post("/admin/jobs/prune-old-data", requireAdmin, async (_req, res): Promise<void> => {
  const startedAt = Date.now();
  const conversations = await pruneOldConversations();
  const answers = await pruneOldAnswers();
  res.json({
    conversationsPruned: conversations,
    answersPruned: answers,
    elapsedMs: Date.now() - startedAt,
  });
});

export default router;
