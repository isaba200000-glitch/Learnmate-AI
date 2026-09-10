import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, flashcardDecksTable, flashcardsTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

const toDeck = (d: typeof flashcardDecksTable.$inferSelect) => ({
  ...d,
  createdAt: d.createdAt.toISOString(),
  updatedAt: d.updatedAt.toISOString(),
});

const toCard = (c: typeof flashcardsTable.$inferSelect) => ({
  ...c,
  createdAt: c.createdAt.toISOString(),
});

router.get("/flashcard-decks", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const decks = await db
    .select()
    .from(flashcardDecksTable)
    .where(eq(flashcardDecksTable.userId, userId))
    .orderBy(flashcardDecksTable.updatedAt);
  res.json(decks.map(toDeck));
});

router.post("/flashcard-decks", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const { title, subject, description } = req.body;

  if (!title) {
    res.status(400).json({ error: "Title is required" });
    return;
  }

  const [deck] = await db
    .insert(flashcardDecksTable)
    .values({ userId, title, subject, description })
    .returning();

  res.status(201).json(toDeck(deck));
});

router.get("/flashcard-decks/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [deck] = await db
    .select()
    .from(flashcardDecksTable)
    .where(and(eq(flashcardDecksTable.id, id), eq(flashcardDecksTable.userId, userId)));

  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  const cards = await db
    .select()
    .from(flashcardsTable)
    .where(eq(flashcardsTable.deckId, id))
    .orderBy(flashcardsTable.createdAt);

  res.json({ ...toDeck(deck), cards: cards.map(toCard) });
});

router.patch("/flashcard-decks/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const { title, subject, description } = req.body;
  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (subject !== undefined) updates.subject = subject;
  if (description !== undefined) updates.description = description;

  const [deck] = await db
    .update(flashcardDecksTable)
    .set(updates)
    .where(and(eq(flashcardDecksTable.id, id), eq(flashcardDecksTable.userId, userId)))
    .returning();

  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  res.json(toDeck(deck));
});

router.delete("/flashcard-decks/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [deleted] = await db
    .delete(flashcardDecksTable)
    .where(and(eq(flashcardDecksTable.id, id), eq(flashcardDecksTable.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  await db.delete(flashcardsTable).where(eq(flashcardsTable.deckId, id));
  res.sendStatus(204);
});

router.get("/flashcard-decks/:id/cards", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const cards = await db
    .select()
    .from(flashcardsTable)
    .where(eq(flashcardsTable.deckId, id))
    .orderBy(flashcardsTable.createdAt);

  res.json(cards.map(toCard));
});

router.post("/flashcard-decks/:id/cards", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const deckId = parseInt(raw, 10);
  const { front, back, difficulty } = req.body;

  if (!front || !back) {
    res.status(400).json({ error: "Front and back are required" });
    return;
  }

  const [card] = await db
    .insert(flashcardsTable)
    .values({ deckId, front, back, difficulty })
    .returning();

  // Update card count
  await db
    .update(flashcardDecksTable)
    .set({ cardCount: sql`${flashcardDecksTable.cardCount} + 1` })
    .where(eq(flashcardDecksTable.id, deckId));

  res.status(201).json(toCard(card));
});

router.patch("/flashcard-decks/:id/cards/:cardId", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawCardId = Array.isArray(req.params.cardId) ? req.params.cardId[0] : req.params.cardId;
  const cardId = parseInt(rawCardId, 10);

  const { front, back, difficulty, isBookmarked } = req.body;
  const updates: Record<string, unknown> = {};
  if (front !== undefined) updates.front = front;
  if (back !== undefined) updates.back = back;
  if (difficulty !== undefined) updates.difficulty = difficulty;
  if (isBookmarked !== undefined) updates.isBookmarked = isBookmarked;

  const [card] = await db
    .update(flashcardsTable)
    .set(updates)
    .where(eq(flashcardsTable.id, cardId))
    .returning();

  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }

  res.json(toCard(card));
});

router.delete("/flashcard-decks/:id/cards/:cardId", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawCardId = Array.isArray(req.params.cardId) ? req.params.cardId[0] : req.params.cardId;
  const deckId = parseInt(rawId, 10);
  const cardId = parseInt(rawCardId, 10);

  const [deleted] = await db
    .delete(flashcardsTable)
    .where(eq(flashcardsTable.id, cardId))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Card not found" });
    return;
  }

  await db
    .update(flashcardDecksTable)
    .set({ cardCount: sql`GREATEST(${flashcardDecksTable.cardCount} - 1, 0)` })
    .where(eq(flashcardDecksTable.id, deckId));

  res.sendStatus(204);
});

export default router;
