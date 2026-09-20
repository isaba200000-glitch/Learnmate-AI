/**
 * Tests for the exam-types routes.
 *
 * Covers the public list/detail endpoints, the premium gate on the AI deep
 * dive, and the guards around the AI response. The AI call itself is mocked.
 *
 * Also asserts the integrity of the seeded exam reference data, since the
 * whole point of that table is that a student can trust the numbers. Several
 * assertions deliberately pin facts that changed recently (digital SAT, the
 * GMAT 205-805 scale, the January 2026 TOEFL overhaul) so that a well-meaning
 * edit based on out-of-date knowledge fails loudly.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import express from "express";
import request from "supertest";

// ── Mocks (declared before the module under test is imported) ────────────────

let isPremium = false;

vi.mock("../middlewares/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = "test-user-id";
    next();
  },
}));

vi.mock("../middlewares/requirePremium", () => ({
  requirePremium: (_req: any, res: any, next: any) => {
    if (!isPremium) {
      res.status(403).json({ error: "Premium subscription required" });
      return;
    }
    next();
  },
}));

const aiCreate = vi.fn();
vi.mock("../lib/openai", () => ({
  openai: { chat: { completions: { create: (...a: unknown[]) => aiCreate(...a) } } },
  PREMIUM_AI_MODEL: "test-model",
}));

let app: express.Express;

beforeAll(async () => {
  const { default: examTypesRouter } = await import("../routes/exam-types");
  app = express();
  app.use(express.json());
  app.use("/api", examTypesRouter);
});

function goodAiResponse() {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({
            summary: "A summary of the exam.",
            sections: [
              { heading: "How to prepare", body: "Do the thing." },
              { heading: "Timeline", body: "Start early." },
            ],
            highYieldTopics: ["Algebra", "Transitions"],
            commonMistakes: ["Leaving answers blank"],
          }),
        },
      },
    ],
  };
}

describe("GET /api/exam-types", () => {
  it("lists every exam with summary fields", async () => {
    const res = await request(app).get("/api/exam-types");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(14);
    for (const exam of res.body) {
      expect(exam.id).toBeTruthy();
      expect(exam.name).toBeTruthy();
      expect(exam.category).toBeTruthy();
      expect(exam.description).toBeTruthy();
    }
  });

  it("keeps the list payload light (no full syllabus)", async () => {
    const res = await request(app).get("/api/exam-types");
    expect(res.body[0].topics).toBeUndefined();
    expect(res.body[0].sections).toBeUndefined();
  });
});

describe("GET /api/exam-types/:examId", () => {
  it("returns full detail for a known exam", async () => {
    const res = await request(app).get("/api/exam-types/sat");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("sat");
    expect(res.body.sections.length).toBeGreaterThan(0);
    expect(res.body.topics.length).toBeGreaterThan(0);
    expect(res.body.keyFacts.length).toBeGreaterThan(0);
    expect(res.body.officialSite).toContain("collegeboard.org");
  });

  it("is case-insensitive", async () => {
    const res = await request(app).get("/api/exam-types/IELTS");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("ielts");
  });

  it("404s on an unknown exam", async () => {
    const res = await request(app).get("/api/exam-types/not-a-real-exam");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  it("does not shadow the deep-dive route with the :examId param", async () => {
    // "deep-dive" must not be treated as an exam id.
    const res = await request(app).get("/api/exam-types/deep-dive");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/exam-types/deep-dive — premium gate", () => {
  it("rejects a free user with 403", async () => {
    isPremium = false;
    const res = await request(app).post("/api/exam-types/deep-dive").send({ examId: "sat" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/premium/i);
    expect(aiCreate).not.toHaveBeenCalled();
  });
});

describe("POST /api/exam-types/deep-dive — premium user", () => {
  beforeAll(() => {
    isPremium = true;
  });

  it("validates examId", async () => {
    aiCreate.mockReset();
    const res = await request(app).post("/api/exam-types/deep-dive").send({});
    expect(res.status).toBe(400);
    expect(aiCreate).not.toHaveBeenCalled();
  });

  it("404s on an unknown exam before calling the AI", async () => {
    aiCreate.mockReset();
    const res = await request(app)
      .post("/api/exam-types/deep-dive")
      .send({ examId: "nope" });
    expect(res.status).toBe(404);
    expect(aiCreate).not.toHaveBeenCalled();
  });

  it("returns a briefing and grounds the prompt in verified facts", async () => {
    aiCreate.mockReset().mockResolvedValue(goodAiResponse());
    const res = await request(app)
      .post("/api/exam-types/deep-dive")
      .send({ examId: "sat" });

    expect(res.status).toBe(200);
    expect(res.body.examId).toBe("sat");
    expect(res.body.examName).toBe("SAT");
    expect(res.body.summary).toBeTruthy();
    expect(res.body.sections.length).toBe(2);
    expect(res.body.highYieldTopics).toContain("Algebra");
    expect(res.body.sources[0]).toContain("collegeboard.org");

    // The fact sheet must actually reach the model, otherwise it will happily
    // describe the old paper SAT.
    const prompt = JSON.stringify(aiCreate.mock.calls[0][0]);
    expect(prompt).toContain("400-1600");
    expect(prompt).toContain("Desmos");
    expect(prompt).toMatch(/never contradict/i);
  });

  it("passes an optional focus through to the prompt", async () => {
    aiCreate.mockReset().mockResolvedValue(goodAiResponse());
    await request(app)
      .post("/api/exam-types/deep-dive")
      .send({ examId: "gre", focus: "quantitative comparison" });
    expect(JSON.stringify(aiCreate.mock.calls[0][0])).toContain("quantitative comparison");
  });

  it("502s when the AI returns malformed JSON", async () => {
    aiCreate.mockReset().mockResolvedValue({ choices: [{ message: { content: "not json" } }] });
    const res = await request(app).post("/api/exam-types/deep-dive").send({ examId: "sat" });
    expect(res.status).toBe(502);
  });

  it("502s when the AI returns JSON without usable sections", async () => {
    aiCreate
      .mockReset()
      .mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ summary: "hi" }) } }] });
    const res = await request(app).post("/api/exam-types/deep-dive").send({ examId: "sat" });
    expect(res.status).toBe(502);
  });

  it("502s when the AI call throws", async () => {
    aiCreate.mockReset().mockRejectedValue(new Error("provider down"));
    const res = await request(app).post("/api/exam-types/deep-dive").send({ examId: "sat" });
    expect(res.status).toBe(502);
    expect(res.body.error).toBeTruthy();
  });
});

describe("seeded exam data accuracy", () => {
  it("has no duplicate ids", async () => {
    const { EXAM_TYPES } = await import("../lib/exam-data");
    const ids = EXAM_TYPES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("describes the CURRENT digital SAT, not the retired paper test", async () => {
    const { findExam } = await import("../lib/exam-data");
    const sat = findExam("sat")!;
    expect(sat.scoring).toContain("1600");
    expect(sat.format?.toLowerCase()).toContain("adaptive");
    // The essay was discontinued — make sure nobody re-adds it.
    expect(JSON.stringify(sat.sections)).not.toMatch(/essay/i);
    expect(sat.keyFacts?.join(" ")).toMatch(/no essay/i);
  });

  it("describes the enhanced ACT with optional Science", async () => {
    const { findExam } = await import("../lib/exam-data");
    const act = findExam("act")!;
    expect(act.scoring).toMatch(/English, Math and Reading only/i);
    expect(act.sections?.some((s) => /science \(optional\)/i.test(s.name))).toBe(true);
  });

  it("uses the GMAT 205-805 scale and omits removed question types", async () => {
    const { findExam } = await import("../lib/exam-data");
    const gmat = findExam("gmat")!;
    expect(gmat.scoring).toContain("205-805");
    expect(gmat.sections?.some((s) => s.name === "Data Insights")).toBe(true);
    expect(gmat.keyFacts?.join(" ")).toMatch(/no essay/i);
  });

  it("describes the shorter single-essay GRE", async () => {
    const { findExam } = await import("../lib/exam-data");
    const gre = findExam("gre")!;
    expect(gre.totalTime).toMatch(/1 hour 58/);
    const writing = gre.sections?.find((s) => /Analytical Writing/i.test(s.name));
    expect(writing?.detail).toMatch(/Argument essay was removed/i);
  });

  it("describes the post-January-2026 TOEFL with CEFR bands", async () => {
    const { findExam } = await import("../lib/exam-data");
    const toefl = findExam("toefl")!;
    expect(toefl.scoring).toMatch(/1\.0-6\.0/);
    expect(toefl.scoring?.toLowerCase()).toContain("cefr");
    expect(toefl.format).toMatch(/adaptive/i);
    expect(toefl.sections?.find((s) => s.name === "Speaking")?.minutes).toMatch(/8/);
  });

  it("gives IELTS the correct band scale and no pass/fail", async () => {
    const { findExam } = await import("../lib/exam-data");
    const ielts = findExam("ielts")!;
    expect(ielts.scoring).toMatch(/0-9/);
    expect(ielts.scoring).toMatch(/no pass or fail/i);
    expect(ielts.sections?.length).toBe(4);
  });

  it("marks NEET's negative marking, which changes exam strategy", async () => {
    const { findExam } = await import("../lib/exam-data");
    const neet = findExam("neet")!;
    expect(neet.scoring).toMatch(/minus one|negative/i);
    expect(neet.totalQuestions).toContain("180");
  });

  it("gives every exam a verification date and real study guidance", async () => {
    const { EXAM_TYPES } = await import("../lib/exam-data");
    for (const exam of EXAM_TYPES) {
      expect(exam.lastVerified, `${exam.id} missing lastVerified`).toBeTruthy();
      expect(exam.topics?.length, `${exam.id} has no topics`).toBeGreaterThan(0);
      expect(exam.studyTips?.length, `${exam.id} has no study tips`).toBeGreaterThan(0);
    }
  });

  it("produces a fact sheet containing the numbers a student needs", async () => {
    const { buildExamFactSheet, findExam } = await import("../lib/exam-data");
    const sheet = buildExamFactSheet(findExam("ielts")!);
    expect(sheet).toContain("IELTS");
    expect(sheet).toContain("Listening");
    expect(sheet).toContain("Scoring:");
    expect(sheet).toContain("Facts verified on:");
  });
});
