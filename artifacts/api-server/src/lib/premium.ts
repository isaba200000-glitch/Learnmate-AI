import { inArray } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";

// Default premium plan configuration (manual bKash verification).
// The live values are owner-editable in the admin panel and stored in the
// settings table; these defaults apply until the owner saves their own.
export const DEFAULT_PREMIUM_PRICE = 700; // Bangladeshi Taka
export const DEFAULT_PREMIUM_DAYS = 30; // days of access per approved payment
export const DEFAULT_BKASH_NUMBER = "01711388418"; // owner's bKash number (Send Money)
export const PREMIUM_PLAN_ID = "premium_monthly";

const KEYS = {
  price: "premium_price",
  days: "premium_days",
  bkashNumber: "bkash_number",
} as const;

export interface PlanSettings {
  price: number;
  days: number;
  bkashNumber: string;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = raw !== undefined ? parseInt(raw, 10) : NaN;
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

// Read the live plan settings from the DB, falling back to defaults for any
// missing key. Read fresh on each request so admin edits apply immediately.
export async function getPlanSettings(): Promise<PlanSettings> {
  const rows = await db
    .select()
    .from(settingsTable)
    .where(inArray(settingsTable.key, Object.values(KEYS)));
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const bkash = map.get(KEYS.bkashNumber);
  return {
    price: parsePositiveInt(map.get(KEYS.price), DEFAULT_PREMIUM_PRICE),
    days: parsePositiveInt(map.get(KEYS.days), DEFAULT_PREMIUM_DAYS),
    bkashNumber: bkash && /^01\d{9}$/.test(bkash) ? bkash : DEFAULT_BKASH_NUMBER,
  };
}

export async function updatePlanSettings(settings: PlanSettings): Promise<void> {
  const entries: Array<{ key: string; value: string }> = [
    { key: KEYS.price, value: String(settings.price) },
    { key: KEYS.days, value: String(settings.days) },
    { key: KEYS.bkashNumber, value: settings.bkashNumber },
  ];
  for (const entry of entries) {
    await db
      .insert(settingsTable)
      .values(entry)
      .onConflictDoUpdate({
        target: settingsTable.key,
        set: { value: entry.value, updatedAt: new Date() },
      });
  }
}

export function isPremiumActive(expiresAt: Date | null | undefined): boolean {
  return !!expiresAt && expiresAt.getTime() > Date.now();
}

// New expiry when a payment is approved / premium is granted: extend from the
// later of "now" or the current (still-active) expiry so renewals stack.
export function extendedExpiry(current: Date | null | undefined, days: number = DEFAULT_PREMIUM_DAYS): Date {
  const base = isPremiumActive(current) ? (current as Date).getTime() : Date.now();
  return new Date(base + days * 86_400_000);
}
