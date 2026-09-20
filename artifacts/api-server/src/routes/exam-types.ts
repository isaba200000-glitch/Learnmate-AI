import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import { requirePremium } from "../middlewares/requirePremium";
import { openai, PREMIUM_AI_MODEL } from "../lib/openai";
import { EXAM_TYPES, buildExamFactSheet, findExam } from "../lib/exam-data";

const router: IRouter = Router();

// The list endpoint stays lightweight — the cards on the index page only need
// the summary fields, and shipping every syllabus would bloat the payload.
const SUMMARY_FIELDS = EXAM_TYPES.map((e) => ({
  id: e.id,
  name: e.name,
  category: e.category,
  description: e.description,
  totalTime: e.totalTime,
  scoring: e.scoring,
  lastVerified: e.lastVerified,
}));

router.get("/exam-types", async (_req, res): Promise<void> => {
  res.json(SUMMARY_FIELDS);
});

// NOTE: this must be registered before "/exam-types/:examId", otherwise
// Express would match "deep-dive" as an exam id.
router.post(
  "/exam-types/deep-dive",
  requireAuth,
  requirePremium,
  async (req, res): Promise<void> => {
    const { examId, focus } = (req.body ?? {}) as { examId?: unknown; focus?: unknown };

    if (typeof examId !== "string" || !examId.trim()) {
      res.status(400).json({ error: "examId is required" });
      return;
    }
    const exam = findExam(examId);
    if (!exam) {
      res.status(404).json({ error: "Unknown exam" });
      return;
    }
    const focusText =
      typeof focus === "string" && focus.trim() ? focus.trim().slice(0, 200) : "";

    // Ground the model in verified facts. Without this, models happily describe
    // the pre-2024 paper SAT or the pre-2026 TOEFL, which would actively
    // mislead a student.
    const factSheet = buildExamFactSheet(exam);

    const systemPrompt = [
      "You are an expert exam coach writing a study briefing for a student.",
      "You will be given a VERIFIED FACT SHEET about the exam.",
      "Rules:",
      "1. Never contradict the fact sheet. It reflects the CURRENT format; your own training data may describe an older version of this exam.",
      "2. If you are unsure about a detail that is not in the fact sheet, leave it out rather than guessing.",
      "3. Be concrete and specific: name real topics, real question types and real scoring rules.",
      "4. Write for a motivated student, in clear plain English. No filler, no hype.",
      "5. Output valid JSON only, matching the requested shape exactly.",
      "6. Use plain text in every string. Never use HTML tags and never use HTML entities.",
    ].join("\n");

    const userPrompt = [
      "VERIFIED FACT SHEET:",
      factSheet,
      "",
      focusText ? `The student specifically wants to focus on: ${focusText}` : "",
      "",
      "Produce a JSON object with exactly these keys:",
      '- "summary": 2-3 sentences on what this exam actually measures and what a good score takes.',
      '- "sections": an array of 4-6 objects, each {"heading": string, "body": string}. Cover how to prepare for each part of the exam, a realistic study timeline, and how to practise. Each body should be 3-6 sentences.',
      '- "highYieldTopics": an array of 5-10 specific topics that give the best return on study time.',
      '- "commonMistakes": an array of 4-8 specific mistakes students make on THIS exam.',
      "Return only the JSON object.",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const completion = await openai.chat.completions.create({
        model: PREMIUM_AI_MODEL,
        response_format: { type: "json_object" },
        max_completion_tokens: 5000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const raw = completion.choices?.[0]?.message?.content;
      if (!raw) {
        res.status(502).json({ error: "AI service returned an empty response" });
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        res.status(502).json({ error: "AI service returned malformed content" });
        return;
      }

      const obj = parsed as Record<string, unknown>;
      const asStringArray = (v: unknown): string[] =>
        Array.isArray(v)
          ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          : [];

      const sections = Array.isArray(obj.sections)
        ? obj.sections
            .filter(
              (s): s is { heading: string; body: string } =>
                !!s &&
                typeof s === "object" &&
                typeof (s as { heading?: unknown }).heading === "string" &&
                typeof (s as { body?: unknown }).body === "string" &&
                (s as { heading: string }).heading.trim().length > 0 &&
                (s as { body: string }).body.trim().length > 0,
            )
            .map((s) => ({ heading: s.heading.trim(), body: s.body.trim() }))
        : [];

      const summary = typeof obj.summary === "string" ? obj.summary.trim() : "";

      if (!summary || sections.length === 0) {
        res.status(502).json({ error: "AI service returned unusable content" });
        return;
      }

      res.json({
        examId: exam.id,
        examName: exam.name,
        summary,
        sections,
        highYieldTopics: asStringArray(obj.highYieldTopics),
        commonMistakes: asStringArray(obj.commonMistakes),
        // Always cite the verified source rather than whatever the model claims.
        sources: [exam.officialSite].filter((s): s is string => !!s),
      });
    } catch (err) {
      req.log?.error({ err }, "exam deep dive generation failed");
      res.status(502).json({ error: "Could not generate the study briefing right now" });
    }
  },
);

router.get("/exam-types/:examId", async (req, res): Promise<void> => {
  const exam = findExam(req.params.examId ?? "");
  if (!exam) {
    res.status(404).json({ error: "Unknown exam" });
    return;
  }
  res.json(exam);
});

export default router;
