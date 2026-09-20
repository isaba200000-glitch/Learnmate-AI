/**
 * Quiz tiering: which students get AI-written questions.
 *
 * The product rule is "best features are Premium, average features are free".
 * Quizzes themselves stay free (they are listed as a free-tier feature), but
 * the AI-written version — questions on the student's exact topic, each with a
 * teaching explanation — is the Premium upgrade. Free students continue to get
 * the Open Trivia DB question bank.
 *
 * These tests exist because an earlier revision handed AI generation to every
 * user, which both inverted the tier model and put per-quiz AI cost on free
 * accounts.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import express from "express";
import request from "supertest";

// ── Mocks ────────────────────────────────────────────────────────────────────

let userRow: { userId: string; premiumExpiresAt: Date | null } | undefined = {
  userId: "test-user-id",
  premiumExpiresAt: null,
};
const insertedQuestions: any[] = [];

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(userRow ? [userRow] : []),
          orderBy: () => Promise.resolve([]),
          then: (resolve: (v: unknown) => unknown) => resolve([{ used: 0 }]),
        }),
      }),
    })),
    insert: vi.fn().mockImplementation(() => ({
      values: (vals: any) => {
        if (Array.isArray(vals)) insertedQuestions.push(...vals);
        return {
          returning: () =>
            Promise.resolve(
              Array.isArray(vals)
                ? vals.map((v, i) => ({ id: i + 1, ...v }))
                : [
                    {
                      id: 1,
                      status: "pending",
                      createdAt: new Date(),
                      completedAt: null,
                      imageUrl: null,
                      ...vals,
                    },
                  ],
            ),
        };
      },
    })),
    delete: vi.fn(),
    update: vi.fn(),
  },
  quizSessionsTable: {},
  quizQuestionsTable: {},
  usersTable: { userId: "userId", premiumExpiresAt: "premiumExpiresAt" },
}));

vi.mock("../middlewares/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = "test-user-id";
    next();
  },
}));

let ownerFlag = false;
vi.mock("../lib/owner", () => ({
  isOwnerRequest: () => Promise.resolve(ownerFlag),
}));

vi.mock("../lib/premium", () => ({
  isPremiumActive: (expiresAt: Date | null) => !!expiresAt && expiresAt > new Date(),
}));

const aiCreate = vi.fn();
vi.mock("../lib/openai", () => ({
  openai: { chat: { completions: { create: (...a: unknown[]) => aiCreate(...a) } } },
  PREMIUM_AI_MODEL: "test-model",
}));

const OTDB_RESPONSE = {
  response_code: 0,
  results: [
    {
      question: "Which planet is the Red Planet?",
      correct_answer: "Mars",
      incorrect_answers: ["Venus", "Jupiter", "Mercury"],
      category: "Science &amp; Nature",
      difficulty: "medium",
    },
  ],
};

const AI_RESPONSE = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          questions: [
            {
              question: "In photosynthesis, which molecule is oxidised?",
              options: ["Water", "Carbon dioxide", "Glucose", "Oxygen"],
              correctIndex: 0,
              explanation:
                "Water is split at photosystem II, releasing electrons and oxygen. Carbon dioxide is reduced, not oxidised.",
            },
          ],
        }),
      },
    },
  ],
};

let app: express.Express;
let fetchMock: ReturnType<typeof vi.fn>;

beforeAll(async () => {
  const { default: quizzesRouter } = await import("../routes/quizzes");
  app = express();
  app.use(express.json());
  app.use("/api", quizzesRouter);
});

beforeEach(() => {
  aiCreate.mockReset().mockResolvedValue(AI_RESPONSE);
  insertedQuestions.length = 0;
  ownerFlag = false;
  userRow = { userId: "test-user-id", premiumExpiresAt: null };
  fetchMock = vi
    .fn()
    .mockResolvedValue({ ok: true, json: () => Promise.resolve(OTDB_RESPONSE) });
  vi.stubGlobal("fetch", fetchMock);
});

function createQuiz(body: Record<string, unknown> = {}) {
  return request(app)
    .post("/api/quiz-sessions")
    .send({ subject: "Photosynthesis", totalQuestions: 1, ...body });
}

describe("free students", () => {
  it("do NOT trigger an AI call (cost stays on paying accounts)", async () => {
    const res = await createQuiz();
    expect(res.status).toBe(201);
    expect(aiCreate).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalled();
  });

  it("still get a working quiz from the question bank", async () => {
    const res = await createQuiz();
    expect(res.status).toBe(201);
    expect(insertedQuestions.length).toBeGreaterThan(0);
    expect(insertedQuestions[0].question).toContain("Red Planet");
  });

  it("are treated as free once their premium has expired", async () => {
    userRow = { userId: "test-user-id", premiumExpiresAt: new Date(Date.now() - 1000) };
    await createQuiz();
    expect(aiCreate).not.toHaveBeenCalled();
  });
});

describe("premium students", () => {
  beforeEach(() => {
    userRow = {
      userId: "test-user-id",
      premiumExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
  });

  it("get AI-written questions on their actual topic", async () => {
    const res = await createQuiz();
    expect(res.status).toBe(201);
    expect(aiCreate).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(aiCreate.mock.calls[0][0])).toContain("Photosynthesis");
    expect(insertedQuestions[0].question).toContain("photosynthesis");
  });

  it("get an explanation that teaches, not a category label", async () => {
    await createQuiz();
    const explanation: string = insertedQuestions[0].explanation;
    expect(explanation).toContain("photosystem II");
    expect(explanation).not.toMatch(/^Category:/);
  });

  it("fall back to the question bank if the AI provider fails", async () => {
    aiCreate.mockRejectedValue(new Error("provider down"));
    const res = await createQuiz();
    expect(res.status).toBe(201);
    expect(fetchMock).toHaveBeenCalled();
    expect(insertedQuestions[0].question).toContain("Red Planet");
  });
});

describe("owner account", () => {
  it("gets AI questions without an active subscription", async () => {
    ownerFlag = true;
    userRow = { userId: "test-user-id", premiumExpiresAt: null };
    const res = await createQuiz();
    expect(res.status).toBe(201);
    expect(aiCreate).toHaveBeenCalledTimes(1);
  });
});
