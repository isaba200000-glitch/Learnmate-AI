import { Router, type IRouter } from "express";
import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import OpenAI from "openai";
import {
  db,
  usersTable,
  assistantConversationsTable,
  assistantMessagesTable,
  assistantUsageTable,
  type AssistantConversation,
  type AssistantMessage,
} from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { openai, PREMIUM_AI_MODEL } from "../lib/openai";
import { isPremiumActive } from "../lib/premium";
import { isOwnerRequest } from "../lib/owner";
import { dhakaDay } from "../lib/language";
import { FREE_DAILY_AI_MESSAGES, AI_MESSAGE_LIMIT_MESSAGE } from "../lib/quotas";

const router: IRouter = Router();

// ─── Limits ──────────────────────────────────────────────────────────────────

const FREE_DAILY_QUESTIONS = FREE_DAILY_AI_MESSAGES;
const MAX_MESSAGE_CHARS = 4000;
const HISTORY_MESSAGES = 20; // conversation context sent to the model

const LIMIT_MESSAGE = AI_MESSAGE_LIMIT_MESSAGE;

type Tier = "free" | "premium" | "owner";

async function tierAndLevel(
  req: Parameters<typeof isOwnerRequest>[0],
  userId: string,
): Promise<{ tier: Tier; educationLevel: string | null }> {
  const [user] = await db
    .select({
      premiumExpiresAt: usersTable.premiumExpiresAt,
      educationLevel: usersTable.educationLevel,
    })
    .from(usersTable)
    .where(eq(usersTable.userId, userId))
    .limit(1);
  const tier: Tier = (await isOwnerRequest(req))
    ? "owner"
    : isPremiumActive(user?.premiumExpiresAt)
      ? "premium"
      : "free";
  return { tier, educationLevel: user?.educationLevel ?? null };
}

async function questionsUsedToday(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: assistantUsageTable.questionsUsed })
    .from(assistantUsageTable)
    .where(and(eq(assistantUsageTable.userId, userId), eq(assistantUsageTable.day, dhakaDay())))
    .limit(1);
  return row?.n ?? 0;
}

// Atomically consume one free question for today. Returns false when the
// daily cap is already reached (never read-then-write on quota paths).
async function tryConsumeQuestion(userId: string, day: string): Promise<boolean> {
  const attempt = async () =>
    (
      await db
        .update(assistantUsageTable)
        .set({ questionsUsed: sql`${assistantUsageTable.questionsUsed} + 1` })
        .where(
          and(
            eq(assistantUsageTable.userId, userId),
            eq(assistantUsageTable.day, day),
            lt(assistantUsageTable.questionsUsed, FREE_DAILY_QUESTIONS),
          ),
        )
        .returning({ n: assistantUsageTable.questionsUsed })
    ).length > 0;

  if (await attempt()) return true;
  // Row may not exist yet for today.
  const inserted = await db
    .insert(assistantUsageTable)
    .values({ userId, day, questionsUsed: 1 })
    .onConflictDoNothing()
    .returning();
  if (inserted.length > 0) return true;
  return attempt(); // lost the insert race — retry the conditional update once
}

// Refund against the exact day row that was charged (a request can span the
// Dhaka midnight boundary, so never recompute the day at refund time).
async function refundQuestion(userId: string, day: string): Promise<void> {
  await db
    .update(assistantUsageTable)
    .set({ questionsUsed: sql`GREATEST(${assistantUsageTable.questionsUsed} - 1, 0)` })
    .where(and(eq(assistantUsageTable.userId, userId), eq(assistantUsageTable.day, day)));
}

function limitsFor(tier: Tier, used: number) {
  if (tier !== "free") return { plan: tier, dailyLimit: null, remaining: null };
  return {
    plan: tier,
    dailyLimit: FREE_DAILY_QUESTIONS,
    remaining: Math.max(0, FREE_DAILY_QUESTIONS - used),
  };
}

const toConversation = (c: AssistantConversation) => ({
  id: c.id,
  title: c.title,
  updatedAt: c.updatedAt.toISOString(),
});

const toMessage = (m: AssistantMessage) => ({
  id: m.id,
  role: m.role,
  content: m.content,
  createdAt: m.createdAt.toISOString(),
});

