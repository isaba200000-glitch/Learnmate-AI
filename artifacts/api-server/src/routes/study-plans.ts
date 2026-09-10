import { Router, type IRouter } from "express";
import { eq, and, inArray, gte } from "drizzle-orm";
import { db, studyPlansTable, studyTasksTable, usersTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { isPremiumActive } from "../lib/premium";
import { isOwnerRequest } from "../lib/owner";

const router: IRouter = Router();

// ─── Rule-based study plan generator ─────────────────────────────────────────

type Phase = "foundation" | "practice" | "review";

const TASK_TEMPLATES: Record<string, Record<Phase, string[]>> = {
  math: {
    foundation: [
      "Study core theorems and definitions",
      "Build a comprehensive formula reference sheet",
      "Read textbook chapter and take structured notes",
      "Watch worked-example explanations",
    ],
    practice: [
      "Complete 20 timed practice problems",
      "Work through past exam questions",
      "Practice problem-solving under exam conditions",
      "Identify and drill the most common problem types",
    ],
    review: [
      "Full formula-sheet rapid review",
      "Mock test under timed exam conditions",
      "Speed drills on high-frequency problem types",
      "Review all mistakes from practice sessions",
    ],
  },
  science: {
    foundation: [
      "Read and annotate the chapter",
      "Label and redraw key diagrams from memory",
      "Create a concept map of the main ideas",
      "Define all key terms in your own words",
    ],
    practice: [
      "Answer past exam-style questions",
      "Practice drawing and labelling diagrams unaided",
      "Work through data analysis and graph questions",
      "Self-test with recall exercises (no notes)",
    ],
    review: [
      "Flashcard review of all key terms",
      "Re-read summary notes and highlighted sections",
      "Final past paper run-through",
      "Targeted revision of any weak topics",
    ],
  },
  social: {
    foundation: [
      "Read the chapter and take Cornell-style notes",
      "Create a timeline or sequence of key events",
      "Study cause-and-effect relationships",
      "Summarise the significance of key figures",
    ],
    practice: [
      "Write structured short-answer responses",
      "Create mind maps linking major concepts",
      "Complete source analysis exercises",
      "Practice building and defending an argument",
    ],
    review: [
      "Review all notes and summary sheets",
      "Practice timed essay writing",
      "Revisit key quotes and supporting evidence",
      "Explain a concept aloud without notes",
    ],
  },
  language: {
    foundation: [
      "Read assigned text and annotate carefully",
      "Build vocabulary flashcards for unfamiliar words",
      "Study grammar rules with example sentences",
      "Analyse a sample passage for literary techniques",
    ],
    practice: [
      "Write a timed response to a practice prompt",
      "Complete comprehension and grammar exercises",
      "Analyse an unseen passage independently",
      "Edit and improve a previous essay draft",
    ],
    review: [
      "Review key themes, quotations, and techniques",
      "Practice writing strong introductions and conclusions",
      "Final grammar and spelling exercises",
      "Read through annotated texts one more time",
    ],
  },
  computer: {
    foundation: [
      "Read documentation and theory notes",
      "Study core concepts and common data structures",
      "Create a cheatsheet of key syntax and patterns",
      "Trace through worked algorithm examples",
    ],
    practice: [
      "Complete coding exercises on the topic",
      "Solve past exam programming questions by hand",
      "Build a small project applying these concepts",
      "Debug and fix sample programs",
    ],
    review: [
      "Review cheatsheet and key algorithms",
      "Walk through past exam solutions step by step",
      "Practice writing code from memory",
      "Write out a concept explanation as if teaching someone",
    ],
  },
  general: {
    foundation: [
      "Read and take structured notes on the material",
      "Identify the 5 most important concepts",
      "Create visual summaries or diagrams",
      "Build a glossary of all key terms",
    ],
    practice: [
      "Complete practice questions on the topic",
      "Self-test using flashcards or spaced recall",
      "Explain key concepts without looking at notes",
      "Work through a full timed practice test",
    ],
    review: [
      "Skim through all notes and summary sheets",
      "Target and drill any remaining weak areas",
      "Full practice test under timed conditions",
      "Quick review of key points the evening before",
    ],
  },
};

function categorise(subject: string): string {
  const s = subject.toLowerCase();
  if (/math|algebra|geometry|calculus|statistics|arithmetic|trigon/.test(s)) return "math";
  if (/physics|chemistry|biology|science|anatomy|ecology|botany|zoology/.test(s)) return "science";
  if (/history|geography|civics|economics|social|politics|sociology/.test(s)) return "social";
  if (/english|literature|writing|reading|language|grammar|poetry/.test(s)) return "language";
  if (/computer|programming|coding|software|algorithm|data structure/.test(s)) return "computer";
  return "general";
}

function generateTasks(
  subjects: string[],
  studyHoursPerDay: number,
  examDate?: string | null
): Array<{ title: string; subject: string; dayOffset: number; durationMinutes: number }> {
  const daysUntilExam = examDate
    ? Math.max(3, Math.floor((new Date(examDate).getTime() - Date.now()) / 86_400_000))
    : 14;
  const totalDays    = Math.min(daysUntilExam, 30);
  const foundEnd     = Math.floor(totalDays * 0.4);
  const practiceEnd  = Math.floor(totalDays * 0.8);
  const minsPerSubject = Math.max(30, Math.floor((studyHoursPerDay * 60) / subjects.length));

  return Array.from({ length: totalDays }, (_, day) => {
    const phase: Phase = day < foundEnd ? "foundation" : day < practiceEnd ? "practice" : "review";
    const subjectIdx   = day % subjects.length;
    const subject      = subjects[subjectIdx];
    const type         = categorise(subject);
    const templates    = TASK_TEMPLATES[type][phase];
    const title        = templates[(day * 7 + subjectIdx) % templates.length];
    return { title: `${title} — ${subject}`, subject, dayOffset: day, durationMinutes: minsPerSubject };
  });
}

// ─── Daily limit helpers ──────────────────────────────────────────────────────

const FREE_DAILY_PLANS = 1;

async function getPlansCreatedToday(userId: string): Promise<number> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ id: studyPlansTable.id })
    .from(studyPlansTable)
    .where(and(eq(studyPlansTable.userId, userId), gte(studyPlansTable.createdAt, oneDayAgo)));
  return rows.length;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

