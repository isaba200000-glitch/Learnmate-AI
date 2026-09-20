import { Router, type IRouter } from "express";
import { eq, and, gte, sql, count as sqlCount } from "drizzle-orm";
import { db, quizSessionsTable, quizQuestionsTable, usersTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { openai, PREMIUM_AI_MODEL } from "../lib/openai";
import { isPremiumActive } from "../lib/premium";
import { isOwnerRequest } from "../lib/owner";
import {
  cleanText,
  fetchFromOTDB,
  generateQuestions,
  getCategory,
  normalizeDifficulty,
  type GeneratedQuestion,
} from "../lib/quiz-generation";

const router: IRouter = Router();

// ─── Routes ──────────────────────────────────────────────────────────────────

const toSession = (s: typeof quizSessionsTable.$inferSelect) => ({
  ...s,
  imageUrl: s.imageUrl ?? null,
  createdAt: s.createdAt.toISOString(),
  completedAt: s.completedAt?.toISOString() ?? null,
});

// While a session is pending, never send the answer key (or explanations,
// which can reveal it) to the client — otherwise a student could read the
// correct answers from the network response and submit a perfect quiz.
// Completed sessions include everything for the review screen.
const sanitizeQuestions = <Q extends { correctAnswer: string; explanation: string | null }>(
  questions: Q[],
  sessionStatus: string,
) =>
  sessionStatus === "completed"
    ? questions
    : questions.map(({ correctAnswer: _ca, explanation: _ex, ...rest }) => rest);

router.get("/quiz-sessions", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const sessions = await db
    .select()
    .from(quizSessionsTable)
    .where(eq(quizSessionsTable.userId, userId))
    .orderBy(quizSessionsTable.createdAt);
  res.json(sessions.map(toSession));
});

// Premium (and owner) accounts get AI-written quiz questions; free accounts
// get the Open Trivia DB bank. Mirrors hasUnlimitedPhotoQuizzes below.
async function hasPremiumQuizAi(
  req: Parameters<typeof isOwnerRequest>[0],
  userId: string,
): Promise<boolean> {
  if (await isOwnerRequest(req)) return true;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.userId, userId))
    .limit(1);
  return !!user && isPremiumActive(user.premiumExpiresAt);
}

router.post("/quiz-sessions", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const { subject, examType, totalQuestions, difficulty } = req.body;

  if (!subject || !totalQuestions) {
    res.status(400).json({ error: "subject and totalQuestions are required" });
    return;
  }

  const parsedCount = parseInt(String(totalQuestions), 10);
  if (!Number.isFinite(parsedCount) || parsedCount < 1) {
    res.status(400).json({ error: "totalQuestions must be a positive number" });
    return;
  }
  const count = Math.min(parsedCount, 20);
  const diff = normalizeDifficulty(difficulty);

  // Tiering: quizzes stay a FREE feature, but the AI-written version is the
  // premium upgrade. Free students get the Open Trivia DB question bank (the
  // long-standing behaviour); premium and owner accounts get questions written
  // for their exact topic, with an explanation that teaches. This also keeps
  // per-quiz AI cost tied to paying accounts.
  const aiQuizzes = await hasPremiumQuizAi(req, userId);

  let questions: GeneratedQuestion[] = [];
  try {
    if (aiQuizzes) {
      ({ questions } = await generateQuestions(
        String(subject),
        count,
        diff,
        examType ? String(examType) : null,
        req.log,
      ));
    } else {
      questions = await fetchFromOTDB(count, getCategory(String(subject)), diff);
    }
  } catch (err) {
    req.log?.error({ err }, "quiz generation failed");
    res.status(503).json({
      error: "Could not create quiz questions right now. Please try again in a moment.",
    });
    return;
  }

  const [session] = await db
    .insert(quizSessionsTable)
    .values({
      userId,
      subject,
      examType: examType ?? null,
      totalQuestions: questions.length,
      status: "pending",
    })
    .returning();

  const insertedQuestions = await db
    .insert(quizQuestionsTable)
    .values(
      questions.map(q => ({
        sessionId: session.id,
        question: q.question,
        type: q.type,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
      }))
    )
    .returning();

  res.status(201).json({ ...toSession(session), questions: sanitizeQuestions(insertedQuestions, session.status) });
});

