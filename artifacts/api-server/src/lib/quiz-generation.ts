/**
 * Quiz question generation.
 *
 * Previously every text quiz came from the Open Trivia DB. That had three
 * problems for a study app:
 *   1. Relevance — OTDB is a pub-quiz database. A student revising
 *      "photosynthesis" or "quadratic equations" got random science/maths
 *      trivia, because the subject was only mapped to a coarse category id.
 *   2. Teaching value — the stored explanation was literally
 *      "Category: Science · Difficulty: medium", which teaches nothing. The
 *      review screen after a quiz is the single best moment to explain why an
 *      answer is right, and it was wasted.
 *   3. Reliability — a hard dependency on a third-party API with no fallback,
 *      so an OTDB outage returned 503 and the student could not revise at all.
 *
 * Now: generate questions with the AI model on the student's actual topic,
 * with a real explanation for every question, and keep OTDB as a fallback so
 * the feature still works if the AI provider is unavailable. If both fail the
 * caller surfaces an error.
 */

import { openai, PREMIUM_AI_MODEL } from "./openai";

export interface GeneratedQuestion {
  question: string;
  type: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export const LETTERS = ["A", "B", "C", "D"];

export type Difficulty = "easy" | "medium" | "hard";

export function normalizeDifficulty(value: unknown): Difficulty {
  const d = String(value ?? "medium").toLowerCase();
  return d === "easy" || d === "hard" ? d : "medium";
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Strip HTML tags and decode entities.
 *
 * OTDB returns HTML-encoded text, and AI models occasionally emit stray tags.
 * Either would be shown to the student verbatim, since the client renders
 * plain text nodes.
 */
export function cleanText(input: string): string {
  const entities: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    ldquo: "\u201C", rdquo: "\u201D", lsquo: "\u2018", rsquo: "\u2019",
    ndash: "\u2013", mdash: "\u2014", hellip: "\u2026", eacute: "\u00E9",
    egrave: "\u00E8", agrave: "\u00E0", uuml: "\u00FC", ouml: "\u00F6",
    auml: "\u00E4", szlig: "\u00DF", oslash: "\u00F8", ntilde: "\u00F1",
    deg: "\u00B0", times: "\u00D7", divide: "\u00F7", frac12: "\u00BD",
  };
  return input
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?\/?>/g, "")
    .replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body: string) => {
      if (body[0] === "#") {
        const code =
          body[1] === "x" || body[1] === "X"
            ? Number.parseInt(body.slice(2), 16)
            : Number.parseInt(body.slice(1), 10);
        if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
          try {
            return String.fromCodePoint(code);
          } catch {
            return whole;
          }
        }
        return whole;
      }
      return entities[body.toLowerCase()] ?? whole;
    })
    .replace(/\s+/g, " ")
    .trim();
}

// ─── AI generation ───────────────────────────────────────────────────────────

const DIFFICULTY_BRIEF: Record<Difficulty, string> = {
  easy: "Recall and basic understanding. Test definitions, core facts and one-step reasoning.",
  medium: "Application. Require the student to apply a concept or take two or three reasoning steps.",
  hard: "Analysis and synthesis. Combine several ideas, include common misconceptions as distractors, and require multi-step reasoning.",
};

export function buildQuizPrompt(
  subject: string,
  count: number,
  difficulty: Difficulty,
  examType?: string | null,
): { system: string; user: string } {
  const system = [
    "You are an experienced teacher writing revision questions for a student.",
    "Write questions that test understanding of the requested topic - never general trivia.",
    "Every question must have exactly four options with exactly one unambiguously correct answer.",
    "Wrong options must be plausible and reflect real mistakes students make, never joke answers.",
    "The explanation must teach: say why the correct answer is correct, and where it helps, why the tempting wrong answer is wrong. Two or three sentences.",
    "Use plain text only. No HTML tags, no HTML entities, no markdown formatting.",
    "Do not number the options or prefix them with letters; give the option text only.",
    "Output valid JSON only.",
  ].join("\n");

  const user = [
    `Topic: ${subject}`,
    examType ? `Exam context: ${examType}. Match that exam's style and scope.` : "",
    `Number of questions: ${count}`,
    `Difficulty: ${difficulty}. ${DIFFICULTY_BRIEF[difficulty]}`,
    "",
    "Cover different sub-areas of the topic rather than asking the same thing repeatedly.",
    "",
    'Respond with JSON exactly matching: {"questions":[{"question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."}]}',
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}

/**
 * Validate and normalise one AI question. Returns null when the item is
 * unusable, so a single bad question never corrupts a whole quiz.
 */
export function parseAiQuestion(raw: unknown): GeneratedQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Record<string, unknown>;

  const question = typeof q.question === "string" ? cleanText(q.question) : "";
  if (!question) return null;

  if (!Array.isArray(q.options)) return null;
  const options = q.options
    .filter((o): o is string => typeof o === "string")
    .map(cleanText)
    .filter((o) => o.length > 0);
  if (options.length !== 4) return null;

  // Duplicate options make a question unanswerable.
  if (new Set(options.map((o) => o.toLowerCase())).size !== 4) return null;

  const idx = Number(q.correctIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx > 3) return null;

  const explanation =
    typeof q.explanation === "string" && q.explanation.trim()
      ? cleanText(q.explanation)
      : "";
  if (!explanation) return null;

  const labelled = options.map((o, i) => `${LETTERS[i]}. ${o}`);
  return {
    question,
    type: "multiple_choice",
    options: labelled,
    correctAnswer: labelled[idx],
    explanation,
  };
}