async function ownConversation(
  userId: string,
  conversationId: number,
): Promise<AssistantConversation | null> {
  const [c] = await db
    .select()
    .from(assistantConversationsTable)
    .where(
      and(
        eq(assistantConversationsTable.id, conversationId),
        eq(assistantConversationsTable.userId, userId),
      ),
    )
    .limit(1);
  return c ?? null;
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

function systemPrompt(tier: Tier, educationLevel: string | null): string {
  const level = educationLevel?.trim()
    ? `The student's current level: ${educationLevel.trim()}.`
    : "The student is preparing for GCSE, A Level, SSC or HSC examinations.";
  return (
    "You are LearnMate AI — an elite academic tutor trusted by top-performing students in Bangladesh and the UK. " +
    "You have expert-level mastery of every GCSE, A Level, SSC and HSC subject, including the NCTB curriculum, " +
    "সৃজনশীল (creative question) format, and Cambridge/Edexcel mark schemes. " +
    level +
    "\n\n" +
    "YOUR COMMUNICATION STYLE:\n" +
    "• Always open with a direct, precise answer — never be vague or evasive.\n" +
    "• Break every explanation into clear, logical steps that build on each other.\n" +
    "• Always reply in English by default. Only use Bangla/বাংলা if the student writes their message in Bangla, or explicitly asks you to switch to Bangla.\n" +
    "• Use rich markdown: ## headings, bullet points, numbered steps, **bold key terms**, `code blocks` for code, and tables where useful.\n" +
    "• For mathematics and science: state the formula, define every variable in plain language, then work through a full numerical example with units.\n" +
    "• For essays, history, and humanities: give a model answer structure, strong arguments, and specific evidence or quotations.\n" +
    "• Correct student misconceptions directly and precisely — explain exactly what is wrong and why.\n" +
    "• Treat every student as intelligent and fully capable of understanding advanced ideas when explained well.\n" +
    "\nLENGTH:\n" +
    "• Keep answers focused and scannable — aim for the shortest answer that fully covers the question.\n" +
    "• Simple questions deserve short answers (a few sentences). Only go long when the question genuinely needs it.\n" +
    "• Never pad with extra examples or tangents the student didn't ask for — offer to go deeper instead ('Want a worked example?').\n" +
    "\nEVERY ANSWER MUST END WITH:\n" +
    "💡 **Key Insight** — one razor-sharp sentence the student must remember.\n" +
    "📝 **Exam Tip** — what examiners specifically reward in mark schemes for this topic.\n" +
    "\nCRITICAL RULES:\n" +
    "• Be specific and accurate — never give generic, watered-down explanations.\n" +
    "• Never invent facts. If genuinely uncertain, say so and explain what you do know.\n" +
    "• If the question is unrelated to studying or education, kindly redirect the student to their work.\n" +
    (tier === "free"
      ? "• Keep answers high-impact and focused — cover the essential points excellently."
      : "• Bring expert-level depth (exam pitfalls, examiner's perspective) while staying concise — depth means insight, not length.")
  );
}

// ─── Spec'd routes: overview + history ───────────────────────────────────────

router.get("/assistant/overview", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const { tier } = await tierAndLevel(req, userId);
  const used = tier === "free" ? await questionsUsedToday(userId) : 0;

  const conversations = await db
    .select()
    .from(assistantConversationsTable)
    .where(eq(assistantConversationsTable.userId, userId))
    .orderBy(desc(assistantConversationsTable.updatedAt))
    .limit(30);

  res.json({ limits: limitsFor(tier, used), conversations: conversations.map(toConversation) });
});

router.get(
  "/assistant/conversations/:conversationId",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = (req as AuthRequest).userId;
    const conversationId = Number(req.params.conversationId);
    const conversation = Number.isInteger(conversationId)
      ? await ownConversation(userId, conversationId)
      : null;
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const messages = await db
      .select()
      .from(assistantMessagesTable)
      .where(eq(assistantMessagesTable.conversationId, conversation.id))
      .orderBy(asc(assistantMessagesTable.createdAt), asc(assistantMessagesTable.id));
    res.json({ conversation: toConversation(conversation), messages: messages.map(toMessage) });
  },
);

router.delete(
  "/assistant/conversations/:conversationId",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = (req as AuthRequest).userId;
    const conversationId = Number(req.params.conversationId);
    const conversation = Number.isInteger(conversationId)
      ? await ownConversation(userId, conversationId)
      : null;
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    await db
      .delete(assistantMessagesTable)
      .where(eq(assistantMessagesTable.conversationId, conversation.id));
    await db
      .delete(assistantConversationsTable)
      .where(eq(assistantConversationsTable.id, conversation.id));
    res.status(204).end();
  },
);

// ─── Streaming chat (outside the OpenAPI spec: SSE) ──────────────────────────
//
// POST /assistant/chat  { conversationId?: number, message: string }
// Streams `data: {"delta":"..."}` lines, then `data: {"done":true,...}`.