// ─── Premium: quiz from a photo ──────────────────────────────────────────────

const LETTERS = ["A", "B", "C", "D"];

// Free students get 3 photo quizzes per 24 hours (rolling window); premium
// (and owner) are unlimited while the subscription is active.
const FREE_PHOTO_QUIZ_LIMIT = 3;
const FREE_LIMIT_MESSAGE =
  "You've used your 3 free photo quizzes for today. Come back tomorrow, or upgrade to Premium for unlimited photo quizzes!";

async function hasUnlimitedPhotoQuizzes(req: Parameters<typeof isOwnerRequest>[0], userId: string): Promise<boolean> {
  if (await isOwnerRequest(req)) return true;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.userId, userId)).limit(1);
  return !!user && isPremiumActive(user.premiumExpiresAt);
}

async function photoQuizzesUsed(tx: Pick<typeof db, "select">, userId: string): Promise<number> {
  // Rolling 24-hour window: only photo quizzes from the last 24h count.
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [row] = await tx
    .select({ used: sqlCount() })
    .from(quizSessionsTable)
    .where(
      and(
        eq(quizSessionsTable.userId, userId),
        eq(quizSessionsTable.source, "photo"),
        gte(quizSessionsTable.createdAt, windowStart),
      ),
    );
  return row?.used ?? 0;
}

