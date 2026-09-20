import { Router, type IRouter } from "express";
import { and, desc, eq, lt, sql } from "drizzle-orm";

const ANSWERS_RETENTION_DAYS = 90;

/**
 * Delete language-practice answer rows older than ANSWERS_RETENTION_DAYS days.
 * Returns the number of rows pruned.
 */
export async function pruneOldAnswers(): Promise<number> {
  const cutoff = sql`now() - interval '${sql.raw(String(ANSWERS_RETENTION_DAYS))} days'`;
  const deleted = await db
    .delete(languageAnswersTable)
    .where(lt(languageAnswersTable.answeredAt, cutoff))
    .returning({ id: languageAnswersTable.id });
  return deleted.length;
}
import {
  db,
  languageUsageTable,
  languageProgressTable,
  languageWordsTable,
  languageAnswersTable,
  languageDailyChallengeTable,
} from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { openai, PREMIUM_AI_MODEL } from "../lib/openai";
import {
  dailyCapSeconds,
  dhakaDay,
  dhakaYesterday,
  nextResetISO,
  PREMIUM_DAILY_SECONDS,
} from "../lib/language";

const router: IRouter = Router();

// The client heartbeats every ~20s while the student is actively practicing.
// A single beat can credit at most 45s (one missed beat is forgiven); a longer
// silence counts as a pause and credits nothing.
const MAX_TICK_CREDIT_SECONDS = 45;
const PAUSE_GAP_SECONDS = 75;

const EXERCISES_PER_BATCH = 5;

// Every AI-consuming call also charges a minimum amount of practice time.
// This keeps the daily cap enforceable purely server-side: a client that
// never sends heartbeats would otherwise keep 0 seconds "used" and generate
// AI exercises without limit.
const EXERCISE_BATCH_CHARGE_SECONDS = 15;
const GRADE_CHARGE_SECONDS = 10;

type Plan = "free" | "premium" | "owner";

function planOf(cap: number | null): Plan {
  if (cap === null) return "owner";
  return cap >= PREMIUM_DAILY_SECONDS ? "premium" : "free";
}

function usageFields(used: number, cap: number | null) {
  const remaining = cap === null ? null : Math.max(0, cap - used);
  return {
    usedSeconds: used,
    capSeconds: cap,
    remainingSeconds: remaining,
    locked: remaining !== null && remaining <= 0,
    resetsAt: nextResetISO(),
  };
}

async function usedSecondsToday(userId: string): Promise<number> {
  const [row] = await db
    .select({ secondsUsed: languageUsageTable.secondsUsed })
    .from(languageUsageTable)
    .where(and(eq(languageUsageTable.userId, userId), eq(languageUsageTable.day, dhakaDay())))
    .limit(1);
  return row?.secondsUsed ?? 0;
}

/**
 * Atomically credits practice time for today and returns the new total.
 * Credits the wall-clock gap since the last activity (capped at
 * MAX_TICK_CREDIT_SECONDS; a gap over PAUSE_GAP_SECONDS counts as a pause and
 * credits nothing) — but never less than `minCredit`. Accounting is SQL-side
 * (no read-then-write), so concurrent tabs/requests are safe.
 */
