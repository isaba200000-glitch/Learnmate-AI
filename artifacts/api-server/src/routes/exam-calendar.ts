import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, examEventsTable, usersTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { openai, PREMIUM_AI_MODEL } from "../lib/openai";
import { isPremiumActive } from "../lib/premium";
import { isOwnerRequest } from "../lib/owner";
const router: IRouter = Router();

router.get("/exam-calendar", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const events = await db.select().from(examEventsTable).where(eq(examEventsTable.userId, userId)).orderBy(asc(examEventsTable.examDate));
  res.json({ events });
});

router.post("/exam-calendar", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const { subject, examDate, notes, routine, color } = req.body ?? {};
  if (!subject || !examDate) { res.status(400).json({ error: "subject and examDate are required." }); return; }
  const [event] = await db.insert(examEventsTable).values({ userId, subject, examDate, notes: notes ?? "", routine: routine ?? "", color: color ?? "blue" }).returning();
  res.json({ event });
});

router.put("/exam-calendar/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { subject, examDate, notes, routine, color } = req.body ?? {};
  const [event] = await db.update(examEventsTable).set({ subject, examDate, notes, routine, color, updatedAt: new Date() }).where(and(eq(examEventsTable.id, id), eq(examEventsTable.userId, userId))).returning();
  if (!event) { res.status(404).json({ error: "Exam event not found." }); return; }
  res.json({ event });
});

router.delete("/exam-calendar/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(examEventsTable).where(and(eq(examEventsTable.id, id), eq(examEventsTable.userId, userId)));
  res.json({ ok: true });
});

router.post("/exam-calendar/generate-routine", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const isOwner = await isOwnerRequest(req);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.userId, userId)).limit(1);
  const isPremium = isOwner || isPremiumActive(user?.premiumExpiresAt);
  const planTier = (user as any)?.planTier;
  if (!isPremium) { res.status(403).json({ error: "AI Routine Generator requires Premium access." }); return; }
  const { examEvents, hoursPerDay } = req.body ?? {};
  const completion = await openai.chat.completions.create({
    model: PREMIUM_AI_MODEL,
    max_tokens: 5000,
    messages: [
      { role: "system", content: "You are a study routine expert for students aged 13-20. Create a clear, practical daily study routine in structured markdown with week-by-week schedules, daily time blocks, and subject priorities." },
      { role: "user", content: "Create a study routine for these upcoming exams: " + JSON.stringify(examEvents ?? []) + ". Study hours per day: " + (hoursPerDay ?? 3) + ". Generate a schedule leading up to each exam date." },
    ],
  });
  res.json({ routine: completion.choices[0]?.message?.content?.trim() ?? "" });
});

export default router;
