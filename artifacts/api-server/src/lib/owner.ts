import { getAuth, clerkClient } from "@clerk/express";
import { type Request } from "express";

// The single owner account (admin + lifetime premium). The email can be
// overridden without a code change via the OWNER_EMAIL env var.
const RAW_OWNER_EMAIL = process.env.OWNER_EMAIL;
const OWNER_EMAIL = (RAW_OWNER_EMAIL ?? "isaba200000@gmail.com").trim().toLowerCase();

// Refuse to boot in production if the owner email is not explicitly set —
// the hard-coded default is the founder's personal address and should never
// be used in a public deployment. The default still applies in development
// for local convenience.
if (!RAW_OWNER_EMAIL && process.env.NODE_ENV === "production") {
  throw new Error(
    "OWNER_EMAIL environment variable is required in production. " +
      "Set it to the email address that should have lifetime premium + admin access.",
  );
}

// Startup breadcrumb (visible in workflow logs) so env overrides are verifiable.
console.info(
  `[owner] owner access bound to: ${OWNER_EMAIL}${
    RAW_OWNER_EMAIL ? " (from OWNER_EMAIL env)" : " (default — fine for dev, NOT for production)"
  }`,
);

export function isOwnerEmail(email: unknown): boolean {
  return typeof email === "string" && email.trim().toLowerCase() === OWNER_EMAIL;
}

// Cache Clerk lookups (positive AND negative) so premium/admin gates don't
// hit the Clerk API on every request.
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { isOwner: boolean; expiresAt: number }>();

/**
 * True when the request carries the owner's authenticated Clerk session.
 * The decision is entirely server-side:
 *  1. fast path — the `email` claim inside the signed Clerk session token;
 *  2. fallback — the user's verified email addresses from the Clerk API.
 * Never throws; on Clerk API failure it degrades to "not owner" (or the
 * last cached value) so regular requests are never broken.
 */
export async function isOwnerRequest(req: Request): Promise<boolean> {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) return false;

  // Signed session-token claim (set by Clerk, cannot be forged client-side).
  const claims = auth.sessionClaims as Record<string, unknown> | undefined;
  if (isOwnerEmail(claims?.["email"])) return true;

  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.isOwner;

  let isOwner = false;
  try {
    const user = await clerkClient.users.getUser(userId);
    isOwner = user.emailAddresses.some(
      (e) => e.verification?.status === "verified" && isOwnerEmail(e.emailAddress),
    );
  } catch {
    // Clerk API unavailable — keep serving with the stale value if we have one.
    return cached?.isOwner ?? false;
  }

  if (cache.size > 5000) cache.clear(); // primitive bound; entries are tiny
  cache.set(userId, { isOwner, expiresAt: Date.now() + CACHE_TTL_MS });
  return isOwner;
}
