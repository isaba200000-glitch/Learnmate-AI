import { Router, type IRouter } from "express";
import { eq, and, desc, gte, sum } from "drizzle-orm";
import {
  db,
  usersTable,
  notesTable,
  flashcardDecksTable,
  quizSessionsTable,
  studyPlansTable,
  studyTasksTable,
  documentsTable,
  focusSessionsTable,
} from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/dashboard", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay()); // Sunday

  const [
    user,
    notesCountResult,
    decksCountResult,
    quizzesCountResult,
    documentsCountResult,
    recentQuizzes,
    activePlans,
    focusToday,
    focusWeek,
  ] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.userId, userId)).limit(1),
    db.select().from(notesTable).where(eq(notesTable.userId, userId)),
    db
      .select()
      .from(flashcardDecksTable)
      .where(eq(flashcardDecksTable.userId, userId)),
    db
      .select()
      .from(quizSessionsTable)
      .where(eq(quizSessionsTable.userId, userId)),
    db.select().from(documentsTable).where(eq(documentsTable.userId, userId)),
    db
      .select()
      .from(quizSessionsTable)
      .where(
        and(
          eq(quizSessionsTable.userId, userId),
          eq(quizSessionsTable.status, "completed"),
        ),
      )
      .orderBy(desc(quizSessionsTable.createdAt))
      .limit(5),
    db
      .select()
      .from(studyPlansTable)
      .where(
        and(
          eq(studyPlansTable.userId, userId),
          eq(studyPlansTable.status, "active"),
        ),
      )
      .orderBy(desc(studyPlansTable.createdAt))
      .limit(3),
    db
      .select({ total: sum(focusSessionsTable.focusedSeconds) })
      .from(focusSessionsTable)
      .where(
        and(
          eq(focusSessionsTable.userId, userId),
          gte(focusSessionsTable.completedAt, today),
        ),
      ),
    db
      .select({ total: sum(focusSessionsTable.focusedSeconds) })
      .from(focusSessionsTable)
      .where(
        and(
          eq(focusSessionsTable.userId, userId),
          gte(focusSessionsTable.completedAt, weekStart),
        ),
      ),
  ]);

  const currentUser = user[0];
  if (!currentUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Get today's tasks from active plans
  const todayStr = new Date().toISOString().split("T")[0];
  const todayTasks =
    activePlans.length > 0
      ? await db
          .select()
          .from(studyTasksTable)
          .where(
            and(
              eq(studyTasksTable.scheduledDate, todayStr),
            ),
          )
          .limit(10)
      : [];

  // Build weekly XP from real activity: XP is earned on quiz completion
  // (same formula as the quiz submit route), aggregated per day for the last 7 days.
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);

  const recentCompletedQuizzes = await db
    .select({
      score: quizSessionsTable.score,
      completedAt: quizSessionsTable.completedAt,
    })
    .from(quizSessionsTable)
    .where(
      and(
        eq(quizSessionsTable.userId, userId),
        eq(quizSessionsTable.status, "completed"),
        gte(quizSessionsTable.completedAt, sevenDaysAgo),
      ),
    );

  const xpByDate = new Map<string, number>();
  for (const q of recentCompletedQuizzes) {
    if (!q.completedAt) continue;
    const key = q.completedAt.toDateString();
    // Must match the XP awarding formula in quizzes.ts exactly.
    const xpEarned = Math.max(10, Math.floor((q.score ?? 0) / 10) * 10);
    xpByDate.set(key, (xpByDate.get(key) ?? 0) + xpEarned);
  }

  const weeklyXp = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(sevenDaysAgo);
    date.setDate(sevenDaysAgo.getDate() + i);
    return {
      day: dayLabels[date.getDay()],
      xp: xpByDate.get(date.toDateString()) ?? 0,
    };
  });

  res.json({
    userName: currentUser.name,
    xp: currentUser.xp,
    streak: currentUser.streak,
    level: currentUser.level,
    coins: currentUser.coins,
    studyTimeToday: Math.round((Number(focusToday[0]?.total ?? 0)) / 60),
    studyTimeWeek: Math.round((Number(focusWeek[0]?.total ?? 0)) / 60),
    notesCount: notesCountResult.length,
    flashcardDecksCount: decksCountResult.length,
    quizzesCompletedCount: quizzesCountResult.filter((q) => q.status === "completed").length,
    documentsCount: documentsCountResult.length,
    recentQuizSessions: recentQuizzes.map((q) => ({
      ...q,
      completedAt: q.completedAt?.toISOString() ?? null,
      createdAt: q.createdAt.toISOString(),
    })),
    activeStudyPlans: activePlans.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      examDate: p.examDate ?? null,
    })),
    todayTasks,
    weeklyXp,
  });
});

export default router;
