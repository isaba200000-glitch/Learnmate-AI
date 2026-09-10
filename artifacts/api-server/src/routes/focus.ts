import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db, usersTable, focusSessionsTable, type FocusSession } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { isPremiumActive } from "../lib/premium";
import { isOwnerRequest } from "../lib/owner";

const router: IRouter = Router();

// ─── Tiers & limits ──────────────────────────────────────────────────────────

const FREE_MAX_MINUTES = 30;
const PREMIUM_MAX_MINUTES = 120;
const MIN_MINUTES = 5;
export const STRICT_MAX_DISTRACTIONS = 3; // always-on 3-strike rule: reaching this = failed
const HISTORY_LIMIT = 50;

type Tier = "free" | "premium" | "owner";

async function tierOf(req: Parameters<typeof isOwnerRequest>[0], userId: string): Promise<Tier> {
  if (await isOwnerRequest(req)) return "owner";
  const [user] = await db
    .select({ premiumExpiresAt: usersTable.premiumExpiresAt })
    .from(usersTable)
    .where(eq(usersTable.userId, userId))
    .limit(1);
  return isPremiumActive(user?.premiumExpiresAt) ? "premium" : "free";
}

function limitsFor(tier: Tier) {
  const premiumish = tier !== "free";
  return {
    plan: tier,
    maxMinutes: premiumish ? PREMIUM_MAX_MINUTES : FREE_MAX_MINUTES,
    strictAllowed: premiumish,
    historyAllowed: premiumish,
  };
}

const toSession = (s: FocusSession) => ({
  id: s.id,
  plannedMinutes: s.plannedMinutes,
  focusedSeconds: s.focusedSeconds,
  distractions: s.distractions,
  score: s.score,
  strict: s.strict,
  failed: s.failed,
  completedAt: s.completedAt.toISOString(),
});

// Streaks: consecutive calendar days (Asia/Dhaka, matching the rest of the app)
// with at least one non-failed session, counting back from today/yesterday.
function computeStreaks(days: string[]): { streak: number; bestStreak: number } {
  if (days.length === 0) return { streak: 0, bestStreak: 0 };
  const sorted = [...new Set(days)].sort(); // ascending YYYY-MM-DD
  const dayMs = 86_400_000;
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const gap = (Date.parse(sorted[i]) - Date.parse(sorted[i - 1])) / dayMs;
    run = gap === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
  const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(
    new Date(Date.now() - dayMs),
  );
  const last = sorted[sorted.length - 1];
  if (last !== today && last !== yesterday) return { streak: 0, bestStreak: best };
  // count backwards from the last day
  let streak = 1;
  for (let i = sorted.length - 1; i > 0; i--) {
    if ((Date.parse(sorted[i]) - Date.parse(sorted[i - 1])) / dayMs === 1) streak++;
    else break;
  }
  return { streak, bestStreak: best };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

router.get("/focus/overview", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const tier = await tierOf(req, userId);
  const limits = limitsFor(tier);

  const [todayRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(focusSessionsTable)
    .where(
      sql`${focusSessionsTable.userId} = ${userId} AND (${focusSessionsTable.completedAt} AT TIME ZONE 'Asia/Dhaka')::date = (now() AT TIME ZONE 'Asia/Dhaka')::date`,
    );
  const todaySessions = todayRow?.n ?? 0;

  if (!limits.historyAllowed) {
    res.json({ limits, todaySessions, stats: null, sessions: [] });
    return;
  }

  const sessions = await db
    .select()
    .from(focusSessionsTable)
    .where(eq(focusSessionsTable.userId, userId))
    .orderBy(desc(focusSessionsTable.completedAt))
    .limit(HISTORY_LIMIT);

  const [agg] = await db
    .select({
      totalSessions: sql<number>`count(*)::int`,
      totalFocusedMinutes: sql<number>`coalesce(round(sum(${focusSessionsTable.focusedSeconds}) / 60.0), 0)::int`,
      avgScore: sql<number>`coalesce(round(avg(${focusSessionsTable.score})), 0)::int`,
    })
    .from(focusSessionsTable)
    .where(eq(focusSessionsTable.userId, userId));

  const dayRows = await db
    .select({
      day: sql<string>`to_char(${focusSessionsTable.completedAt} AT TIME ZONE 'Asia/Dhaka', 'YYYY-MM-DD')`,
    })
    .from(focusSessionsTable)
    .where(sql`${focusSessionsTable.userId} = ${userId} AND NOT ${focusSessionsTable.failed}`);

  const { streak, bestStreak } = computeStreaks(dayRows.map((r) => r.day));

  res.json({
    limits,
    todaySessions,
    stats: {
      totalSessions: agg?.totalSessions ?? 0,
      totalFocusedMinutes: agg?.totalFocusedMinutes ?? 0,
      avgScore: agg?.avgScore ?? 0,
      streak,
      bestStreak,
    },
    sessions: sessions.map(toSession),
  });
});

router.post("/focus/sessions", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const { plannedMinutes, focusedSeconds, distractions, strict } = req.body ?? {};

  const tier = await tierOf(req, userId);
  const limits = limitsFor(tier);

  const planned = Number(plannedMinutes);
  if (!Number.isInteger(planned) || planned < MIN_MINUTES || planned > limits.maxMinutes) {
    res.status(400).json({
      error:
        planned > limits.maxMinutes
          ? `Sessions longer than ${limits.maxMinutes} minutes are a Premium feature.`
          : `Session length must be between ${MIN_MINUTES} and ${limits.maxMinutes} minutes.`,
    });
    return;
  }
  const focused = Number(focusedSeconds);
  if (!Number.isInteger(focused) || focused < 0 || focused > planned * 60 + 60) {
    res.status(400).json({ error: "Invalid focused time for this session." });
    return;
  }
  const distracted = Number(distractions);
  if (!Number.isInteger(distracted) || distracted < 0 || distracted > 1000) {
    res.status(400).json({ error: "Invalid distraction count." });
    return;
  }
  // The 3-strike rule is now always on for everyone — every session counts as
  // strict, regardless of tier or what the client sends.
  void strict;
  const isStrict = true;

  // Sanitize first (clock skew can report slightly over the planned time),
  // then compute the score exclusively from the sanitized value that is stored.
  const effectiveFocused = Math.min(focused, planned * 60);

  // Score: share of the planned time actually focused, minus a penalty per
  // distraction. Strict sessions fail after too many distractions.
  const failed = distracted >= STRICT_MAX_DISTRACTIONS;
  const score = failed
    ? 0
    : Math.max(
        0,
        Math.min(100, Math.round((effectiveFocused / (planned * 60)) * 100) - distracted * 5),
      );

  const [session] = await db
    .insert(focusSessionsTable)
    .values({
      userId,
      plannedMinutes: planned,
      focusedSeconds: effectiveFocused,
      distractions: distracted,
      score,
      strict: isStrict,
      failed,
    })
    .returning();

  res.status(201).json(toSession(session));
});

export default router;
