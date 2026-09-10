import { type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { type AuthRequest } from "./auth";
import { isPremiumActive } from "../lib/premium";
import { isOwnerRequest } from "../lib/owner";

// Must run AFTER requireAuth (which sets req.userId and provisions the user row).
export async function requirePremium(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // The owner's account always passes premium gates — current and future ones.
  if (await isOwnerRequest(req)) {
    next();
    return;
  }

  const userId = (req as AuthRequest).userId;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.userId, userId))
    .limit(1);

  if (!user || !isPremiumActive(user.premiumExpiresAt)) {
    res.status(403).json({ error: "Premium subscription required" });
    return;
  }
  next();
}
