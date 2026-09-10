import { Router, type IRouter } from "express";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  examPlansTable,
  examPlanDaysTable,
  type ExamPlan,
  type ExamPlanDay,
} from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { openai, PREMIUM_AI_MODEL } from "../lib/openai";
import { isPremiumActive } from "../lib/premium";
import { isOwnerRequest } from "../lib/owner";

const router: IRouter = Router();

// ─── Tiers & limits ──────────────────────────────────────────────────────────

const BATCHES = ["gcse", "a-level", "ssc", "hsc"] as const;
type Batch = (typeof BATCHES)[number];

const BATCH_CONTEXT: Record<Batch, string> = {
  gcse: "GCSE (UK secondary, exam boards like AQA/Edexcel/OCR; grades 9-1; focus on spec-point coverage, past-paper practice and mark-scheme technique)",
  "a-level": "A Level (UK advanced; AQA/Edexcel/OCR; deep subject mastery, essay/long-answer technique, synoptic links between topics)",
  ssc: "SSC (Bangladesh Secondary School Certificate, NCTB syllabus; board-question patterns, creative questions (সৃজনশীল) and MCQs; students often study in Bangla with English terms)",
  hsc: "HSC (Bangladesh Higher Secondary Certificate, NCTB syllabus; board-question patterns, creative questions (সৃজনশীল) and MCQs; heavier syllabus, students often study in Bangla with English terms)",
};

type Tier = "free" | "premium" | "owner";

const FREE_MAX_ACTIVE_PLANS = 1;
const FREE_LIMIT_MESSAGE =
  "Free accounts can have 1 active exam plan. Upgrade to Premium for unlimited plans, longer schedules and deeper explanations.";
const FREE_MAX_HORIZON_DAYS = 14;
const PREMIUM_MAX_HORIZON_DAYS = 30;

async function tierOf(req: Parameters<typeof isOwnerRequest>[0], userId: string): Promise<Tier> {
  if (await isOwnerRequest(req)) return "owner";
  const [user] = await db
    .select({ premiumExpiresAt: usersTable.premiumExpiresAt })
    .from(usersTable)
    .where(eq(usersTable.userId, userId))
    .limit(1);
  return isPremiumActive(user?.premiumExpiresAt) ? "premium" : "free";
}

function limitsFor(tier: Tier, activePlans: number) {
  const premiumish = tier !== "free";
  return {
    plan: tier,
    maxActivePlans: premiumish ? null : FREE_MAX_ACTIVE_PLANS,
    maxHorizonDays: premiumish ? PREMIUM_MAX_HORIZON_DAYS : FREE_MAX_HORIZON_DAYS,
    canCreate: premiumish || activePlans < FREE_MAX_ACTIVE_PLANS,
    canRegenerate: premiumish,
  };
}

async function countActivePlans(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(examPlansTable)
    .where(and(eq(examPlansTable.userId, userId), eq(examPlansTable.status, "active")));
  return row?.n ?? 0;
}

// ─── Serialization ───────────────────────────────────────────────────────────

const toPlan = (p: ExamPlan) => ({
  id: p.id,
  batch: p.batch,
  title: p.title,
  examDate: p.examDate,
  subjects: p.subjects,
  weakTopics: p.weakTopics,
  status: p.status,
  dayCount: p.dayCount,
  completedDayCount: p.completedDayCount,
  createdAt: p.createdAt.toISOString(),
});

const toDay = (d: ExamPlanDay) => ({
  id: d.id,
  dayIndex: d.dayIndex,
  date: d.date,
  subject: d.subject,
  topic: d.topic,
  focus: d.focus,
  explanation: d.explanation,
  completed: d.completed,
});

// ─── AI schedule generation ──────────────────────────────────────────────────

