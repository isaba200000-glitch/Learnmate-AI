import { Router, type IRouter } from "express";
import { eq, and, lt, sql } from "drizzle-orm";
import { db, conversationsTable, messagesTable, usersTable, assistantUsageTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { openai, PREMIUM_AI_MODEL } from "../lib/openai";
import { isPremiumActive } from "../lib/premium";
import { isOwnerRequest } from "../lib/owner";
import { dhakaDay } from "../lib/language";
import { FREE_DAILY_AI_MESSAGES, AI_MESSAGE_LIMIT_MESSAGE } from "../lib/quotas";

// ─── Free-tier daily limit ────────────────────────────────────────────────────
// Free users share a combined daily AI message quota across the Assistant and
// the legacy Chat feature (assistant_usage.questionsUsed). Premium and owner
// accounts are never counted. The shared constant lives in lib/quotas.ts so
// the two endpoints can never drift apart.

const FREE_DAILY_CHAT = FREE_DAILY_AI_MESSAGES;
const CHAT_LIMIT_MSG = AI_MESSAGE_LIMIT_MESSAGE;

// DEPRECATION: this file (openai-chat.ts) is the older, simpler chat
// endpoint. The newer /assistant system (routes/assistant.ts) is the
// canonical surface — it has conversation persistence, free-tier limits,
// premium gating, and the "Visualize" image button. The two endpoints
// share a quota (assistant_usage.questionsUsed) so a free user can never
// exceed the daily cap by splitting traffic between them.
//
// This file is intentionally kept in place so any older client that still
// calls it doesn't break, but new code should target /assistant/chat.
// Remove this file once the analytics show zero traffic here for a month.
console.info(
  "[openai-chat] Legacy chat endpoint active — prefer /assistant/chat. " +
    "The two endpoints share a free-tier quota via assistant_usage.questionsUsed.",
);

async function tryConsumeChat(userId: string, day: string): Promise<boolean> {
  const attempt = async () =>
    (
      await db
        .update(assistantUsageTable)
        .set({ questionsUsed: sql`${assistantUsageTable.questionsUsed} + 1` })
        .where(
          and(
            eq(assistantUsageTable.userId, userId),
            eq(assistantUsageTable.day, day),
            lt(assistantUsageTable.questionsUsed, FREE_DAILY_CHAT),
          ),
        )
        .returning({ n: assistantUsageTable.questionsUsed })
    ).length > 0;

  if (await attempt()) return true;
  const inserted = await db
    .insert(assistantUsageTable)
    .values({ userId, day, questionsUsed: 1 })
    .onConflictDoNothing()
    .returning();
  if (inserted.length > 0) return true;
  return attempt();
}

async function refundChat(userId: string, day: string): Promise<void> {
  await db
    .update(assistantUsageTable)
    .set({ questionsUsed: sql`GREATEST(${assistantUsageTable.questionsUsed} - 1, 0)` })
    .where(and(eq(assistantUsageTable.userId, userId), eq(assistantUsageTable.day, day)));
}

const router: IRouter = Router();

const toConversation = (c: typeof conversationsTable.$inferSelect) => ({
  ...c,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
});

const toMessage = (m: typeof messagesTable.$inferSelect) => ({
  ...m,
  createdAt: m.createdAt.toISOString(),
});

// GET /openai/usage — returns remaining daily message count for the current user.
// Free users see remaining + dailyLimit; premium/owner users see isPremium: true.
router.get("/openai/usage", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const isOwner = await isOwnerRequest(req as any);
  let isPremium = isOwner;
  if (!isOwner) {
    const [user] = await db
      .select({ premiumExpiresAt: usersTable.premiumExpiresAt })
      .from(usersTable)
      .where(eq(usersTable.userId, userId))
      .limit(1);
    isPremium = isPremiumActive(user?.premiumExpiresAt);
  }

  if (isPremium) {
    res.json({ isPremium: true, remaining: null, dailyLimit: null, used: null });
    return;
  }

  const day = dhakaDay();
  const [row] = await db
    .select({ n: assistantUsageTable.questionsUsed })
    .from(assistantUsageTable)
    .where(and(eq(assistantUsageTable.userId, userId), eq(assistantUsageTable.day, day)))
    .limit(1);

  const used = row?.n ?? 0;
  res.json({
    isPremium: false,
    used,
    dailyLimit: FREE_DAILY_CHAT,
    remaining: Math.max(0, FREE_DAILY_CHAT - used),
  });
});

