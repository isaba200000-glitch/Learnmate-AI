/**
 * One-off backfill: existing cached Pexels images were stored before we kept
 * photographer attribution. Pexels image URLs embed the photo id
 * (https://images.pexels.com/photos/<id>/...), so we can look each one up via
 * GET https://api.pexels.com/v1/photos/:id and store the credit.
 *
 * Non-Pexels URLs (curated fallbacks) are skipped — they keep null attribution.
 * Safe to re-run: only touches rows where photographer_name IS NULL.
 *
 * Run (from artifacts/api-server): pnpm run backfill:photo-credits
 */
import { isNull, eq } from "drizzle-orm";
import {
  db,
  courseTopicImagesTable,
  courseLessonImagesTable,
  courseLessonStepImagesTable,
  noteSubjectImagesTable,
} from "@workspace/db";

const apiKey = process.env.PEXELS_API_KEY;
if (!apiKey) {
  console.error("PEXELS_API_KEY not set — aborting.");
  process.exit(1);
}

function pexelsId(url: string): number | null {
  const m = /images\.pexels\.com\/photos\/(\d+)\//.exec(url);
  return m ? Number(m[1]) : null;
}

const creditCache = new Map<number, { name: string | null; url: string | null } | null>();

async function lookup(id: number) {
  if (creditCache.has(id)) return creditCache.get(id)!;
  try {
    const res = await fetch(`https://api.pexels.com/v1/photos/${id}`, {
      headers: { Authorization: apiKey! },
    });
    if (!res.ok) {
      creditCache.set(id, null);
      return null;
    }
    const data = (await res.json()) as { photographer?: string; photographer_url?: string };
    const credit = { name: data.photographer || null, url: data.photographer_url || null };
    creditCache.set(id, credit);
    return credit;
  } catch {
    creditCache.set(id, null);
    return null;
  }
}

async function backfill(
  label: string,
  table: any,
) {
  const rows = await db.select().from(table).where(isNull(table.photographerName));
  let updated = 0, skipped = 0;
  for (const row of rows as Array<{ id: number; imageUrl: string }>) {
    const id = pexelsId(row.imageUrl);
    if (!id) { skipped++; continue; } // curated fallback, not Pexels
    const credit = await lookup(id);
    if (!credit?.name) { skipped++; continue; }
    await db
      .update(table)
      .set({ photographerName: credit.name, photographerUrl: credit.url })
      .where(eq(table.id, row.id));
    updated++;
  }
  console.log(`${label}: ${rows.length} rows without credit → ${updated} updated, ${skipped} skipped`);
}

await backfill("course_topic_images", courseTopicImagesTable);
await backfill("course_lesson_images", courseLessonImagesTable);
await backfill("course_lesson_step_images", courseLessonStepImagesTable);
await backfill("note_subject_images", noteSubjectImagesTable);
console.log(`Unique Pexels lookups: ${creditCache.size}`);
process.exit(0);