const toPlan = (p: typeof studyPlansTable.$inferSelect) => ({
  ...p,
  createdAt: p.createdAt.toISOString(),
  examDate: p.examDate ?? null,
});

// GET /study-plans/limits — daily creation quota for the current user
router.get("/study-plans/limits", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const isOwner = await isOwnerRequest(req);
  const [user] = await db
    .select({ premiumExpiresAt: usersTable.premiumExpiresAt })
    .from(usersTable)
    .where(eq(usersTable.userId, userId))
    .limit(1);
  const isPremium = isOwner || isPremiumActive(user?.premiumExpiresAt);
  if (isPremium) {
    res.json({ isPremium: true, dailyLimit: null, used: 0, remaining: null });
    return;
  }
  const used = await getPlansCreatedToday(userId);
  res.json({
    isPremium: false,
    dailyLimit: FREE_DAILY_PLANS,
    used,
    remaining: Math.max(0, FREE_DAILY_PLANS - used),
  });
});

router.get("/study-plans", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const plans  = await db
    .select()
    .from(studyPlansTable)
    .where(eq(studyPlansTable.userId, userId))
    .orderBy(studyPlansTable.createdAt);

  const planIds = plans.map(p => p.id);
  const tasks = planIds.length > 0
    ? await db
        .select()
        .from(studyTasksTable)
        .where(inArray(studyTasksTable.planId, planIds))
        .orderBy(studyTasksTable.scheduledDate)
    : [];

  const tasksByPlan = new Map<number, typeof tasks>();
  for (const task of tasks) {
    const list = tasksByPlan.get(task.planId) ?? [];
    list.push(task);
    tasksByPlan.set(task.planId, list);
  }

  res.json(plans.map(p => ({ ...toPlan(p), tasks: tasksByPlan.get(p.id) ?? [] })));
});