async function creditUsage(userId: string, minCredit: number): Promise<number> {
  const [row] = await db
    .insert(languageUsageTable)
    .values({ userId, day: dhakaDay(), secondsUsed: minCredit })
    .onConflictDoUpdate({
      target: [languageUsageTable.userId, languageUsageTable.day],
      set: {
        secondsUsed: sql`${languageUsageTable.secondsUsed} + GREATEST(
          CASE
            WHEN now() - ${languageUsageTable.lastTickAt} > make_interval(secs => ${PAUSE_GAP_SECONDS})
            THEN 0
            ELSE LEAST(
              GREATEST(FLOOR(EXTRACT(EPOCH FROM (now() - ${languageUsageTable.lastTickAt})))::int, 0),
              ${MAX_TICK_CREDIT_SECONDS}
            )
          END,
          ${minCredit}
        )`,
        lastTickAt: sql`now()`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ secondsUsed: languageUsageTable.secondsUsed });
  return row?.secondsUsed ?? minCredit;
}

/**
 * Atomic check-and-charge: charges at least `minCredit` seconds ONLY if the
 * user is still under `cap`. The cap check lives inside the UPDATE's WHERE
 * clause, so concurrent requests serialize on the row lock and re-evaluate the
 * cap — no read-then-write race. Worst case a single request pushes the total
 * slightly past the cap (bounded by one charge), never more.
 */
async function tryCharge(userId: string, cap: number, minCredit: number): Promise<boolean> {
  const day = dhakaDay();
  const chargeExpr = sql`${languageUsageTable.secondsUsed} + GREATEST(
    CASE
      WHEN now() - ${languageUsageTable.lastTickAt} > make_interval(secs => ${PAUSE_GAP_SECONDS})
      THEN 0
      ELSE LEAST(
        GREATEST(FLOOR(EXTRACT(EPOCH FROM (now() - ${languageUsageTable.lastTickAt})))::int, 0),
        ${MAX_TICK_CREDIT_SECONDS}
      )
    END,
    ${minCredit}
  )`;
  const attempt = () =>
    db
      .update(languageUsageTable)
      .set({ secondsUsed: chargeExpr, lastTickAt: sql`now()`, updatedAt: sql`now()` })
      .where(
        and(
          eq(languageUsageTable.userId, userId),
          eq(languageUsageTable.day, day),
          lt(languageUsageTable.secondsUsed, cap),
        ),
      )
      .returning({ secondsUsed: languageUsageTable.secondsUsed });

  if ((await attempt()).length > 0) return true;

  // No chargeable row: either no row yet today, or the user is at/over cap.
  const inserted = await db
    .insert(languageUsageTable)
    .values({ userId, day, secondsUsed: minCredit })
    .onConflictDoNothing()
    .returning({ secondsUsed: languageUsageTable.secondsUsed });
  if (inserted.length > 0) return true;

  // Row appeared concurrently — one final atomic attempt decides it.
  return (await attempt()).length > 0;
}

/**
 * Gate for AI-consuming endpoints: sends a 403 and returns false when today's
 * practice time is used up. When time remains, atomically charges at least
 * `minCredit` seconds so the cap holds even for clients that skip heartbeats.
 */
async function requireTimeAndCharge(
  req: Parameters<typeof dailyCapSeconds>[0],
  res: { status: (code: number) => { json: (body: unknown) => void } },
  userId: string,
  minCredit: number,
): Promise<boolean> {
  const cap = await dailyCapSeconds(req, userId);
  if (cap === null) return true; // owner — unlimited, nothing to meter
  if (!(await tryCharge(userId, cap, minCredit))) {
    res.status(403).json({
      error: "Your practice time for today is used up. Come back tomorrow!",
    });
    return false;
  }
  return true;
}

// ─── Overview ────────────────────────────────────────────────────────────────

// ─── Daily challenge (Duolingo-style) ────────────────────────────────────────
//
// A small, achievable goal that refreshes every Dhaka day, plus XP. This is a
// FREE feature for every tier — it is motivation, not AI, and gating it would
// punish exactly the students who need the habit most. The existing daily time
// caps are untouched: a challenge never grants extra practice time.

const XP_PER_CORRECT = 10;
const XP_PER_ATTEMPT = 2;

type ChallengeKind = "exercises" | "correct" | "words";

interface ChallengeSpec {
  kind: ChallengeKind;
  target: number;
  xpReward: number;
}

// Rotate deterministically by day so every student gets the same variety and
// the goal cannot be re-rolled by refreshing.
const CHALLENGE_ROTATION: ChallengeSpec[] = [
  { kind: "exercises", target: 10, xpReward: 20 },
  { kind: "correct", target: 8, xpReward: 30 },
  { kind: "words", target: 3, xpReward: 25 },
  { kind: "exercises", target: 15, xpReward: 30 },
  { kind: "correct", target: 5, xpReward: 20 },
];

function challengeForDay(day: string): ChallengeSpec {
  // Stable hash of YYYY-MM-DD → rotation index.
  let hash = 0;
  for (let i = 0; i < day.length; i++) hash = (hash * 31 + day.charCodeAt(i)) >>> 0;
  return CHALLENGE_ROTATION[hash % CHALLENGE_ROTATION.length];
}

export function describeChallenge(kind: string, target: number): string {
  switch (kind) {
    case "correct":
      return `Answer ${target} exercises correctly`;
    case "words":
      return `Learn ${target} new words`;
    default:
      return `Complete ${target} exercises`;
  }
}

// XP levels grow gently: level N needs 100 * N XP in total. Keeps early
// levels fast (the motivating part) without runaway numbers later.
export function levelFields(xp: number) {
  const safeXp = Math.max(0, Math.floor(xp));
  let level = 1;
  let spent = 0;
  let need = 100;
  while (safeXp - spent >= need) {
    spent += need;
    level += 1;
    need = 100 * level;
  }
  return {
    level,
    xpIntoLevel: safeXp - spent,
    xpForNextLevel: need,
  };
}

/** Fetch today's challenge row, creating it on first view of the day. */
async function getOrCreateChallenge(userId: string, day: string) {
  const spec = challengeForDay(day);
  await db
    .insert(languageDailyChallengeTable)
    .values({ userId, day, kind: spec.kind, target: spec.target, xpReward: spec.xpReward })
    .onConflictDoNothing();

  const [row] = await db
    .select()
    .from(languageDailyChallengeTable)
    .where(
      and(
        eq(languageDailyChallengeTable.userId, userId),
        eq(languageDailyChallengeTable.day, day),
      ),
    )
    .limit(1);
  return row;
}

function challengePayload(row: typeof languageDailyChallengeTable.$inferSelect | undefined) {
  if (!row) return null;
  const progress = Math.min(row.progress, row.target);
  return {
    kind: row.kind,
    description: describeChallenge(row.kind, row.target),
    target: row.target,
    progress,
    completed: !!row.completedAt,
    xpReward: row.xpReward,
  };
}

/**
 * Advance today's challenge after a graded answer and award XP.
 * All counter math is SQL-side so concurrent answers cannot lose progress.
 * Returns the XP awarded and whether this answer completed the challenge.
 */
async function advanceChallenge(
  userId: string,
  day: string,
  opts: { correct: boolean; learnedWord: boolean },
): Promise<{ xpAwarded: number; justCompleted: boolean; challenge: ReturnType<typeof challengePayload> }> {
  const row = await getOrCreateChallenge(userId, day);
  if (!row) return { xpAwarded: 0, justCompleted: false, challenge: null };

  let delta = 0;
  if (row.kind === "exercises") delta = 1;
  else if (row.kind === "correct") delta = opts.correct ? 1 : 0;
  else if (row.kind === "words") delta = opts.learnedWord ? 1 : 0;

  let updated = row;
  if (delta > 0 && !row.completedAt) {
    // Stamp completedAt in the same statement that crosses the target, so the
    // bonus can only ever be paid once even under concurrent requests.
    const [next] = await db
      .update(languageDailyChallengeTable)
      .set({
        progress: sql`LEAST(${languageDailyChallengeTable.progress} + ${delta}, ${languageDailyChallengeTable.target})`,
        completedAt: sql`CASE
          WHEN ${languageDailyChallengeTable.completedAt} IS NULL
           AND ${languageDailyChallengeTable.progress} + ${delta} >= ${languageDailyChallengeTable.target}
          THEN now() ELSE ${languageDailyChallengeTable.completedAt} END`,
      })
      .where(
        and(
          eq(languageDailyChallengeTable.id, row.id),
          sql`${languageDailyChallengeTable.completedAt} IS NULL`,
        ),
      )
      .returning();
    if (next) updated = next;
  }

  const justCompleted = !row.completedAt && !!updated.completedAt;
  const xpAwarded =
    (opts.correct ? XP_PER_CORRECT : XP_PER_ATTEMPT) + (justCompleted ? updated.xpReward : 0);

  return { xpAwarded, justCompleted, challenge: challengePayload(updated) };
}

router.get("/language/overview", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const lang = pickLanguage(req.query.language);

  const cap = await dailyCapSeconds(req, userId);
  const used = await usedSecondsToday(userId);

  const [progress] = await db
    .select()
    .from(languageProgressTable)
    .where(eq(languageProgressTable.userId, userId))
    .limit(1);

  const recentWords = await db
    .select()
    .from(languageWordsTable)
    .where(and(eq(languageWordsTable.userId, userId), eq(languageWordsTable.language, lang)))
    .orderBy(desc(languageWordsTable.learnedAt))
    .limit(12);

  const [wordCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(languageWordsTable)
    .where(and(eq(languageWordsTable.userId, userId), eq(languageWordsTable.language, lang)));

  // A streak only counts if the student practiced today or yesterday.
  const today = dhakaDay();
  const yesterday = dhakaYesterday();
  const streak =
    progress && (progress.lastActiveDay === today || progress.lastActiveDay === yesterday)
      ? progress.streak
      : 0;

  const challenge = await getOrCreateChallenge(userId, today);
  const xp = progress?.xp ?? 0;

  res.json({
    ...usageFields(used, cap),
    plan: planOf(cap),
    streak,
    bestStreak: progress?.bestStreak ?? 0,
    exercisesCompleted: progress?.exercisesCompleted ?? 0,
    correctAnswers: progress?.correctAnswers ?? 0,
    wordsLearned: wordCount?.count ?? 0,
    practicedToday: progress?.lastActiveDay === today,
    xp,
    ...levelFields(xp),
    dailyChallenge: challengePayload(challenge),
    recentWords: recentWords.map((w) => ({
      word: w.word,
      meaning: w.meaning,
      meaningBangla: w.meaningBangla,
      example: w.example,
    })),
  });
});

// ─── Heartbeat ───────────────────────────────────────────────────────────────

router.post("/language/tick", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const cap = await dailyCapSeconds(req, userId);
  const used = await creditUsage(userId, 0);
  res.json({ ...usageFields(used, cap), plan: planOf(cap) });
});