router.post("/quiz-sessions/from-photo", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;

  // Quick pre-check so free users who are out of quota fail fast (before the AI call).
  // The authoritative, race-safe check happens again inside the insert transaction below.
  const unlimited = await hasUnlimitedPhotoQuizzes(req, userId);
  if (!unlimited && (await photoQuizzesUsed(db, userId)) >= FREE_PHOTO_QUIZ_LIMIT) {
    res.status(403).json({ error: FREE_LIMIT_MESSAGE });
    return;
  }
  const { imageBase64, totalQuestions, difficulty } = (req.body ?? {}) as {
    imageBase64?: unknown;
    totalQuestions?: unknown;
    difficulty?: unknown;
  };

  if (typeof imageBase64 !== "string" || !imageBase64.startsWith("data:image/")) {
    res.status(400).json({ error: "Please send a photo (as a data:image/... base64 string)." });
    return;
  }
  // ~10MB decoded ceiling — the 50mb body limit is shared, keep photos sane.
  if (imageBase64.length > 14_000_000) {
    res.status(400).json({ error: "That photo is too large. Please use a smaller photo." });
    return;
  }

  const count = Math.min(Math.max(1, parseInt(String(totalQuestions ?? 5), 10) || 5), 15);
  const diff = ["easy", "medium", "hard"].includes(String(difficulty)) ? String(difficulty) : "medium";

  let parsed: {
    subject?: unknown;
    questions?: Array<{ question?: unknown; options?: unknown; correctIndex?: unknown; explanation?: unknown }>;
  };
  try {
    const completion = await openai.chat.completions.create({
      model: PREMIUM_AI_MODEL,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are LearnMate AI's quiz maker. A student photographed a page of their study material (textbook, notes, slides). Read the content of the image and create clear multiple-choice quiz questions about the ACTUAL material shown. Questions and explanations are in simple English suitable for a school student in Bangladesh. If the image contains no readable study material, return {\"error\":\"unreadable\"}. You respond ONLY with valid JSON.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Create exactly ${count} ${diff}-difficulty multiple-choice questions from this photo of study material.` +
                ` Each question has exactly 4 options with only ONE correct answer.` +
                ` For each question give a 2-3 sentence explanation that teaches why the correct answer is right (and, where useful, why a tempting wrong option is wrong).` +
                ` Use plain text only: no HTML tags, no HTML entities, no markdown.` +
                ` Also give a short subject/topic name (max 40 chars) describing what the material is about.` +
                ` Respond as JSON exactly matching: {"subject":"...","questions":[{"question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."}]}`,
            },
            { type: "image_url", image_url: { url: imageBase64 } },
          ],
        },
      ],
    });
    parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as typeof parsed;
  } catch (err) {
    console.error("[quizzes] photo quiz generation failed:", err);
    res.status(502).json({ error: "The AI could not read that photo. Please try a clearer picture." });
    return;
  }

  const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
  const questions = rawQuestions
    .map((q) => {
      const question = typeof q?.question === "string" ? cleanText(q.question).slice(0, 600) : "";
      const optsRaw = Array.isArray(q?.options) ? q.options : [];
      const opts = optsRaw
        .map((o) => (typeof o === "string" ? cleanText(o).slice(0, 300) : ""))
        .filter(Boolean)
        .slice(0, 4);
      const idx = Number(q?.correctIndex);
      if (!question || opts.length !== 4 || !Number.isInteger(idx) || idx < 0 || idx > 3) return null;
      const options = opts.map((o, i) => `${LETTERS[i]}. ${o}`);
      return {
        question,
        type: "multiple_choice",
        options,
        correctAnswer: options[idx],
        explanation: typeof q?.explanation === "string" ? cleanText(q.explanation).slice(0, 800) : "",
      };
    })
    .filter((q): q is NonNullable<typeof q> => q !== null);

  if (questions.length === 0) {
    res.status(422).json({
      error: "I couldn't find readable study material in that photo. Please take a clearer picture of the page.",
    });
    return;
  }

  const subject =
    typeof parsed.subject === "string" && parsed.subject.trim()
      ? parsed.subject.trim().slice(0, 40)
      : "Photo Quiz";

  // Persist a (size-capped) copy of the photographed page so the student can
  // review the original material alongside the AI questions.
  // 1.5 MB ceiling: a base64-encoded image inflates ~33 %, so a 1 MB jpg becomes
  // ~1.3 MB of text. The data URL is round-tripped through the API on the
  // quiz-review page; we don't want a 5 MB row in the DB.
  const persistedImage = imageBase64.length > 2_000_000 ? null : imageBase64;

  const [session] = await db
    .insert(quizSessionsTable)
    .values({
      userId,
      subject: `📷 ${subject}`,
      examType: null,
      totalQuestions: questions.length,
      source: "photo",
      status: "pending",
      imageUrl: persistedImage,
    })
    .returning();

  // Race-safe re-check: if parallel requests slipped past the pre-check, only
  // the first FREE_PHOTO_QUIZ_LIMIT photo sessions survive.
  if (!unlimited && (await photoQuizzesUsed(db, userId)) > FREE_PHOTO_QUIZ_LIMIT) {
    await db.delete(quizSessionsTable).where(eq(quizSessionsTable.id, session.id));
    res.status(403).json({ error: FREE_LIMIT_MESSAGE });
    return;
  }

  const insertedQuestions = await db
    .insert(quizQuestionsTable)
    .values(questions.map((q) => ({ sessionId: session.id, ...q })))
    .returning();

  res.status(201).json({ ...toSession(session), questions: sanitizeQuestions(insertedQuestions, session.status) });
});

router.get("/quiz-sessions/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  const [session] = await db
    .select()
    .from(quizSessionsTable)
    .where(and(eq(quizSessionsTable.id, id), eq(quizSessionsTable.userId, userId)));

  if (!session) { res.status(404).json({ error: "Quiz session not found" }); return; }

  const questions = await db
    .select()
    .from(quizQuestionsTable)
    .where(eq(quizQuestionsTable.sessionId, id))
    .orderBy(quizQuestionsTable.id);

  res.json({ ...toSession(session), questions: sanitizeQuestions(questions, session.status) });
});

