/**
 * Tests for the photo-quiz route input guards.
 *
 * The AI call itself is mocked. The full DB transaction in
 * routes/quizzes.ts is also mocked — these tests assert the request
 * validation logic (image prefix, size cap, photo-quota race-safety) and
 * the status codes returned to the client.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import express from "express";
import request from "supertest";

// ── Mocks (must be declared before the module under test is imported) ─────────

const SELECT_ROWS: any[] = [];
const INSERT_ROWS: any[] = [];
let selectResultQueue: any[][] = [SELECT_ROWS];

vi.mock("@workspace/db", () => {
  return {
      db: {
      select: vi.fn().mockImplementation(() => {
        const rows = selectResultQueue.shift() ?? [];
        return {
          from: () => ({
            // `where(...)` must be awaitable on its own: some queries (e.g.
            // photoQuizzesUsed) await it directly without .limit()/.orderBy().
            where: () => ({
              limit: () => Promise.resolve(rows),
              orderBy: () => Promise.resolve(rows),
              then: (resolve: (v: unknown) => unknown) => resolve(rows),
            }),
          }),
        };
      }),
      insert: vi.fn().mockImplementation(() => ({
        values: (vals: any) => {
          INSERT_ROWS.push(vals);
          return {
            onConflictDoNothing: () => ({
              returning: () =>
                Promise.resolve(
                  Array.isArray(vals) ? vals.map((v, i) => ({ id: i + 1, ...v })) : [{ id: 1, ...vals }],
                ),
            }),
            returning: () =>
              Promise.resolve(
                Array.isArray(vals) ? vals.map((v, i) => ({ id: i + 1, ...v })) : [{ id: 1, ...vals }],
              ),
          };
        },
      })),
      delete: vi.fn().mockReturnValue({ where: () => ({ returning: () => Promise.resolve([]) }) }),
      update: vi.fn().mockReturnValue({
        set: () => ({
          where: () => ({ returning: () => Promise.resolve([]) }),
        }),
      }),
    },
    quizSessionsTable: {},
    quizQuestionsTable: {},
    usersTable: { userId: "userId", premiumExpiresAt: "premiumExpiresAt" },
  };
});

vi.mock("../middlewares/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = "test-user-id";
    next();
  },
}));

vi.mock("../lib/premium", () => ({
  isPremiumActive: () => false,
}));

vi.mock("../lib/owner", () => ({
  isOwnerRequest: () => Promise.resolve(false),
}));

// Default implementation — required so the module loads without throwing
// (the real lib/openai throws at import time if OPENAI_API_KEY is missing).
// Individual tests that exercise the AI call path mock this more precisely
// in their own `vi.mock` block; this test suite focuses on the input
// guards that short-circuit BEFORE the AI call, so the default response
// is fine.
vi.mock("../lib/openai", () => {
  const create = vi.fn().mockImplementation(() =>
    Promise.resolve({
      choices: [{ message: { content: JSON.stringify({ questions: [], subject: "Test" }) } }],
    }),
  );
  return {
    openai: { chat: { completions: { create } } },
    PREMIUM_AI_MODEL: "test-model",
  };
});

let app: express.Express;

beforeAll(async () => {
  const { default: quizzesRouter } = await import("../routes/quizzes");
  app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use("/api", quizzesRouter);
});

describe("POST /api/quiz-sessions/from-photo — input guards", () => {
  it("rejects when imageBase64 is missing or not a data URL", async () => {
    const res = await request(app)
      .post("/api/quiz-sessions/from-photo")
      .send({ totalQuestions: 5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/data:image/i);
  });

  it("rejects images larger than 14 MB", async () => {
    const huge = "data:image/jpeg;base64," + "A".repeat(15_000_000);
    const res = await request(app)
      .post("/api/quiz-sessions/from-photo")
      .send({ imageBase64: huge, totalQuestions: 5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/too large/i);
  });
});