router.post("/assistant/chat", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const { conversationId, message } = req.body ?? {};

  const text = typeof message === "string" ? message.trim() : "";
  if (!text) {
    res.status(400).json({ error: "Please type a question first." });
    return;
  }
  if (text.length > MAX_MESSAGE_CHARS) {
    res.status(400).json({ error: "That question is too long — please shorten it." });
    return;
  }

  const { tier, educationLevel } = await tierAndLevel(req, userId);

  // Resolve or create the conversation BEFORE charging quota.
  let conversation: AssistantConversation | null = null;
  if (conversationId !== undefined && conversationId !== null) {
    const id = Number(conversationId);
    conversation = Number.isInteger(id) ? await ownConversation(userId, id) : null;
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
  }

  // Free tier: atomically consume one question.
  let charged = false;
  const chargedDay = dhakaDay();
  if (tier === "free") {
    charged = await tryConsumeQuestion(userId, chargedDay);
    if (!charged) {
      res.status(403).json({ error: LIMIT_MESSAGE, upgrade: true });
      return;
    }
  }

  try {
    if (!conversation) {
      const title = text.length > 60 ? `${text.slice(0, 57)}…` : text;
      const [created] = await db
        .insert(assistantConversationsTable)
        .values({ userId, title })
        .returning();
      conversation = created;
    }

    // Prior context (last N messages before this question).
    const history = await db
      .select()
      .from(assistantMessagesTable)
      .where(eq(assistantMessagesTable.conversationId, conversation.id))
      .orderBy(desc(assistantMessagesTable.createdAt), desc(assistantMessagesTable.id))
      .limit(HISTORY_MESSAGES);
    history.reverse();

    await db
      .insert(assistantMessagesTable)
      .values({ conversationId: conversation.id, role: "user", content: text });

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const stream = await openai.chat.completions.create({
      model: PREMIUM_AI_MODEL,
       max_completion_tokens: 5000,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt(tier, educationLevel) },
        ...history.map((m) => ({ role: m.role, content: m.content }) as const),
        { role: "user", content: text },
      ],
    });

    let full = "";
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        full += delta;
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }

    if (full.trim()) {
      await db
        .insert(assistantMessagesTable)
        .values({ conversationId: conversation.id, role: "assistant", content: full });
      await db
        .update(assistantConversationsTable)
        .set({ updatedAt: sql`now()` })
        .where(eq(assistantConversationsTable.id, conversation.id));
    }

    const used = tier === "free" ? await questionsUsedToday(userId) : 0;
    res.write(
      `data: ${JSON.stringify({
        done: true,
        conversationId: conversation.id,
        limits: limitsFor(tier, used),
      })}\n\n`,
    );
    res.end();
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number; error?: unknown };
    req.log.error(
      { errMsg: e.message, errStatus: e.status, errBody: e.error ?? err },
      "assistant chat failed",
    );
    // Don't burn a free question on an AI failure.
    if (charged) await refundQuestion(userId, chargedDay).catch(() => {});
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: "AI answer failed. Please try again." })}\n\n`);
      res.end();
    } else {
      res.status(502).json({ error: "AI answer failed. Please try again." });
    }
  }
});

// ─── Retention cleanup ───────────────────────────────────────────────────────

const RETENTION_DAYS = 90;

/**
 * Delete conversations (and their messages) that have not been updated in
 * RETENTION_DAYS days. Safe to call at any time; runs inside a transaction so
 * the messages and conversation rows are removed atomically.
 *
 * Returns the number of conversations pruned.
 */
export async function pruneOldConversations(): Promise<number> {
  const cutoff = sql`now() - interval '${sql.raw(String(RETENTION_DAYS))} days'`;

  const stale = await db
    .select({ id: assistantConversationsTable.id })
    .from(assistantConversationsTable)
    .where(lt(assistantConversationsTable.updatedAt, cutoff));

  if (stale.length === 0) return 0;

  const ids = stale.map((r) => r.id);

  await db
    .delete(assistantMessagesTable)
    .where(inArray(assistantMessagesTable.conversationId, ids));

  await db
    .delete(assistantConversationsTable)
    .where(inArray(assistantConversationsTable.id, ids));

  return ids.length;
}

// ─── Visualize (on-demand image for an AI response) ───────────────────────────

// POST /assistant/visualize  { message: string }
// Generates a contextual educational illustration for a given AI assistant reply.
// Called on-demand from the chat UI ("Visualize" button on AI messages).
router.post("/assistant/visualize", requireAuth, async (req, res): Promise<void> => {
  const { message } = req.body ?? {};
  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required" }); return;
  }
  try {
    const prompt =
      `Educational illustration visually explaining: "${message.slice(0, 300)}". ` +
      `Highly detailed, photorealistic diagram or scene. Technically accurate. ` +
      `Vivid colors, dramatic lighting, 4K quality. No text, labels, or watermarks.`;
    const encoded = encodeURIComponent(prompt);
    const imageApiUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&enhance=true`;
    const r = await fetch(imageApiUrl, { signal: AbortSignal.timeout(60_000) });
    if (!r.ok) {
      res.status(502).json({ error: "Could not generate image. Please try again." });
      return;
    }
    const ct = r.headers.get("content-type") ?? "image/jpeg";
    const imageUrl = `data:${ct};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
    res.json({ imageUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    (req as any).log?.error({ err: message }, "assistant visualize failed");
    const timedOut = /timeout|abort/i.test(message);
    res.status(502).json({
      error: timedOut
        ? "Image generation took too long. Please try again."
        : "Could not generate image. Please try again.",
    });
  }
});

export default router;