interface GeneratedDay {
  subject: string;
  topic: string;
  focus: string;
  explanation: string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Study days: today through the day before the exam, capped to the tier horizon. */
function scheduleDates(examDate: string, horizonDays: number): string[] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const exam = new Date(`${examDate}T00:00:00Z`);
  const daysUntil = Math.floor((exam.getTime() - today.getTime()) / 86_400_000);
  const n = Math.min(Math.max(daysUntil, 1), horizonDays);
  return Array.from({ length: n }, (_, i) => isoDate(new Date(today.getTime() + i * 86_400_000)));
}

async function generateSchedule(opts: {
  batch: Batch;
  subjects: string[];
  weakTopics: string[];
  examDate: string;
  dates: string[];
  deep: boolean;
  adjustment?: string;
}): Promise<GeneratedDay[]> {
  const { batch, subjects, weakTopics, examDate, dates, deep } = opts;

  const explanationRule = deep
    ? "For each day write a high-quality markdown explanation of the topic (~150-250 words): what the topic is, the key ideas/formulas/definitions in **bold**, one worked example or exam-style pointer, and a common mistake to avoid."
    : "For each day write a short, clear explanation of the topic (2-4 sentences): what it is and the most important points to revise.";

  const weakNote = weakTopics.length
    ? `The student is WEAK in these topics — schedule them earlier and more often, with extra-careful explanations: ${weakTopics.join("; ")}.`
    : "";
  const adjustNote = opts.adjustment ? `Adjustment requested by the student: ${opts.adjustment}.` : "";

  const completion = await openai.chat.completions.create({
    model:  "openai/gpt-oss-120b",
    max_tokens: 6000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are LearnMate AI's exam planner, an expert tutor who builds realistic day-by-day revision schedules. You respond ONLY with valid JSON.",
      },
      {
        role: "user",
        content:
          `Build a day-by-day revision schedule for a ${BATCH_CONTEXT[batch]} student. ` +
          `Exam date: ${examDate}. Subjects: ${subjects.join(", ")}. ${weakNote} ${adjustNote}\n` +
          `The schedule has EXACTLY ${dates.length} study days (I will assign the dates). ` +
          `Rotate subjects sensibly, put harder/weak topics earlier with revisits, and make the final days revision/past-paper style. ` +
          `If you run out of genuinely new topics before the days run out, don't reuse the exact same title and description — create a fresh revision angle each time (e.g. "Practice Problems: [topic]", "Past Paper Review: [topic]", "Common Mistakes in [topic]").\n` +
          `Pick real topics from this batch's typical syllabus for each subject. ${explanationRule}\n` +
          `Respond as JSON exactly matching: {"days":[{"subject":"...","topic":"...","focus":"one-line goal for the day","explanation":"..."}]} ` +
          `with exactly ${dates.length} items in order.`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("unparseable AI response");
  }
  const days = (parsed as { days?: unknown }).days;
  if (!Array.isArray(days) || days.length === 0) throw new Error("AI returned no days");

  const cleaned = days
    .filter(
      (d): d is Record<string, unknown> =>
        !!d && typeof (d as { subject?: unknown }).subject === "string" && typeof (d as { topic?: unknown }).topic === "string",
    )
    .map((d) => ({
      subject: String(d.subject),
      topic: String(d.topic),
      focus: typeof d.focus === "string" ? d.focus : "",
      explanation: typeof d.explanation === "string" ? d.explanation : "",
    }));
  if (cleaned.length === 0) throw new Error("AI returned no usable days");
  // Tolerate small count mismatches: trim extras, or repeat the revision-style
  // last day if the AI came up short.
  while (cleaned.length < opts.dates.length) cleaned.push(cleaned[cleaned.length - 1]);
  return cleaned.slice(0, opts.dates.length);
}

// ─── Routes ──────────────────────────────────────────────────────────────────

router.get("/exam-plans", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const [plans, tier] = await Promise.all([
    db.select().from(examPlansTable).where(eq(examPlansTable.userId, userId)).orderBy(desc(examPlansTable.createdAt)),
    tierOf(req, userId),
  ]);
  const active = plans.filter((p) => p.status === "active").length;
  res.json({ plans: plans.map(toPlan), limits: limitsFor(tier, active) });
});