// ─── Exercise generation ─────────────────────────────────────────────────────

// "listen" and "match" are the Duolingo-style drills: hear-and-type (spoken by
// the browser's speech synthesis, so no audio files are needed) and tap-the-
// matching-pairs. Both are graded locally by comparison, so they cost no extra
// AI calls beyond the batch that generated them.
const MODES = ["vocab", "grammar", "sentence", "translate", "listen", "match"] as const;
type Mode = (typeof MODES)[number];
const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
const LANGUAGES = ["English", "Spanish", "French", "Portuguese", "German", "Arabic", "Hindi", "Japanese", "Chinese", "Korean", "Turkish", "Italian"] as const;
type TargetLanguage = (typeof LANGUAGES)[number];

function pickLanguage(value: unknown): TargetLanguage {
  return typeof value === "string" && LANGUAGES.includes(value as TargetLanguage)
    ? (value as TargetLanguage)
    : "English";
}

interface RawExercise {
  type?: unknown;
  word?: unknown;
  question?: unknown;
  options?: unknown;
  correctIndex?: unknown;
  meaning?: unknown;
  meaningBangla?: unknown;
  example?: unknown;
  explanation?: unknown;
  incorrect?: unknown;
  hint?: unknown;
  sentence?: unknown;
  translation?: unknown;
  glossary?: unknown;
  pairs?: unknown;
}

