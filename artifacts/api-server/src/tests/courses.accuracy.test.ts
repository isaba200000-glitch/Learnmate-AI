/**
 * Course content accuracy.
 *
 * Students learn from this text, so a confident wrong statement is the worst
 * possible failure. Lesson content is also cached GLOBALLY and forever, which
 * means any defect is served to every student indefinitely.
 *
 * These tests cover the two ways that went wrong:
 *   1. The generation prompt had no accuracy guardrails at all.
 *   2. max_tokens was 1200 for an 8-section lesson with worked examples, code
 *      blocks and three model answers — so lessons were truncated mid-sentence
 *      and then cached in that state permanently.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const aiCreate = vi.fn();
vi.mock("../lib/openai", () => ({
  openai: { chat: { completions: { create: (...a: unknown[]) => aiCreate(...a) } } },
  PREMIUM_AI_MODEL: "test-model",
}));

// The route module pulls in the DB and photo helpers at import time.
vi.mock("@workspace/db", () => ({
  db: {},
  usersTable: {},
  courseLessonCacheTable: {},
  courseTopicImagesTable: {},
  courseLessonImagesTable: {},
  courseLessonStepImagesTable: {},
  courseProgressTable: {},
  courseUsageTable: {},
}));
vi.mock("../middlewares/auth", () => ({ requireAuth: (_q: any, _s: any, n: any) => n() }));
vi.mock("../lib/premium", () => ({ isPremiumActive: () => false }));
vi.mock("../lib/owner", () => ({ isOwnerRequest: () => Promise.resolve(false) }));
vi.mock("../lib/language", () => ({ dhakaDay: () => "2026-09-20" }));
vi.mock("../lib/realPhotos", () => ({
  getRealTopicImage: vi.fn(),
  getRealLessonImage: vi.fn(),
  getRealStepImage: vi.fn(),
}));

const { COURSE_TOPICS, __test } = (await import("../routes/courses")) as any;

beforeEach(() => {
  aiCreate.mockReset();
});

function lessonCall() {
  return aiCreate.mock.calls[0][0];
}

describe("lesson generation — accuracy guardrails", () => {
  beforeEach(() => {
    aiCreate.mockResolvedValue({
      choices: [{ finish_reason: "stop", message: { content: "## 🎯 What You'll Learn\nStuff." } }],
    });
  });

  it("instructs the model to prioritise correctness over confidence", async () => {
    await __test.generateLessonContent(COURSE_TOPICS[0], COURSE_TOPICS[0].lessons[0]);
    const system: string = lessonCall().messages[0].content;
    expect(system).toMatch(/ACCURACY COMES FIRST/i);
    expect(system).toMatch(/if you are not certain.*leave it out/i);
  });

  it("forbids inventing components, APIs and specifications", async () => {
    await __test.generateLessonContent(COURSE_TOPICS[0], COURSE_TOPICS[0].lessons[0]);
    const system: string = lessonCall().messages[0].content;
    expect(system).toMatch(/never invent/i);
    expect(system).toMatch(/pin numbers|specifications/i);
  });

  it("requires code to be valid and runnable", async () => {
    await __test.generateLessonContent(COURSE_TOPICS[0], COURSE_TOPICS[0].lessons[0]);
    const system: string = lessonCall().messages[0].content;
    expect(system).toMatch(/syntactically valid/i);
    expect(system).toMatch(/actually run/i);
  });

  it("requires arithmetic in worked examples to be checked", async () => {
    await __test.generateLessonContent(COURSE_TOPICS[0], COURSE_TOPICS[0].lessons[0]);
    const system: string = lessonCall().messages[0].content;
    expect(system).toMatch(/check the arithmetic/i);
  });

  it("requires realistic units and values", async () => {
    await __test.generateLessonContent(COURSE_TOPICS[0], COURSE_TOPICS[0].lessons[0]);
    const system: string = lessonCall().messages[0].content;
    expect(system).toMatch(/SI units/i);
  });

  it("bans raw HTML so nothing leaks into the renderer", async () => {
    await __test.generateLessonContent(COURSE_TOPICS[0], COURSE_TOPICS[0].lessons[0]);
    const system: string = lessonCall().messages[0].content;
    expect(system).toMatch(/never output raw HTML/i);
  });
});

describe("lesson generation — truncation", () => {
  it("allocates enough tokens for the full 8-section lesson", async () => {
    aiCreate.mockResolvedValue({
      choices: [{ finish_reason: "stop", message: { content: "ok" } }],
    });
    await __test.generateLessonContent(COURSE_TOPICS[0], COURSE_TOPICS[0].lessons[0]);
    // 1200 was the old value and truncated lessons mid-sentence.
    expect(lessonCall().max_tokens).toBeGreaterThanOrEqual(4000);
  });

  it("refuses to return a lesson that hit the token ceiling", async () => {
    aiCreate.mockResolvedValue({
      choices: [
        { finish_reason: "length", message: { content: "## Big Idea\nA sentence that stops mid-wo" } },
      ],
    });
    // Throwing means the caller 502s and nothing is written to the global
    // cache — better than serving a half-lesson to every student forever.
    await expect(
      __test.generateLessonContent(COURSE_TOPICS[0], COURSE_TOPICS[0].lessons[0]),
    ).rejects.toThrow(/truncat/i);
  });

  it("returns content normally when generation completes", async () => {
    aiCreate.mockResolvedValue({
      choices: [{ finish_reason: "stop", message: { content: "  ## Done\nFull lesson.  " } }],
    });
    const out = await __test.generateLessonContent(COURSE_TOPICS[0], COURSE_TOPICS[0].lessons[0]);
    expect(out).toBe("## Done\nFull lesson.");
  });
});

describe("course catalogue integrity", () => {
  it("has unique topic slugs", () => {
    const slugs = COURSE_TOPICS.map((t: any) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("gives every lesson a title and summary", () => {
    for (const topic of COURSE_TOPICS) {
      for (const [i, lesson] of topic.lessons.entries()) {
        expect(lesson.title?.trim(), `${topic.slug}[${i}] title`).toBeTruthy();
        expect(lesson.summary?.trim(), `${topic.slug}[${i}] summary`).toBeTruthy();
      }
    }
  });

  it("keeps free lessons available in every topic (free tier stays usable)", () => {
    for (const topic of COURSE_TOPICS) {
      const free = topic.lessons.filter((l: any) => !l.isPremium);
      expect(free.length, `${topic.slug} has no free lessons`).toBeGreaterThan(0);
    }
  });

  it("orders lessons free-first so the tier boundary is predictable", () => {
    for (const topic of COURSE_TOPICS) {
      const firstPremium = topic.lessons.findIndex((l: any) => l.isPremium);
      if (firstPremium === -1) continue;
      const afterBoundary = topic.lessons.slice(firstPremium);
      expect(
        afterBoundary.every((l: any) => l.isPremium),
        `${topic.slug} mixes a free lesson in after the premium boundary`,
      ).toBe(true);
    }
  });
});