router.post("/exam-plans", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const { batch, subjects, examDate, weakTopics, title } = req.body ?? {};

  if (!BATCHES.includes(batch)) {
    res.status(400).json({ error: "Please pick your batch: GCSE, A Level, SSC or HSC" });
    return;
  }
  const cleanSubjects = Array.isArray(subjects)
    ? subjects.map((s) => String(s).trim()).filter(Boolean).slice(0, 8)
    : [];
  if (cleanSubjects.length === 0) {
    res.status(400).json({ error: "Please add at least one subject" });
    return;
  }
  if (typeof examDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(examDate)) {
    res.status(400).json({ error: "Please pick your exam date" });
    return;
  }
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (new Date(`${examDate}T00:00:00Z`).getTime() <= today.getTime()) {
    res.status(400).json({ error: "The exam date must be in the future" });
    return;
  }
  const cleanWeak = Array.isArray(weakTopics)
    ? weakTopics.map((s) => String(s).trim()).filter(Boolean).slice(0, 15)
    : [];

  const tier = await tierOf(req, userId);
  // Fast pre-check so free users at the limit don't pay for an AI call; the
  // authoritative, race-proof check happens inside the insert transaction below.
  if (tier === "free" && (await countActivePlans(userId)) >= FREE_MAX_ACTIVE_PLANS) {
    res.status(403).json({ error: FREE_LIMIT_MESSAGE });
    return;
  }

  const limits = limitsFor(tier, 0);
  const dates = scheduleDates(examDate, limits.maxHorizonDays);

  let generated: GeneratedDay[];
  try {
    generated = await generateSchedule({
      batch,
      subjects: cleanSubjects,
      weakTopics: cleanWeak,
      examDate,
      dates,
      deep: tier !== "free",
    });
  } catch (err) {
    req.log.error({ err }, "exam plan generation failed");
    res.status(502).json({ error: "AI plan generation failed. Please try again." });
    return;
  }

  const planTitle =
    typeof title === "string" && title.trim()
      ? title.trim().slice(0, 120)
      : `${batch.toUpperCase().replace("A-LEVEL", "A Level")} plan — ${cleanSubjects.slice(0, 3).join(", ")}`;

  // Atomic insert: for free users, take a per-user advisory lock inside the
  // transaction and recheck the active-plan count under it, so concurrent
  // create requests cannot both slip past the limit.
  let created: { plan: ExamPlan; days: ExamPlanDay[] } | null = null;
  await db.transaction(async (tx) => {
    if (tier === "free") {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`exam-plans:${userId}`}))`);
      const [row] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(examPlansTable)
        .where(and(eq(examPlansTable.userId, userId), eq(examPlansTable.status, "active")));
      if ((row?.n ?? 0) >= FREE_MAX_ACTIVE_PLANS) return; // limit hit under lock
    }
    const [plan] = await tx
      .insert(examPlansTable)
      .values({
        userId,
        batch,
        title: planTitle,
        examDate,
        subjects: cleanSubjects,
        weakTopics: cleanWeak,
        status: "active",
        dayCount: generated.length,
        completedDayCount: 0,
      })
      .returning();
    const dayRows = await tx
      .insert(examPlanDaysTable)
      .values(
        generated.map((g, i) => ({
          planId: plan.id,
          dayIndex: i + 1,
          date: dates[i],
          subject: g.subject,
          topic: g.topic,
          focus: g.focus,
          explanation: g.explanation,
        })),
      )
      .returning();
    created = { plan, days: dayRows };
  });

  if (!created) {
    res.status(403).json({ error: FREE_LIMIT_MESSAGE });
    return;
  }
  const { plan, days } = created as { plan: ExamPlan; days: ExamPlanDay[] };
  res.status(201).json({ plan: toPlan(plan), days: days.map(toDay) });
});

async function ownPlan(userId: string, planId: number): Promise<ExamPlan | null> {
  if (!Number.isInteger(planId)) return null;
  const [plan] = await db
    .select()
    .from(examPlansTable)
    .where(and(eq(examPlansTable.id, planId), eq(examPlansTable.userId, userId)))
    .limit(1);
  return plan ?? null;
}

router.get("/exam-plans/:planId", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const plan = await ownPlan(userId, Number(req.params.planId));
  if (!plan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }
  const days = await db
    .select()
    .from(examPlanDaysTable)
    .where(eq(examPlanDaysTable.planId, plan.id))
    .orderBy(asc(examPlanDaysTable.dayIndex));
  res.json({ plan: toPlan(plan), days: days.map(toDay) });
});

router.delete("/exam-plans/:planId", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const plan = await ownPlan(userId, Number(req.params.planId));
  if (!plan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }
  await db.delete(examPlanDaysTable).where(eq(examPlanDaysTable.planId, plan.id));
  await db.delete(examPlansTable).where(eq(examPlansTable.id, plan.id));
  res.status(204).end();
});

router.post("/exam-plans/:planId/regenerate", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const tier = await tierOf(req, userId);
  if (tier === "free") {
    res.status(403).json({
      error: "Plan regeneration is a Premium feature. Upgrade to adjust and regenerate your plans anytime.",
    });
    return;
  }
  const plan = await ownPlan(userId, Number(req.params.planId));
  if (!plan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }
  const adjustment =
    typeof req.body?.adjustment === "string" ? req.body.adjustment.trim().slice(0, 500) : undefined;

  const dates = scheduleDates(plan.examDate, PREMIUM_MAX_HORIZON_DAYS);
  let generated: GeneratedDay[];
  try {
    generated = await generateSchedule({
      batch: plan.batch as Batch,
      subjects: plan.subjects,
      weakTopics: plan.weakTopics,
      examDate: plan.examDate,
      dates,
      deep: true,
      adjustment,
    });
  } catch (err) {
    req.log.error({ err }, "exam plan regeneration failed");
    res.status(502).json({ error: "AI plan generation failed. Please try again." });
    return;
  }

  await db.delete(examPlanDaysTable).where(eq(examPlanDaysTable.planId, plan.id));
  const dayRows = await db
    .insert(examPlanDaysTable)
    .values(
      generated.map((g, i) => ({
        planId: plan.id,
        dayIndex: i + 1,
        date: dates[i],
        subject: g.subject,
        topic: g.topic,
        focus: g.focus,
        explanation: g.explanation,
      })),
    )
    .returning();
  const [updated] = await db
    .update(examPlansTable)
    .set({ dayCount: dayRows.length, completedDayCount: 0 })
    .where(eq(examPlansTable.id, plan.id))
    .returning();

  res.json({ plan: toPlan(updated), days: dayRows.map(toDay) });
});

router.patch("/exam-plans/:planId/days/:dayId", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const { completed } = req.body ?? {};
  if (typeof completed !== "boolean") {
    res.status(400).json({ error: "completed must be true or false" });
    return;
  }
  const plan = await ownPlan(userId, Number(req.params.planId));
  if (!plan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }
  const dayId = Number(req.params.dayId);
  const [day] = await db
    .update(examPlanDaysTable)
    .set({ completed })
    .where(and(eq(examPlanDaysTable.id, Number.isInteger(dayId) ? dayId : -1), eq(examPlanDaysTable.planId, plan.id)))
    .returning();
  if (!day) {
    res.status(404).json({ error: "Day not found" });
    return;
  }
  const [updated] = await db
    .update(examPlansTable)
    .set({
      completedDayCount: sql`(SELECT count(*)::int FROM exam_plan_days WHERE plan_id = ${plan.id} AND completed)`,
    })
    .where(eq(examPlansTable.id, plan.id))
    .returning();

  res.json({ day: toDay(day), dayCount: updated.dayCount, completedDayCount: updated.completedDayCount });
});

export default router;