const str = (v: unknown, max = 600): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

// Word-by-word gloss: [{term: "hola", english: "hello"}, ...]
function cleanGlossary(v: unknown): Array<{ term: string; english: string }> {
  if (!Array.isArray(v)) return [];
  return v
    .map((g) => ({
      term: str((g as { term?: unknown })?.term, 80),
      english: str((g as { english?: unknown })?.english, 120),
    }))
    .filter((g) => g.term && g.english)
    .slice(0, 40);
}

function cleanExercise(raw: RawExercise, mode: Mode): Record<string, unknown> | null {
  if (mode === "vocab" || mode === "grammar") {
    const options = Array.isArray(raw.options) ? raw.options.map((o) => str(o, 200)).filter(Boolean) : [];
    const correctIndex = Number(raw.correctIndex);
    const question = str(raw.question, 400);
    if (options.length < 2 || !Number.isInteger(correctIndex)) return null;
    if (correctIndex < 0 || correctIndex >= options.length) return null;
    if (!question) return null;
    if (mode === "vocab") {
      const word = str(raw.word, 80);
      if (!word) return null;
      return {
        type: "vocab",
        word,
        question,
        options,
        correctIndex,
        meaning: str(raw.meaning, 300),
        meaningBangla: str(raw.meaningBangla, 300),
        example: str(raw.example, 300),
        explanation: str(raw.explanation),
        translation: str(raw.translation, 300),
        glossary: cleanGlossary(raw.glossary),
      };
    }
    return {
      type: "grammar",
      question,
      options,
      correctIndex,
      explanation: str(raw.explanation),
      glossary: cleanGlossary(raw.glossary),
    };
  }
  if (mode === "translate") {
    const sentence = str(raw.sentence, 400);
    if (!sentence) return null;
    return { type: "translate", sentence, hint: str(raw.hint, 300), glossary: cleanGlossary(raw.glossary) };
  }
  if (mode === "listen") {
    // The client speaks `sentence` aloud and hides it until the answer is in.
    const sentence = str(raw.sentence, 300);
    if (!sentence) return null;
    return {
      type: "listen",
      sentence,
      translation: str(raw.translation, 300),
      hint: str(raw.hint, 300),
      glossary: cleanGlossary(raw.glossary),
    };
  }
  if (mode === "match") {
    // 4-6 term/english pairs the student taps together.
    const pairs = cleanGlossary(raw.pairs);
    if (pairs.length < 3) return null;
    return { type: "match", pairs: pairs.slice(0, 6), question: str(raw.question, 200) };
  }
  const incorrect = str(raw.incorrect, 400);
  if (!incorrect) return null;
  return {
    type: "sentence",
    incorrect,
    hint: str(raw.hint, 300),
    translation: str(raw.translation, 300),
    glossary: cleanGlossary(raw.glossary),
  };
}

