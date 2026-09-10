import { type Request, type Response, type NextFunction } from "express";
import { verifyAdminToken } from "../lib/adminToken";
import { isOwnerRequest } from "../lib/owner";

// Admin access is granted either by the password-issued HMAC token, or
// automatically when the request carries the owner's signed-in Clerk session
// (the owner's Gmail never needs the admin password).
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (verifyAdminToken(token)) {
    next();
    return;
  }

  if (await isOwnerRequest(req)) {
    next();
    return;
  }

  res.status(401).json({ error: "Admin authentication required" });
}
