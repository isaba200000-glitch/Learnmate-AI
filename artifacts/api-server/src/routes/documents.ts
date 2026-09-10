import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, documentsTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

// ─── Algorithmic text analysis ────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with","by","from",
  "as","is","was","are","were","be","been","have","has","had","do","does","did","will",
  "would","could","should","may","might","must","can","this","that","these","those",
  "it","its","not","no","so","too","very","just","all","any","some","such","than",
  "each","if","when","while","which","who","what","how","they","them","their","he",
  "she","we","you","i","me","my","your","our","his","her","up","also","about","more",
  "most","other","into","after","before","then","only","over","under","again","once",
  "here","there","both","few","because","since","until","although","though","between",
  "through","during","above","below","where","why","out","off","back","now","still",
  "yet","however","therefore","thus","among","within","without","per","via",
]);

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const cleaned = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const m = cleaned.match(/[aeiouy]{1,2}/g);
  return m ? Math.max(1, m.length) : 1;
}

function analyzeDocument(raw: string): { summary: string; keyConcepts: string[] } {
  const text = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  if (wordCount < 5) {
    return { summary: "Document is too short to analyze.", keyConcepts: [] };
  }

  const sentences     = text.split(/[.!?]+/).filter(s => s.trim().length > 4);
  const sentenceCount = Math.max(1, sentences.length);
  const paragraphs    = raw.split(/\n\n+/).filter(p => p.trim().length > 0);
  const readingMin    = Math.max(1, Math.ceil(wordCount / 250));
  const totalSyl      = words.reduce((s, w) => s + countSyllables(w), 0);

  // Flesch-Kincaid Grade Level
  const fkGrade = Math.max(0, Math.round(
    (0.39 * (wordCount / sentenceCount) + 11.8 * (totalSyl / wordCount) - 15.59) * 10
  ) / 10);

  // Reading Ease label
  const ease = 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (totalSyl / wordCount);
  const easeLabel =
    ease >= 90 ? "Very Easy (Grade 5)"           :
    ease >= 70 ? "Easy (Grades 6–7)"             :
    ease >= 60 ? "Standard (Grades 8–9)"         :
    ease >= 50 ? "Fairly Difficult (Grades 10–12)" :
    ease >= 30 ? "Difficult (College level)"     :
                 "Very Difficult (Professional)";

  const summary =
    `${wordCount.toLocaleString()} words · ${sentenceCount} sentences · ` +
    `${paragraphs.length} paragraph${paragraphs.length !== 1 ? "s" : ""} · ` +
    `~${readingMin} min read. ` +
    `Flesch-Kincaid Grade ${fkGrade} — ${easeLabel}.`;

  // Top keywords by frequency (excluding stop words, short words)
  const freq: Record<string, number> = {};
  for (const word of words) {
    const clean = word.toLowerCase().replace(/[^a-z]/g, "");
    if (clean.length > 3 && !STOP_WORDS.has(clean)) {
      freq[clean] = (freq[clean] ?? 0) + 1;
    }
  }

  const keyConcepts = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w.charAt(0).toUpperCase() + w.slice(1));

  return { summary, keyConcepts };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

const toDoc = (d: typeof documentsTable.$inferSelect) => ({
  ...d,
  createdAt: d.createdAt.toISOString(),
});

router.get("/documents", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const docs   = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.userId, userId))
    .orderBy(documentsTable.createdAt);
  res.json(docs.map(toDoc));
});

router.post("/documents", requireAuth, async (req, res): Promise<void> => {
  const userId                     = (req as AuthRequest).userId;
  const { title, filename, content } = req.body;

  if (!title || !filename || content == null) {
    res.status(400).json({ error: "title, filename, and content are required" });
    return;
  }

  let textContent: string = content;
  // Decode base64 if the content has no spaces and is long
  try {
    if (!content.includes(" ") && content.length > 100) {
      textContent = Buffer.from(content, "base64").toString("utf-8");
    }
  } catch {
    textContent = content;
  }

  const [doc] = await db
    .insert(documentsTable)
    .values({
      userId,
      title,
      filename,
      content: textContent.slice(0, 50_000),
      status: "pending",
    })
    .returning();

  res.status(201).json(toDoc(doc));
});

router.get("/documents/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const id     = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.id, id), eq(documentsTable.userId, userId)));

  if (!doc) { res.status(404).json({ error: "Document not found" }); return; }
  res.json({ ...toDoc(doc), keyConcepts: doc.keyConcepts });
});

router.delete("/documents/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const id     = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  const [deleted] = await db
    .delete(documentsTable)
    .where(and(eq(documentsTable.id, id), eq(documentsTable.userId, userId)))
    .returning();

  if (!deleted) { res.status(404).json({ error: "Document not found" }); return; }
  res.sendStatus(204);
});

// Analyze document — pure algorithmic, no external calls
router.post("/documents/:id/process", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const id     = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.id, id), eq(documentsTable.userId, userId)));

  if (!doc) { res.status(404).json({ error: "Document not found" }); return; }

  await db
    .update(documentsTable)
    .set({ status: "processing" })
    .where(eq(documentsTable.id, id));

  const { summary, keyConcepts } = analyzeDocument(doc.content ?? "");

  const [updated] = await db
    .update(documentsTable)
    .set({ summary, keyConcepts, status: "processed" })
    .where(eq(documentsTable.id, id))
    .returning();

  res.json(toDoc(updated!));
});

export default router;
