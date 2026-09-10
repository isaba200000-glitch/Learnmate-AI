import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, notesTable, noteSubjectImagesTable, usersTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { getNotePhoto } from "../lib/realPhotos";

const router: IRouter = Router();

const toNote = (n: typeof notesTable.$inferSelect) => ({
  ...n,
  createdAt: n.createdAt.toISOString(),
  updatedAt: n.updatedAt.toISOString(),
});

router.get("/notes", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const { subject, search } = req.query as { subject?: string; search?: string };

  let query = db.select().from(notesTable).where(eq(notesTable.userId, userId));

  const conditions = [eq(notesTable.userId, userId)];
  if (subject) conditions.push(eq(notesTable.subject, subject));

  const notes = await db
    .select()
    .from(notesTable)
    .where(and(...conditions))
    .orderBy(notesTable.updatedAt);

  const filtered = search
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.content.toLowerCase().includes(search.toLowerCase()),
      )
    : notes;

  res.json(filtered.map(toNote));
});

router.post("/notes", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const { title, content, subject, tags } = req.body;

  if (!title) {
    res.status(400).json({ error: "Title is required" });
    return;
  }

  const [note] = await db
    .insert(notesTable)
    .values({ userId, title, content: content ?? "", subject, tags: tags ?? [] })
    .returning();

  // Award +5 XP, update streak, level, and lastActiveAt atomically.
  await db.update(usersTable)
    .set({
      xp: sql`${usersTable.xp} + 5`,
      lastActiveAt: sql`now()`,
      streak: sql`CASE
        WHEN date_trunc('day', ${usersTable.lastActiveAt} AT TIME ZONE 'Asia/Dhaka') = date_trunc('day', now() AT TIME ZONE 'Asia/Dhaka') THEN ${usersTable.streak}
        WHEN date_trunc('day', ${usersTable.lastActiveAt} AT TIME ZONE 'Asia/Dhaka') = date_trunc('day', (now() - interval '1 day') AT TIME ZONE 'Asia/Dhaka') THEN ${usersTable.streak} + 1
        ELSE 1
      END`,
      level: sql`GREATEST(1, floor((${usersTable.xp} + 5) / 1000.0)::integer + 1)`,
    })
    .where(eq(usersTable.userId, userId));

  res.status(201).json(toNote(note));
});

// GET /notes/image?subject=:subject
// Must be registered BEFORE /notes/:id, or "image" is captured as an id.
// Returns (and lazily generates) a cached AI illustration for a note subject keyword.
// Keyed by lowercase subject so two notes about the same topic share one image.
router.get("/notes/image", requireAuth, async (req, res): Promise<void> => {
  const raw = String(req.query.subject ?? "").trim();
  if (!raw) { res.status(400).json({ error: "subject is required" }); return; }

  const subjectKey = raw.toLowerCase().slice(0, 80);

  const [cached] = await db
    .select({
      imageUrl: noteSubjectImagesTable.imageUrl,
      photographerName: noteSubjectImagesTable.photographerName,
      photographerUrl: noteSubjectImagesTable.photographerUrl,
    })
    .from(noteSubjectImagesTable)
    .where(eq(noteSubjectImagesTable.subjectKey, subjectKey))
    .limit(1);

  if (cached) { res.json(cached); return; }

  try {
    const photo = await getNotePhoto(raw);
    await db.insert(noteSubjectImagesTable)
      .values({ subjectKey, imageUrl: photo.url, photographerName: photo.photographerName, photographerUrl: photo.photographerUrl })
      .onConflictDoNothing();
    res.json({ imageUrl: photo.url, photographerName: photo.photographerName, photographerUrl: photo.photographerUrl });
  } catch (err) {
    (req as any).log?.error({ err }, "note image fetch failed");
    res.status(502).json({ error: "Could not find image." });
  }
});

router.get("/notes/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (!Number.isFinite(id) || id <= 0) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  const [note] = await db
    .select()
    .from(notesTable)
    .where(and(eq(notesTable.id, id), eq(notesTable.userId, userId)));

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  res.json(toNote(note));
});

router.patch("/notes/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (!Number.isFinite(id) || id <= 0) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  const { title, content, subject, tags } = req.body;
  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (subject !== undefined) updates.subject = subject;
  if (tags !== undefined) updates.tags = tags;

  const [note] = await db
    .update(notesTable)
    .set(updates)
    .where(and(eq(notesTable.id, id), eq(notesTable.userId, userId)))
    .returning();

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  res.json(toNote(note));
});

router.delete("/notes/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (!Number.isFinite(id) || id <= 0) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  const [deleted] = await db
    .delete(notesTable)
    .where(and(eq(notesTable.id, id), eq(notesTable.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
