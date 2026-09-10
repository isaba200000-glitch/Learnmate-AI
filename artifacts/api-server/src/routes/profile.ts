import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/profile", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.userId, userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  res.json({
    ...user,
    createdAt: user.createdAt.toISOString(),
  });
});

router.put("/profile", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const { name, photoUrl, country, educationLevel, subjects, goals, learningLanguage } = req.body;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (photoUrl !== undefined) updates.photoUrl = photoUrl;
  if (country !== undefined) updates.country = country;
  if (educationLevel !== undefined) updates.educationLevel = educationLevel;
  if (subjects !== undefined) updates.subjects = subjects;
  if (goals !== undefined) updates.goals = goals;
  if (learningLanguage !== undefined) updates.learningLanguage = learningLanguage;

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.userId, userId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
});

export default router;