router.post("/language/exercises", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const { mode, difficulty, language } = (req.body ?? {}) as {
    mode?: unknown;
    difficulty?: unknown;
    language?: unknown;
  };
  const lang = pickLanguage(language);

  if (typeof mode !== "string" || !MODES.includes(mode as Mode)) {
    res.status(400).json({ error: `mode must be one of: ${MODES.join(", ")}` });
    return;
  }
  const level =
    typeof difficulty === "string" && DIFFICULTIES.includes(difficulty as (typeof DIFFICULTIES)[number])
      ? difficulty
      : "intermediate";

  if (!(await requireTimeAndCharge(req, res, userId, EXERCISE_BATCH_CHARGE_SECONDS))) return;

  let userPrompt: string;
  if (mode === "vocab") {
    // Avoid re-teaching words the student already learned.
    const known = await db
      .select({ word: languageWordsTable.word })
      .from(languageWordsTable)
      .where(and(eq(languageWordsTable.userId, userId), eq(languageWordsTable.language, lang)))
      .orderBy(desc(languageWordsTable.learnedAt))
      .limit(25);
    const avoid = known.length
      ? ` Do NOT use any of these words the student already knows: ${known.map((k) => k.word).join(", ")}.`
      : "";
    userPrompt =
      `Create ${EXERCISES_PER_BATCH} ${lang} vocabulary exercises at ${level} level for a Bangla-speaking school student in Bangladesh learning ${lang}.` +
      ` Pick genuinely useful everyday and academic ${lang} words.${avoid}` +
      ` For each exercise give: the word; a question in simple English like "What does \u2018<word>\u2019 mean?"; exactly 4 short answer options in simple English with only one correct; the 0-based index of the correct option;` +
      ` the correct meaning in simple English; the meaning in Bangla (বাংলা script); one natural ${lang} example sentence; a friendly 1-2 sentence explanation in simple English that helps the student remember the word;` +
      ` the full English translation of the example sentence; and a glossary that translates EVERY word of the example sentence into simple English, in order.` +
      ` Respond as JSON exactly matching: {"exercises":[{"type":"vocab","word":"...","question":"...","options":["...","...","...","..."],"correctIndex":0,"meaning":"...","meaningBangla":"...","example":"...","explanation":"...","translation":"...","glossary":[{"term":"...","english":"..."}]}]}`;
  } else if (mode === "grammar") {
    userPrompt =
      `Create ${EXERCISES_PER_BATCH} ${lang} grammar multiple-choice exercises at ${level} level for a Bangla-speaking school student in Bangladesh learning ${lang}.` +
      ` Write questions and explanations in simple English. Mix fill-in-the-blank and "choose the correct sentence" questions covering the core grammar of ${lang} (e.g. tenses, articles, word order, agreement — whatever applies to ${lang}).` +
      ` Each has exactly 4 options with only one correct, plus a friendly 1-2 sentence explanation that teaches the underlying rule simply.` +
      ` Also include a glossary translating EVERY ${lang} word that appears in the question or options into simple English (skip words that are already English).` +
      ` Respond as JSON exactly matching: {"exercises":[{"type":"grammar","question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"...","glossary":[{"term":"...","english":"..."}]}]}`;
  } else if (mode === "translate") {
    userPrompt =
      `Create ${EXERCISES_PER_BATCH} "translate to English" exercises at ${level} level for a Bangla-speaking school student learning ${lang}.` +
      ` Each is one short, natural, everyday ${lang} sentence (in the normal script of ${lang}) that the student must translate into English.` +
      ` Keep sentences simple and useful for daily life at ${level} level.` +
      ` Include a short hint in simple English (e.g. the meaning of one tricky word) that nudges the student without giving away the full translation.` +
      ` Also include a glossary translating EVERY word of the ${lang} sentence into simple English, in sentence order, so a complete beginner can work it out word by word.` +
      ` Respond as JSON exactly matching: {"exercises":[{"type":"translate","sentence":"...","hint":"...","glossary":[{"term":"...","english":"..."}]}]}`;
  } else if (mode === "listen") {
    userPrompt =
      `Create ${EXERCISES_PER_BATCH} listening exercises at ${level} level for a Bangla-speaking school student learning ${lang}.` +
      ` Each is ONE short, natural, everyday ${lang} sentence (4-10 words) that will be read aloud to the student, who must type exactly what they hear.` +
      ` Use only common words and plain punctuation so the sentence is easy to hear and spell at ${level} level. Do not use numerals — write numbers as words.` +
      ` Also give the full English translation, a short hint in simple English about the topic of the sentence (never the words themselves), and a glossary translating EVERY word of the sentence into simple English, in order.` +
      ` Respond as JSON exactly matching: {"exercises":[{"type":"listen","sentence":"...","translation":"...","hint":"...","glossary":[{"term":"...","english":"..."}]}]}`;
  } else if (mode === "match") {
    const known = await db
      .select({ word: languageWordsTable.word })
      .from(languageWordsTable)
      .where(and(eq(languageWordsTable.userId, userId), eq(languageWordsTable.language, lang)))
      .orderBy(desc(languageWordsTable.learnedAt))
      .limit(20);
    const revise = known.length
      ? ` Where they fit naturally, reuse some of these words the student has already met so this doubles as revision: ${known.map((k) => k.word).join(", ")}.`
      : "";
    userPrompt =
      `Create ${EXERCISES_PER_BATCH} "match the pairs" exercises at ${level} level for a Bangla-speaking school student learning ${lang}.` +
      ` Each exercise is a set of exactly 5 pairs: a ${lang} word (in the normal script of ${lang}) and its simple English meaning.${revise}` +
      ` Within one exercise, keep the words related to a single everyday theme (e.g. food, school, family, travel) and make sure no two English meanings are synonyms, so each pair has exactly one correct match.` +
      ` Also give a short title for the theme as the question, like "Match the food words".` +
      ` Respond as JSON exactly matching: {"exercises":[{"type":"match","question":"...","pairs":[{"term":"...","english":"..."}]}]}`;
  } else {
    userPrompt =
      `Create ${EXERCISES_PER_BATCH} "fix the sentence" exercises at ${level} level for a Bangla-speaking school student learning ${lang}.` +
      ` Each is a short ${lang} sentence containing 1-2 realistic mistakes that learners of ${lang} commonly make (e.g. articles, tense, prepositions, agreement, word order — whatever applies to ${lang}).` +
      ` Include a short hint in simple English that nudges the student without giving the answer away.` +
      ` Also include the English translation of what the sentence is trying to say, and a glossary translating EVERY word of the sentence into simple English, in sentence order.` +
      ` Respond as JSON exactly matching: {"exercises":[{"type":"sentence","incorrect":"...","hint":"...","translation":"...","glossary":[{"term":"...","english":"..."}]}]}`;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: PREMIUM_AI_MODEL,
      max_completion_tokens: 5000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            `You are LearnMate AI's friendly ${lang} practice coach for Bangla-speaking students in Bangladesh. You write clear, encouraging exercises at exactly the requested level. You respond ONLY with valid JSON.`,
        },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(502).json({ error: "The AI returned an unreadable response. Please try again." });
      return;
    }

    const list = (parsed as { exercises?: unknown }).exercises;
    const cleaned = Array.isArray(list)
      ? list
          .map((e) => cleanExercise((e ?? {}) as RawExercise, mode as Mode))
          .filter((e): e is Record<string, unknown> => e !== null)
      : [];

    if (cleaned.length === 0) {
      res.status(502).json({ error: "The AI did not return any exercises. Please try again." });
      return;
    }

    res.json({ exercises: cleaned });
  } catch (err) {
    req.log?.error({ err }, "language exercise generation failed");
    res.status(502).json({ error: "AI generation failed. Please try again." });
  }
});

