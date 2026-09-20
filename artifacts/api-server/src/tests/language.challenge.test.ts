import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("../lib/openai", () => ({
  openai: { chat: { completions: { create: vi.fn() } } },
  PREMIUM_AI_MODEL: "test-model",
}));

vi.mock("@workspace/db", () => {
  const table = (name: string) =>
    new Proxy({ _: { name } }, { get: (t, k) => (k in t ? (t as never)[k] : `${name}.${String(k)}`) });
  return {
    db: {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    languageUsageTable: table("language_usage"),
    languageProgressTable: table("language_progress"),
    languageWordsTable: table("language_words"),
    languageAnswersTable: table("language_answers"),
    languageDailyChallengeTable: table("language_daily_challenge"),
  };
});

vi.mock("../middlewares/auth", () => ({
  requireAuth: (req: { userId?: string }, _res: unknown, next: () => void) => {
    req.userId = "user_1";
    next();
  },
}));

vi.mock("../lib/language", () => ({
  dailyCapSeconds: vi.fn(async () => 600),
  dhakaDay: () => "2026-09-20",
  dhakaYesterday: () => "2026-09-19",
  nextResetISO: () => "2026-09-21T00:00:00.000Z",
  PREMIUM_DAILY_SECONDS: 3600,
}));

const { describeChallenge, levelFields } = await import("../routes/language");

// ─── Challenge descriptions ──────────────────────────────────────────────────

describe("describeChallenge", () => {
  it("describes an exercise-count goal", () => {
    expect(describeChallenge("exercises", 10)).toBe("Complete 10 exercises");
  });

  it("describes a correct-answer goal", () => {
    expect(describeChallenge("correct", 8)).toBe("Answer 8 exercises correctly");
  });

  it("describes a new-words goal", () => {
    expect(describeChallenge("words", 3)).toBe("Learn 3 new words");
  });

  it("falls back to the exercise wording for an unknown kind", () => {
    expect(describeChallenge("something-else", 5)).toBe("Complete 5 exercises");
  });
});

// ─── XP levels ───────────────────────────────────────────────────────────────

describe("levelFields", () => {
  it("starts every student at level 1 with an empty bar", () => {
    expect(levelFields(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNextLevel: 100 });
  });

  it("keeps a student below the threshold at level 1", () => {
    expect(levelFields(99)).toEqual({ level: 1, xpIntoLevel: 99, xpForNextLevel: 100 });
  });

  it("promotes to level 2 at exactly 100 XP", () => {
    expect(levelFields(100)).toEqual({ level: 2, xpIntoLevel: 0, xpForNextLevel: 200 });
  });

  it("requires progressively more XP per level", () => {
    // L2 needs 200 on top of the first 100.
    expect(levelFields(299)).toMatchObject({ level: 2, xpIntoLevel: 199 });
    expect(levelFields(300)).toMatchObject({ level: 3, xpIntoLevel: 0, xpForNextLevel: 300 });
  });

  it("never returns a negative or fractional level for junk input", () => {
    expect(levelFields(-50)).toEqual({ level: 1, xpIntoLevel: 0, xpForNextLevel: 100 });
    expect(levelFields(150.7)).toMatchObject({ level: 2 });
  });

  it("stays monotonic: more XP never lowers the level", () => {
    let last = 0;
    for (let xp = 0; xp <= 5000; xp += 37) {
      const { level } = levelFields(xp);
      expect(level).toBeGreaterThanOrEqual(last);
      last = level;
    }
  });

  it("keeps the in-level progress below the requirement", () => {
    for (let xp = 0; xp <= 3000; xp += 13) {
      const { xpIntoLevel, xpForNextLevel } = levelFields(xp);
      expect(xpIntoLevel).toBeGreaterThanOrEqual(0);
      expect(xpIntoLevel).toBeLessThan(xpForNextLevel);
    }
  });
});

// ─── Exercise modes ──────────────────────────────────────────────────────────

describe("language exercise modes", () => {
  let source: string;

  beforeEach(async () => {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const path = fileURLToPath(new URL("../routes/language.ts", import.meta.url));
    source = await readFile(path, "utf8");
  });

  it("offers the two Duolingo-style drills alongside the originals", () => {
    const modes = source.match(/const MODES = \[(.*?)\] as const;/s)?.[1] ?? "";
    for (const mode of ["vocab", "grammar", "sentence", "translate", "listen", "match"]) {
      expect(modes).toContain(`"${mode}"`);
    }
  });

  it("asks for a spoken-friendly sentence in the listening prompt", () => {
    const prompt = source.slice(source.indexOf('mode === "listen"'));
    expect(prompt).toMatch(/read aloud/i);
    // Numerals are ambiguous when spoken ("1990" vs "nineteen ninety").
    expect(prompt).toMatch(/do not use numerals/i);
  });

  it("requires unambiguous pairs in the matching prompt", () => {
    const prompt = source.slice(source.indexOf('mode === "match"'));
    expect(prompt).toMatch(/no two English meanings are synonyms/i);
    expect(prompt).toMatch(/exactly one correct match/i);
  });

  it("rejects a match exercise with too few pairs to be playable", () => {
    // cleanExercise requires at least 3 pairs before it will emit the exercise.
    expect(source).toMatch(/pairs\.length < 3\) return null/);
  });

  it("caps a match board at six pairs so it fits on a phone", () => {
    expect(source).toMatch(/pairs: pairs\.slice\(0, 6\)/);
  });
});

// ─── Challenge integrity ─────────────────────────────────────────────────────

describe("daily challenge integrity", () => {
  let source: string;

  beforeEach(async () => {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const path = fileURLToPath(new URL("../routes/language.ts", import.meta.url));
    source = await readFile(path, "utf8");
  });

  it("pays the completion bonus at most once", () => {
    // The UPDATE only matches rows whose completedAt is still NULL, so two
    // concurrent answers cannot both stamp it (and therefore both pay out).
    expect(source).toMatch(/completedAt\} IS NULL/);
  });

  it("clamps challenge progress to the target", () => {
    expect(source).toMatch(/LEAST\(\$\{languageDailyChallengeTable\.progress\} \+ \$\{delta\}/);
  });

  it("advances counters SQL-side, never read-then-write", () => {
    expect(source).toMatch(/xp: sql`\$\{languageProgressTable\.xp\} \+ \$\{xpAwarded\}`/);
  });

  it("creates at most one challenge row per user per day", () => {
    expect(source).toMatch(/onConflictDoNothing\(\)/);
  });
});