router.get("/openai/conversations", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const convos = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.userId, userId))
    .orderBy(conversationsTable.updatedAt);
  res.json(convos.map(toConversation));
});

router.post("/openai/conversations", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const { title, subject } = req.body;

  if (!title) {
    res.status(400).json({ error: "Title is required" });
    return;
  }

  const [convo] = await db
    .insert(conversationsTable)
    .values({ userId, title, subject: subject ?? null })
    .returning();

  res.status(201).json(toConversation(convo));
});

router.get("/openai/conversations/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [convo] = await db
    .select()
    .from(conversationsTable)
    .where(and(eq(conversationsTable.id, id), eq(conversationsTable.userId, userId)));

  if (!convo) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const msgs = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, id))
    .orderBy(messagesTable.createdAt);

  res.json({ ...toConversation(convo), messages: msgs.map(toMessage) });
});

router.delete("/openai/conversations/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [deleted] = await db
    .delete(conversationsTable)
    .where(and(eq(conversationsTable.id, id), eq(conversationsTable.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  await db.delete(messagesTable).where(eq(messagesTable.conversationId, id));
  res.sendStatus(204);
});

router.get("/openai/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const msgs = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, id))
    .orderBy(messagesTable.createdAt);

  res.json(msgs.map(toMessage));
});

router.post("/openai/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [convo] = await db
    .select()
    .from(conversationsTable)
    .where(and(eq(conversationsTable.id, id), eq(conversationsTable.userId, userId)));

  if (!convo) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const { content, explanationLevel } = req.body;

  if (!content) {
    res.status(400).json({ error: "Content is required" });
    return;
  }

  // ── Rate limiting for free users ──────────────────────────────────────────
  const isOwner = await isOwnerRequest(req as any);
  let isPremium = isOwner;
  if (!isOwner) {
    const [user] = await db
      .select({ premiumExpiresAt: usersTable.premiumExpiresAt })
      .from(usersTable)
      .where(eq(usersTable.userId, userId))
      .limit(1);
    isPremium = isPremiumActive(user?.premiumExpiresAt);
  }

  const day = dhakaDay();
  if (!isPremium) {
    const allowed = await tryConsumeChat(userId, day);
    if (!allowed) {
      res.status(429).json({ error: CHAT_LIMIT_MSG, limitReached: true });
      return;
    }
  }

  // Save user message
  await db.insert(messagesTable).values({
    conversationId: id,
    role: "user",
    content,
  });

  // Get conversation history
  const history = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, id))
    .orderBy(messagesTable.createdAt);

  const levelPrompt = explanationLevel
    ? ` Explain at ${explanationLevel.replace("_", " ")} level.`
    : "";

  const systemMessage = `You are LearnMate AI, a helpful and encouraging personal tutor.${levelPrompt} Give clear, well-structured explanations with examples when helpful. Be concise but thorough.`;

  const chatMessages = [
    { role: "system" as const, content: systemMessage },
    ...history.slice(-20).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  // Stream SSE response
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  try {
    const stream = await openai.chat.completions.create({
      model: PREMIUM_AI_MODEL,
      max_completion_tokens: 5000,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content2 = chunk.choices[0]?.delta?.content;
      if (content2) {
        fullResponse += content2;
        res.write(`data: ${JSON.stringify({ content: content2 })}\n\n`);
      }
    }
  } catch (err) {
    console.error("[openai-chat] OpenAI streaming error:", err);
    // Refund the free question so the student isn't penalised for an AI error.
    if (!isPremium) await refundChat(userId, day);
    const errMsg = "Sorry, I encountered an error. Please try again.";
    fullResponse = errMsg;
    res.write(`data: ${JSON.stringify({ content: errMsg, error: String(err) })}\n\n`);
  }

  // Save assistant message
  if (fullResponse) {
    await db.insert(messagesTable).values({
      conversationId: id,
      role: "assistant",
      content: fullResponse,
    });

    // Update message count
    await db
      .update(conversationsTable)
      .set({ messageCount: history.length + 1 })
      .where(eq(conversationsTable.id, id));
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