router.post("/study-plans", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const { title, examDate, subjects, studyHoursPerDay, goals } = req.body;

  if (!title || !subjects || !studyHoursPerDay) {
    res.status(400).json({ error: "title, subjects, and studyHoursPerDay are required" });
    return;
  }

  // Daily limit: free users can create 1 AI study plan per 24 hours
  const isOwner = await isOwnerRequest(req);
  const [user] = await db
    .select({ premiumExpiresAt: usersTable.premiumExpiresAt })
    .from(usersTable)
    .where(eq(usersTable.userId, userId))
    .limit(1);
  const isPremium = isOwner || isPremiumActive(user?.premiumExpiresAt);
  if (!isPremium) {
    const used = await getPlansCreatedToday(userId);
    if (used >= FREE_DAILY_PLANS) {
      res.status(429).json({
        error: `Free plan: ${FREE_DAILY_PLANS} AI study plan per 24 hours. Upgrade to Premium for unlimited plans.`,
        upgrade: true,
      });
      return;
    }
  }

  const [plan] = await db
    .insert(studyPlansTable)
    .values({ userId, title, examDate: examDate ?? null, subjects, studyHoursPerDay, goals: goals ?? null })
    .returning();

  const tasks      = generateTasks(subjects, studyHoursPerDay, examDate);
  const startDate  = new Date();

  const taskValues = tasks.map(t => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + t.dayOffset);
    return {
      planId: plan.id,
      title: t.title,
      subject: t.subject ?? null,
      scheduledDate: d.toISOString().split("T")[0],
      durationMinutes: t.durationMinutes,
      completed: false,
    };
  });

  const insertedTasks = taskValues.length > 0
    ? await db.insert(studyTasksTable).values(taskValues).returning()
    : [];

  await db
    .update(studyPlansTable)
    .set({ taskCount: insertedTasks.length })
    .where(eq(studyPlansTable.id, plan.id));

  res.status(201).json({
    ...toPlan(plan),
    taskCount: insertedTasks.length,
    completedTaskCount: 0,
    tasks: insertedTasks,
  });
});

router.get("/study-plans/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const id     = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  const [plan] = await db
    .select()
    .from(studyPlansTable)
    .where(and(eq(studyPlansTable.id, id), eq(studyPlansTable.userId, userId)));

  if (!plan) { res.status(404).json({ error: "Study plan not found" }); return; }

  const tasks = await db
    .select()
    .from(studyTasksTable)
    .where(eq(studyTasksTable.planId, id))
    .orderBy(studyTasksTable.scheduledDate);

  res.json({ ...toPlan(plan), tasks });
});

router.patch("/study-plans/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const id     = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  const { title, examDate, subjects, studyHoursPerDay, goals, status } = req.body;
  const updates: Record<string, unknown> = {};
  if (title            !== undefined) updates.title            = title;
  if (examDate         !== undefined) updates.examDate         = examDate;
  if (subjects         !== undefined) updates.subjects         = subjects;
  if (studyHoursPerDay !== undefined) updates.studyHoursPerDay = studyHoursPerDay;
  if (goals            !== undefined) updates.goals            = goals;
  if (status           !== undefined) updates.status           = status;

  const [plan] = await db
    .update(studyPlansTable)
    .set(updates)
    .where(and(eq(studyPlansTable.id, id), eq(studyPlansTable.userId, userId)))
    .returning();

  if (!plan) { res.status(404).json({ error: "Study plan not found" }); return; }
  res.json(toPlan(plan));
});

router.delete("/study-plans/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const id     = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  const [deleted] = await db
    .delete(studyPlansTable)
    .where(and(eq(studyPlansTable.id, id), eq(studyPlansTable.userId, userId)))
    .returning();

  if (!deleted) { res.status(404).json({ error: "Study plan not found" }); return; }
  await db.delete(studyTasksTable).where(eq(studyTasksTable.planId, id));
  res.sendStatus(204);
});

router.patch("/study-plans/:id/tasks/:taskId", requireAuth, async (req, res): Promise<void> => {
  const userId  = (req as AuthRequest).userId;
  const planId  = parseInt(Array.isArray(req.params.id)     ? req.params.id[0]     : req.params.id, 10);
  const taskId  = parseInt(Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId, 10);

  const [plan] = await db
    .select()
    .from(studyPlansTable)
    .where(and(eq(studyPlansTable.id, planId), eq(studyPlansTable.userId, userId)));
  if (!plan) { res.status(404).json({ error: "Study plan not found" }); return; }

  const { completed, title, scheduledDate } = req.body;
  const updates: Record<string, unknown> = {};
  if (completed     !== undefined) updates.completed     = completed;
  if (title         !== undefined) updates.title         = title;
  if (scheduledDate !== undefined) updates.scheduledDate = scheduledDate;

  const [task] = await db
    .update(studyTasksTable)
    .set(updates)
    .where(and(eq(studyTasksTable.id, taskId), eq(studyTasksTable.planId, planId)))
    .returning();

  if (!task) { res.status(404).json({ error: "Task not found" }); return; }

  const allTasks      = await db.select().from(studyTasksTable).where(eq(studyTasksTable.planId, planId));
  const completedCount = allTasks.filter(t => t.completed).length;
  await db
    .update(studyPlansTable)
    .set({ completedTaskCount: completedCount })
    .where(eq(studyPlansTable.id, planId));

  res.json(task);
});

export default router;