export async function generateWithAi(
  subject: string,
  count: number,
  difficulty: Difficulty,
  examType?: string | null,
): Promise<GeneratedQuestion[]> {
  const { system, user } = buildQuizPrompt(subject, count, difficulty, examType);

  const completion = await openai.chat.completions.create({
    model: PREMIUM_AI_MODEL,
    response_format: { type: "json_object" },
    max_completion_tokens: 5000,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content;
  if (!raw) throw new Error("AI returned an empty response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("AI returned malformed JSON");
  }

  const list = (parsed as { questions?: unknown }).questions;
  if (!Array.isArray(list)) throw new Error("AI response had no questions array");

  const questions: GeneratedQuestion[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const q = parseAiQuestion(item);
    if (!q) continue;
    // Drop repeats — models sometimes restate the same question.
    const key = q.question.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    questions.push(q);
    if (questions.length >= count) break;
  }

  if (questions.length === 0) throw new Error("AI returned no usable questions");
  return questions;
}

// ─── Open Trivia DB fallback ─────────────────────────────────────────────────

const OTDB_CATEGORY: Record<string, number> = {
  math: 19, mathematics: 19, algebra: 19, geometry: 19, calculus: 19, arithmetic: 19, statistics: 19,
  science: 17, biology: 17, chemistry: 17, physics: 17, nature: 17, anatomy: 17,
  computer: 18, programming: 18, technology: 18, coding: 18,
  history: 23,
  geography: 22,
  literature: 10, english: 10, reading: 10, books: 10,
  art: 25,
  music: 12,
  sports: 21, football: 21, basketball: 21,
};

export function getCategory(subject: string): number {
  const lower = subject.toLowerCase();
  for (const [key, id] of Object.entries(OTDB_CATEGORY)) {
    if (lower.includes(key)) return id;
  }
  return 9; // General Knowledge
}

export async function fetchFromOTDB(
  count: number,
  categoryId: number,
  difficulty: Difficulty,
): Promise<GeneratedQuestion[]> {
  const url = `https://opentdb.com/api.php?amount=${count}&category=${categoryId}&difficulty=${difficulty}&type=multiple`;

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`OTDB request failed: ${res.status}`);
  const data = (await res.json()) as { response_code: number; results?: any[] };

  // response_code 1 = not enough questions for category — fall back to general
  if (data.response_code === 1 && categoryId !== 9) {
    const fallbackUrl = `https://opentdb.com/api.php?amount=${count}&category=9&difficulty=${difficulty}&type=multiple`;
    const fr = await fetch(fallbackUrl, { signal: AbortSignal.timeout(8000) });
    const fd = (await fr.json()) as { response_code: number; results?: any[] };
    if (fd.response_code === 0 && fd.results) data.results = fd.results;
    else throw new Error("OTDB returned no results");
  } else if (data.response_code !== 0 || !data.results?.length) {
    throw new Error("OTDB returned no results");
  }

  return data.results!.map((q: any) => {
    const wrong: string[] = q.incorrect_answers.map(cleanText);
    const correct = cleanText(q.correct_answer);
    const shuffled = shuffle([...wrong, correct]);
    const options = shuffled.map((a, i) => `${LETTERS[i]}. ${a}`);
    const correctIdx = shuffled.indexOf(correct);
    return {
      question: cleanText(q.question),
      type: "multiple_choice",
      options,
      correctAnswer: options[correctIdx],
      // Still not a real teaching explanation, but state the answer plainly
      // rather than echoing the category back at the student.
      explanation: `The correct answer is ${correct}. (${cleanText(q.category)}, ${q.difficulty} difficulty.)`,
    };
  });
}

/**
 * Generate quiz questions for a subject: AI first (accurate to the requested
 * topic, with teaching explanations), Open Trivia DB as a fallback so an AI
 * outage does not take the whole feature down.
 */
export async function generateQuestions(
  subject: string,
  count: number,
  difficulty: Difficulty,
  examType?: string | null,
  log?: { warn: (o: unknown, m: string) => void },
): Promise<{ questions: GeneratedQuestion[]; source: "ai" | "otdb" }> {
  try {
    const questions = await generateWithAi(subject, count, difficulty, examType);
    return { questions, source: "ai" };
  } catch (err) {
    log?.warn({ err }, "AI quiz generation failed; falling back to Open Trivia DB");
  }

  const questions = await fetchFromOTDB(count, getCategory(subject), difficulty);
  return { questions, source: "otdb" };
}