// ─── Sentence grading ────────────────────────────────────────────────────────

router.post("/language/grade-sentence", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const { incorrect, answer, language } = (req.body ?? {}) as {
    incorrect?: unknown;
    answer?: unknown;
    language?: unknown;
  };
  const lang = pickLanguage(language);

  const cleanIncorrect = str(incorrect, 500);
  const cleanAnswer = str(answer, 500);
  if (!cleanIncorrect || !cleanAnswer) {
    res.status(400).json({ error: "Both the sentence and your correction are required" });
    return;
  }

  if (!(await requireTimeAndCharge(req, res, userId, GRADE_CHARGE_SECONDS))) return;

  try {
    const completion = await openai.chat.completions.create({
      model: PREMIUM_AI_MODEL,
      max_completion_tokens: 5000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            `You are a kind ${lang} teacher grading a Bangla-speaking student's sentence correction. Give feedback in simple English. Accept any natural, grammatically correct rewrite that fixes the errors — it does not have to match one exact answer. You respond ONLY with valid JSON.`,
        },
        {
          role: "user",
          content:
            `The exercise sentence (contains mistakes): "${cleanIncorrect}"\n` +
            `The student's corrected version: "${cleanAnswer}"\n\n` +
            `Grade it. Respond as JSON exactly matching: ` +
            `{"correct":true,"corrected":"the best corrected version of the sentence","feedback":"1-2 friendly sentences: praise what they fixed, and explain any remaining mistake simply"}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    let parsed: { correct?: unknown; corrected?: unknown; feedback?: unknown };
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      res.status(502).json({ error: "The AI returned an unreadable response. Please try again." });
      return;
    }

    if (typeof parsed.correct !== "boolean") {
      res.status(502).json({ error: "The AI response was incomplete. Please try again." });
      return;
    }

    res.json({
      correct: parsed.correct,
      corrected: str(parsed.corrected, 500),
      feedback: str(parsed.feedback, 800),
    });
  } catch (err) {
    req.log?.error({ err }, "sentence grading failed");
    res.status(502).json({ error: "AI grading failed. Please try again." });
  }
});

// ─── Translation grading ─────────────────────────────────────────────────────

router.post("/language/grade-translation", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const { sentence, answer, language } = (req.body ?? {}) as {
    sentence?: unknown;
    answer?: unknown;
    language?: unknown;
  };
  const lang = pickLanguage(language);

  const cleanSentence = str(sentence, 500);
  const cleanAnswer = str(answer, 500);
  if (!cleanSentence || !cleanAnswer) {
    res.status(400).json({ error: "Both the sentence and your translation are required" });
    return;
  }

  if (!(await requireTimeAndCharge(req, res, userId, GRADE_CHARGE_SECONDS))) return;

  try {
    const completion = await openai.chat.completions.create({
      model: PREMIUM_AI_MODEL,
      max_completion_tokens: 5000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            `You are a kind ${lang} teacher grading a Bangla-speaking student's English translation of a ${lang} sentence. Give feedback in simple English. Accept any natural, correct English translation that keeps the meaning — it does not have to match one exact answer. You respond ONLY with valid JSON.`,
        },
        {
          role: "user",
          content:
            `The ${lang} sentence: "${cleanSentence}"\n` +
            `The student's English translation: "${cleanAnswer}"\n\n` +
            `Grade it. Respond as JSON exactly matching: ` +
            `{"correct":true,"corrected":"the best natural English translation","feedback":"1-2 friendly sentences: praise what they got right, and explain any mistake simply"}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    let parsed: { correct?: unknown; corrected?: unknown; feedback?: unknown };
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      res.status(502).json({ error: "The AI returned an unreadable response. Please try again." });
      return;
    }

    if (typeof parsed.correct !== "boolean") {
      res.status(502).json({ error: "The AI response was incomplete. Please try again." });
      return;
    }

    res.json({
      correct: parsed.correct,
      corrected: str(parsed.corrected, 500),
      feedback: str(parsed.feedback, 800),
    });
  } catch (err) {
    req.log?.error({ err }, "translation grading failed");
    res.status(502).json({ error: "AI grading failed. Please try again." });
  }
});

// ─── Level suggestion ────────────────────────────────────────────────────────

// Look at the last ANSWER_WINDOW answers at the student's current difficulty
// (per language). Consistently high accuracy suggests moving up; consistently
// low accuracy suggests stepping down. Purely a suggestion — never forced.
const ANSWER_WINDOW = 20;
const MIN_ANSWERS_FOR_SUGGESTION = 10;
const LEVEL_UP_ACCURACY = 0.85; // strictly above → suggest next level
const LEVEL_DOWN_ACCURACY = 0.5; // strictly below → suggest easier level

type LevelSuggestion = {
  direction: "up" | "down";
  suggested: (typeof DIFFICULTIES)[number];
  accuracy: number;
  sampleSize: number;
} | null;

async function computeLevelSuggestion(
  userId: string,
  language: TargetLanguage,
  difficulty: (typeof DIFFICULTIES)[number],
): Promise<LevelSuggestion> {
  const recent = await db
    .select({ correct: languageAnswersTable.correct })
    .from(languageAnswersTable)
    .where(
      and(
        eq(languageAnswersTable.userId, userId),
        eq(languageAnswersTable.language, language),
        eq(languageAnswersTable.difficulty, difficulty),
      ),
    )
    .orderBy(desc(languageAnswersTable.answeredAt), desc(languageAnswersTable.id))
    .limit(ANSWER_WINDOW);

  if (recent.length < MIN_ANSWERS_FOR_SUGGESTION) return null;

  const accuracy = recent.reduce((s, r) => s + r.correct, 0) / recent.length;
  const idx = DIFFICULTIES.indexOf(difficulty);

  if (accuracy > LEVEL_UP_ACCURACY && idx < DIFFICULTIES.length - 1) {
    return { direction: "up", suggested: DIFFICULTIES[idx + 1], accuracy, sampleSize: recent.length };
  }
  if (accuracy < LEVEL_DOWN_ACCURACY && idx > 0) {
    return { direction: "down", suggested: DIFFICULTIES[idx - 1], accuracy, sampleSize: recent.length };
  }
  return null;
}

// ─── Record a completed exercise ─────────────────────────────────────────────

router.post("/language/complete", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const body = (req.body ?? {}) as {
    type?: unknown;
    correct?: unknown;
    word?: unknown;
    meaning?: unknown;
    meaningBangla?: unknown;
    example?: unknown;
    language?: unknown;
    difficulty?: unknown;
  };
  const lang = pickLanguage(body.language);
  const difficulty =
    typeof body.difficulty === "string" &&
    DIFFICULTIES.includes(body.difficulty as (typeof DIFFICULTIES)[number])
      ? (body.difficulty as (typeof DIFFICULTIES)[number])
      : "intermediate";

  if (typeof body.type !== "string" || !MODES.includes(body.type as Mode)) {
    res.status(400).json({ error: `type must be one of: ${MODES.join(", ")}` });
    return;
  }
  if (typeof body.correct !== "boolean") {
    res.status(400).json({ error: "correct must be a boolean" });
    return;
  }

  const today = dhakaDay();
  const yesterday = dhakaYesterday();

  // Log the answer so recent accuracy can drive level suggestions.
  await db.insert(languageAnswersTable).values({
    userId,
    language: lang,
    difficulty,
    correct: body.correct ? 1 : 0,
  });

  // Same-day concurrent updates compute identical streak values, so this
  // read-compute-upsert is safe; counters are still incremented SQL-side.
  const [progress] = await db
    .select()
    .from(languageProgressTable)
    .where(eq(languageProgressTable.userId, userId))
    .limit(1);

  let streak = 1;
  if (progress?.lastActiveDay === today) {
    streak = Math.max(progress.streak, 1);
  } else if (progress?.lastActiveDay === yesterday) {
    streak = progress.streak + 1;
  }
  const bestStreak = Math.max(progress?.bestStreak ?? 0, streak);
  const correctDelta = body.correct ? 1 : 0;

  // A vocab word is "learned" the first time it is answered correctly.
  const word = str(body.word, 80);
  const learnsWord = body.type === "vocab" && body.correct && !!word;
  const { xpAwarded, justCompleted, challenge } = await advanceChallenge(userId, today, {
    correct: body.correct,
    learnedWord: learnsWord,
  });

  const [updated] = await db
    .insert(languageProgressTable)
    .values({
      userId,
      streak,
      bestStreak,
      lastActiveDay: today,
      exercisesCompleted: 1,
      correctAnswers: correctDelta,
      xp: xpAwarded,
    })
    .onConflictDoUpdate({
      target: languageProgressTable.userId,
      set: {
        streak,
        bestStreak,
        lastActiveDay: today,
        exercisesCompleted: sql`${languageProgressTable.exercisesCompleted} + 1`,
        correctAnswers: sql`${languageProgressTable.correctAnswers} + ${correctDelta}`,
        xp: sql`${languageProgressTable.xp} + ${xpAwarded}`,
        updatedAt: sql`now()`,
      },
    })
    .returning();

  // A correctly answered vocab exercise adds the word to the student's list.
  if (learnsWord) {
    await db
      .insert(languageWordsTable)
      .values({
        userId,
        word,
        language: lang,
        meaning: str(body.meaning, 300),
        meaningBangla: str(body.meaningBangla, 300),
        example: str(body.example, 300),
      })
      .onConflictDoNothing();
  }

  const [wordCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(languageWordsTable)
    .where(and(eq(languageWordsTable.userId, userId), eq(languageWordsTable.language, lang)));

  const levelSuggestion = await computeLevelSuggestion(userId, lang, difficulty);

  res.json({
    streak: updated?.streak ?? streak,
    bestStreak: updated?.bestStreak ?? bestStreak,
    exercisesCompleted: updated?.exercisesCompleted ?? 1,
    correctAnswers: updated?.correctAnswers ?? correctDelta,
    wordsLearned: wordCount?.count ?? 0,
    levelSuggestion,
    xpAwarded,
    xp: updated?.xp ?? xpAwarded,
    ...levelFields(updated?.xp ?? xpAwarded),
    dailyChallenge: challenge,
    challengeCompleted: justCompleted,
  });
});

export default router;
