import { type Request } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { isPremiumActive } from "./premium";
import { isOwnerRequest } from "./owner";

// Daily practice caps (seconds).
export const FREE_DAILY_SECONDS = 10 * 60;
export const PREMIUM_DAILY_SECONDS = 30 * 60;

// Students are in Bangladesh — the daily limit resets at midnight Dhaka time
// (UTC+6, no DST), so "a new day" matches the students' real day.
export const LANGUAGE_TZ = "Asia/Dhaka";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: LANGUAGE_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Current date string (YYYY-MM-DD) in the students' timezone. */
export function dhakaDay(date: Date = new Date()): string {
  return dayFormatter.format(date);
}

/** Date string for the Dhaka day before the given moment. */
export function dhakaYesterday(now: Date = new Date()): string {
  return dhakaDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));
}

/** Next midnight in Dhaka as an ISO timestamp (00:00+06:00 == 18:00 UTC same Dhaka day). */
export function nextResetISO(now: Date = new Date()): string {
  const parts = dhakaDay(now).split("-").map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(Date.UTC(y, m - 1, d, 18, 0, 0)).toISOString();
}

/**
 * The user's daily practice cap in seconds, or null for unlimited (owner).
 * Premium status is read fresh from the DB so an approval takes effect
 * on the next request.
 */
export async function dailyCapSeconds(req: Request, userId: string): Promise<number | null> {
  if (await isOwnerRequest(req)) return null;
  const [user] = await db
    .select({ premiumExpiresAt: usersTable.premiumExpiresAt })
    .from(usersTable)
    .where(eq(usersTable.userId, userId))
    .limit(1);
  return isPremiumActive(user?.premiumExpiresAt ?? null)
    ? PREMIUM_DAILY_SECONDS
    : FREE_DAILY_SECONDS;
}