router.post("/quiz-sessions/:id/submit", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  const [session] = await db
    .select()
    .from(quizSessionsTable)
    .where(and(eq(quizSessionsTable.id, id), eq(quizSessionsTable.userId, userId)));

  if (!session) { res.status(404).json({ error: "Quiz session not found" }); return; }

  const { answers } = req.body as { answers: Array<{ questionId: number; answer: string }> };
  if (!Array.isArray(answers)) {
    res.status(400).json({ error: "answers must be an array" });
    return;
  }

  // Deduplicate client answers by questionId (last one wins) so repeated
  // entries can't inflate the correct count.
  const answerById = new Map<number, string>();
  for (const a of answers) {
    if (a && typeof a.questionId === "number" && typeof a.answer === "string") {
      answerById.set(a.questionId, a.answer);
    }
  }

  // The whole finalization runs in one transaction. The conditional
  // pending → completed claim guarantees exactly one submission wins
  // (concurrent/repeat submits get 409), and any failure after the claim
  // rolls everything back so the session stays pending and retryable.
  const result = await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(quizSessionsTable)
      .set({ status: "completed", completedAt: new Date() })
      .where(
        and(
          eq(quizSessionsTable.id, id),
          eq(quizSessionsTable.userId, userId),
          eq(quizSessionsTable.status, "pending"),
        ),
      )
      .returning();

    if (!claimed) return null; // already submitted → 409

    // Iterate the server-loaded session questions exactly once. Only questions
    // belonging to THIS session are scored — cross-session questionIds are
    // ignored, and skipped questions count as incorrect.
    const sessionQuestions = await tx
      .select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.sessionId, id))
      .orderBy(quizQuestionsTable.id);

    let correct = 0;
    const updatedQuestions: (typeof quizQuestionsTable.$inferSelect)[] = [];

    for (const question of sessionQuestions) {
      const answer = answerById.get(question.id);
      const isCorrect =
        typeof answer === "string" &&
        answer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
      if (isCorrect) correct++;

      const [updated] = await tx
        .update(quizQuestionsTable)
        .set({ userAnswer: answer ?? null, isCorrect })
        .where(and(eq(quizQuestionsTable.id, question.id), eq(quizQuestionsTable.sessionId, id)))
        .returning();

      updatedQuestions.push(updated ?? { ...question, userAnswer: answer ?? null, isCorrect });
    }

    const total = sessionQuestions.length || session.totalQuestions;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    const xpEarned = Math.max(10, Math.floor(score / 10) * 10);

    await tx
      .update(quizSessionsTable)
      .set({ correctAnswers: correct, score })
      .where(eq(quizSessionsTable.id, id));

    // SQL-side increment avoids lost updates under concurrent XP awards.
    // Also updates streak and level atomically.
    await tx
      .update(usersTable)
      .set({
        xp: sql`${usersTable.xp} + ${xpEarned}`,
        lastActiveAt: sql`now()`,
        streak: sql`CASE
          WHEN date_trunc('day', ${usersTable.lastActiveAt} AT TIME ZONE 'Asia/Dhaka') = date_trunc('day', now() AT TIME ZONE 'Asia/Dhaka') THEN ${usersTable.streak}
          WHEN date_trunc('day', ${usersTable.lastActiveAt} AT TIME ZONE 'Asia/Dhaka') = date_trunc('day', (now() - interval '1 day') AT TIME ZONE 'Asia/Dhaka') THEN ${usersTable.streak} + 1
          ELSE 1
        END`,
        level: sql`GREATEST(1, floor((${usersTable.xp} + ${xpEarned}) / 1000.0)::integer + 1)`,
      })
      .where(eq(usersTable.userId, userId));

    return { score, correct, total, xpEarned, questions: updatedQuestions };
  });

  if (!result) {
    res.status(409).json({ error: "This quiz has already been submitted" });
    return;
  }

  res.json({
    sessionId: id,
    score: result.score,
    correctAnswers: result.correct,
    totalQuestions: result.total,
    xpEarned: result.xpEarned,
    questions: result.questions,
  });
});

export default router;
