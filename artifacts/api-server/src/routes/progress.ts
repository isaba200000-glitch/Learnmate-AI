import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  notesTable,
  quizSessionsTable,
  documentsTable,
  achievementsTable,
} from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/progress/stats", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;

  const [user, notes, quizzes, docs, achievements] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.userId, userId)).limit(1),
    db.select().from(notesTable).where(eq(notesTable.userId, userId)),
    db.select().from(quizSessionsTable).where(eq(quizSessionsTable.userId, userId)),
    db.select().from(documentsTable).where(eq(documentsTable.userId, userId)),
    db.select().from(achievementsTable).where(eq(achievementsTable.userId, userId)),
  ]);

  const currentUser = user[0];
  if (!currentUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const completedQuizzes = quizzes.filter((q) => q.status === "completed");
  const avgScore =
    completedQuizzes.length > 0
      ? completedQuizzes.reduce((sum, q) => sum + (q.score ?? 0), 0) /
        completedQuizzes.length
      : 0;

  // Subject breakdown from notes and quizzes
  const subjectMap: Record<string, number> = {};
  for (const n of notes) {
    if (n.subject) subjectMap[n.subject] = (subjectMap[n.subject] ?? 0) + 1;
  }
  for (const q of quizzes) {
    subjectMap[q.subject] = (subjectMap[q.subject] ?? 0) + 1;
  }
  const total = Object.values(subjectMap).reduce((a, b) => a + b, 0) || 1;
  const subjectBreakdown = Object.entries(subjectMap).map(([subject, count]) => ({
    subject,
    count,
    percentage: Math.round((count / total) * 100),
  }));

  // Recent activity
  const recentActivity = [
    ...completedQuizzes.slice(-5).map((q) => ({
      type: "quiz",
      description: `Completed ${q.subject} quiz`,
      // Must match the XP awarding formula in quizzes.ts exactly.
      xpEarned: Math.max(10, Math.floor((q.score ?? 0) / 10) * 10),
      createdAt: q.createdAt.toISOString(),
    })),
    ...notes.slice(-3).map((n) => ({
      type: "note",
      description: `Created note: ${n.title}`,
      xpEarned: 5,
      createdAt: n.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);

  // Auto-grant achievements based on stats
  const earnedTypes = new Set(achievements.map((a) => a.type));
  const newAchievements = [];

  const checks = [
    { type: "first_quiz", condition: completedQuizzes.length >= 1, title: "First Quiz", description: "Completed your first quiz", icon: "award" },
    { type: "quiz_master", condition: completedQuizzes.length >= 10, title: "Quiz Master", description: "Completed 10 quizzes", icon: "trophy" },
    { type: "note_taker", condition: notes.length >= 5, title: "Note Taker", description: "Created 5 notes", icon: "file-text" },
    { type: "streak_3", condition: currentUser.streak >= 3, title: "On Fire", description: "3-day learning streak", icon: "flame" },
    { type: "level_5", condition: currentUser.level >= 5, title: "Level 5", description: "Reached level 5", icon: "star" },
  ];

  for (const check of checks) {
    if (check.condition && !earnedTypes.has(check.type)) {
      const [ach] = await db
        .insert(achievementsTable)
        .values({ userId, type: check.type, title: check.title, description: check.description, icon: check.icon })
        .returning();
      newAchievements.push(ach);
    }
  }

  const allAchievements = [
    ...achievements.map((a) => ({ ...a, earnedAt: a.earnedAt.toISOString() })),
    ...newAchievements.map((a) => ({ ...a, earnedAt: a!.earnedAt.toISOString() })),
  ];

  res.json({
    xp: currentUser.xp,
    level: currentUser.level,
    streak: currentUser.streak,
    coins: currentUser.coins,
    totalStudyMinutes: 0,
    notesCreated: notes.length,
    flashcardsReviewed: 0,
    quizzesCompleted: completedQuizzes.length,
    averageQuizScore: Math.round(avgScore),
    documentsProcessed: docs.filter((d) => d.status === "processed").length,
    achievements: allAchievements,
    subjectBreakdown,
    recentActivity,
  });
});

export default router;
