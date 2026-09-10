import { getAuth } from "@clerk/express";
import { type Request, type Response, type NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface AuthRequest extends Request {
  userId: string;
}

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  (req as AuthRequest).userId = userId;

  // JIT provision user profile on first request
  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.userId, userId))
    .limit(1);

  if (existing.length === 0) {
    const claims = auth.sessionClaims as Record<string, unknown> | undefined;
    const name =
      (claims?.["name"] as string) ||
      (claims?.["first_name"] as string) ||
      "Learner";
    const email = (claims?.["email"] as string) || "";
    // Concurrent first requests can race to create the same user;
    // onConflictDoNothing makes the JIT provisioning idempotent.
    await db
      .insert(usersTable)
      .values({
        userId,
        name,
        email,
        xp: 0,
        streak: 0,
        level: 1,
        coins: 100,
        subjects: [],
      })
      .onConflictDoNothing({ target: usersTable.userId });
  } else {
    // Update last active and check streak
    await db
      .update(usersTable)
      .set({ lastActiveAt: new Date() })
      .where(eq(usersTable.userId, userId));
  }

  next();
};
