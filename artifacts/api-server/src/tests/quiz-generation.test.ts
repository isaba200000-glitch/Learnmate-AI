/**
 * Quiz generation tests.
 *
 * The important behaviours here are the ones that make a quiz worth taking:
 * questions on the student's actual topic, four usable options, and an
 * explanation that teaches rather than restating the category. Also covers the
 * AI -> Open Trivia DB fallback so an AI outage does not break quizzes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const aiCreate = vi.fn();
vi.mock("../lib/openai", () => ({
  openai: { chat: { completions: { create: (...a: unknown[]) => aiCreate(...a) } } },
  PREMIUM_AI_MODEL: "test-model",
}));

const {
  buildQuizPrompt,
  cleanText,
  fetchFromOTDB,
  generateQuestions,
  generateWithAi,
  getCategory,
  normalizeDifficulty,
  parseAiQuestion,
} = await import("../lib/quiz-generation");

function aiPayload(questions: unknown[]) {
  return { choices: [{ message: { content: JSON.stringify({ questions }) } }] };
}

const VALID_Q = {
  question: "What is the derivative of x squared?",
  options: ["2x", "x", "x cubed over 3", "2"],
  correctIndex: 0,
  explanation: "Differentiating x^2 with the power rule gives 2x. 'x' would be the derivative of x^2/2.",
};

beforeEach(() => {
  aiCreate.mockReset();
});

describe("cleanText", () => {
  it("decodes HTML entities that would otherwise be shown literally", () => {
    expect(cleanText("Rise &amp; shine &mdash; 5 &lt; 10")).toBe("Rise & shine — 5 < 10");
    expect(cleanText("Caf&eacute; &#233;")).toBe("Café é");
  });

  it("strips stray HTML tags including <br>", () => {
    expect(cleanText("Line one<br>Line two")).toBe("Line one Line two");
    expect(cleanText("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  it("collapses whitespace and trims", () => {
    expect(cleanText("  too    many   spaces  ")).toBe("too many spaces");
  });

  it("leaves unknown entities intact rather than corrupting them", () => {
    expect(cleanText("a &notreal; b")).toBe("a &notreal; b");
  });
});

describe("normalizeDifficulty", () => {
  it("accepts the three valid levels", () => {
    expect(normalizeDifficulty("easy")).toBe("easy");
    expect(normalizeDifficulty("hard")).toBe("hard");
    expect(normalizeDifficulty("medium")).toBe("medium");
  });
  it("defaults anything else to medium", () => {
    expect(normalizeDifficulty(undefined)).toBe("medium");
    expect(normalizeDifficulty("impossible")).toBe("medium");
    expect(normalizeDifficulty(42)).toBe("medium");
  });
});

describe("buildQuizPrompt", () => {
  it("targets the student's topic and forbids trivia", () => {
    const { system, user } = buildQuizPrompt("photosynthesis", 5, "medium");
    expect(user).toContain("photosynthesis");
    expect(user).toContain("Number of questions: 5");
    expect(system).toMatch(/never general trivia/i);
  });

  it("demands a teaching explanation and plain text", () => {
    const { system } = buildQuizPrompt("algebra", 3, "easy");
    expect(system).toMatch(/explanation must teach/i);
    expect(system).toMatch(/no html/i);
  });

  it("passes exam context through when given", () => {
    const { user } = buildQuizPrompt("algebra", 3, "hard", "SAT");
    expect(user).toContain("SAT");
  });

  it("varies the brief by difficulty", () => {
    expect(buildQuizPrompt("x", 1, "easy").user).toMatch(/recall/i);
    expect(buildQuizPrompt("x", 1, "hard").user).toMatch(/multi-step|analysis/i);
  });
});

describe("parseAiQuestion", () => {
  it("labels options A-D and points correctAnswer at the right one", () => {
    const q = parseAiQuestion(VALID_Q)!;
    expect(q.options).toEqual(["A. 2x", "B. x", "C. x cubed over 3", "D. 2"]);
    expect(q.correctAnswer).toBe("A. 2x");
    expect(q.type).toBe("multiple_choice");
  });

  it("honours a non-zero correctIndex", () => {
    const q = parseAiQuestion({ ...VALID_Q, correctIndex: 2 })!;
    expect(q.correctAnswer).toBe("C. x cubed over 3");
  });

  it("rejects questions that do not have exactly four options", () => {
    expect(parseAiQuestion({ ...VALID_Q, options: ["a", "b", "c"] })).toBeNull();
    expect(parseAiQuestion({ ...VALID_Q, options: ["a", "b", "c", "d", "e"] })).toBeNull();
  });

  it("rejects duplicate options, which make a question unanswerable", () => {
    expect(parseAiQuestion({ ...VALID_Q, options: ["2x", "2x", "b", "c"] })).toBeNull();
  });

  it("rejects an out-of-range or missing correctIndex", () => {
    expect(parseAiQuestion({ ...VALID_Q, correctIndex: 9 })).toBeNull();
    expect(parseAiQuestion({ ...VALID_Q, correctIndex: -1 })).toBeNull();
    expect(parseAiQuestion({ ...VALID_Q, correctIndex: undefined })).toBeNull();
  });

  it("rejects a question with no explanation (the teaching moment)", () => {
    expect(parseAiQuestion({ ...VALID_Q, explanation: "" })).toBeNull();
    expect(parseAiQuestion({ ...VALID_Q, explanation: undefined })).toBeNull();
  });

  it("sanitises HTML that the model leaked into the text", () => {
    const q = parseAiQuestion({
      ...VALID_Q,
      question: "What is 5 &lt; 10?<br>Choose one",
      explanation: "Because <b>5</b> is smaller &amp; that is it.",
    })!;
    expect(q.question).toBe("What is 5 < 10? Choose one");
    expect(q.explanation).toBe("Because 5 is smaller & that is it.");
  });

  it("rejects junk input", () => {
    expect(parseAiQuestion(null)).toBeNull();
    expect(parseAiQuestion("nope")).toBeNull();
    expect(parseAiQuestion({})).toBeNull();
  });
});

describe("generateWithAi", () => {
  it("returns parsed questions", async () => {
    aiCreate.mockResolvedValue(aiPayload([VALID_Q]));
    const out = await generateWithAi("calculus", 1, "medium");
    expect(out).toHaveLength(1);
    expect(out[0].correctAnswer).toBe("A. 2x");
  });

  it("drops unusable questions but keeps the good ones", async () => {
    aiCreate.mockResolvedValue(aiPayload([VALID_Q, { question: "broken" }]));
    const out = await generateWithAi("calculus", 5, "medium");
    expect(out).toHaveLength(1);
  });

  it("de-duplicates repeated questions", async () => {
    aiCreate.mockResolvedValue(aiPayload([VALID_Q, { ...VALID_Q }]));
    const out = await generateWithAi("calculus", 5, "medium");
    expect(out).toHaveLength(1);
  });

  it("never returns more than the requested count", async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      ...VALID_Q,
      question: `Question number ${i}?`,
    }));
    aiCreate.mockResolvedValue(aiPayload(many));
    const out = await generateWithAi("calculus", 3, "medium");
    expect(out).toHaveLength(3);
  });

  it("throws on malformed JSON, an empty reply, or all-unusable questions", async () => {
    aiCreate.mockResolvedValue({ choices: [{ message: { content: "not json" } }] });
    await expect(generateWithAi("x", 1, "medium")).rejects.toThrow();

    aiCreate.mockResolvedValue({ choices: [{ message: { content: "" } }] });
    await expect(generateWithAi("x", 1, "medium")).rejects.toThrow();

    aiCreate.mockResolvedValue(aiPayload([{ question: "bad" }]));
    await expect(generateWithAi("x", 1, "medium")).rejects.toThrow();
  });
});

describe("getCategory (OTDB fallback mapping)", () => {
  it("maps subject keywords to trivia categories", () => {
    expect(getCategory("Algebra revision")).toBe(19);
    expect(getCategory("Biology")).toBe(17);
    expect(getCategory("World History")).toBe(23);
  });
  it("defaults to general knowledge", () => {
    expect(getCategory("Existentialist poetry")).toBe(9);
  });
});

describe("fetchFromOTDB", () => {
  const otdbResult = {
    response_code: 0,
    results: [
      {
        question: "Which planet is known as the Red Planet?",
        correct_answer: "Mars",
        incorrect_answers: ["Venus", "Jupiter", "Mercury"],
        category: "Science &amp; Nature",
        difficulty: "easy",
      },
    ],
  };

  it("labels options and states the answer in the explanation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(otdbResult) }),
    );
    const out = await fetchFromOTDB(1, 17, "easy");
    expect(out).toHaveLength(1);
    expect(out[0].options.every((o, i) => o.startsWith(`${"ABCD"[i]}. `))).toBe(true);
    expect(out[0].correctAnswer).toContain("Mars");
    // Regression: the explanation used to be "Category: X · Difficulty: y".
    expect(out[0].explanation).toContain("The correct answer is Mars");
    expect(out[0].explanation).toContain("Science & Nature");
    vi.unstubAllGlobals();
  });

  it("throws when OTDB has no results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ response_code: 2 }) }),
    );
    await expect(fetchFromOTDB(1, 17, "easy")).rejects.toThrow();
    vi.unstubAllGlobals();
  });
});

describe("generateQuestions — AI first, OTDB fallback", () => {
  it("uses the AI when it works and never calls OTDB", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    aiCreate.mockResolvedValue(aiPayload([VALID_Q]));

    const { questions, source } = await generateQuestions("calculus", 1, "medium");
    expect(source).toBe("ai");
    expect(questions).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("falls back to OTDB when the AI fails, instead of failing the request", async () => {
    aiCreate.mockRejectedValue(new Error("provider down"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            response_code: 0,
            results: [
              {
                question: "Capital of France?",
                correct_answer: "Paris",
                incorrect_answers: ["Rome", "Madrid", "Berlin"],
                category: "Geography",
                difficulty: "easy",
              },
            ],
          }),
      }),
    );
    const warn = vi.fn();
    const { questions, source } = await generateQuestions(
      "geography",
      1,
      "easy",
      null,
      { warn },
    );
    expect(source).toBe("otdb");
    expect(questions).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("propagates the error when both sources fail", async () => {
    aiCreate.mockRejectedValue(new Error("provider down"));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    await expect(generateQuestions("geography", 1, "easy")).rejects.toThrow();
    vi.unstubAllGlobals();
  });
});
