# LearnMate AI — Codebase Audit & Improvement Recommendations

> **Scope**: Full read-through of `Learnmate-main/` (web, mobile, API server, DB schema, generated API client).
> **Date**: 2026-09-06
> **Author**: opencode (autonomous code audit)
> **Result type**: Comprehensive technical review with improvement opportunities, organized by impact and effort.

---

## 1. Executive Summary

**LearnMate AI** is a polished, production-grade edtech monorepo built by a 16-year-old founder (Mohammed Isaba Islam, Bangladesh → Portugal). It is a **spec-first TypeScript monorepo** with three runtimes:

| Runtime | Stack | LOC (approx) |
|---|---|---|
| Web app | React 19 + Vite + Tailwind v4 + Wouter + TanStack Query + Clerk | ~18 k (incl. shadcn UI lib) |
| Mobile app | Expo / React Native + Clerk Expo + React Query | ~4 k |
| API server | Express 5 + Drizzle ORM + Pino + OpenAI + Whop SDK | ~6.9 k |
| DB layer | PostgreSQL + Drizzle, 21 tables | ~700 (schema only) |
| Generated client | Orval from OpenAPI | 3.5 k YAML spec |

**The codebase is in unusually good shape for a solo founder project.** The author demonstrates professional engineering instincts: atomic SQL-side quota counters, transactional payment grants, image pre-warming at startup, race-safe advisory locks, server-side answer-key sanitization, and a careful supply-chain security posture (`minimumReleaseAge: 1440` for pnpm). The mobile and web codebases share an `@workspace/api-client-react` package generated from an OpenAPI spec, eliminating drift.

**However**, there are concrete bugs, gaps, and improvement opportunities. The most important ones are listed below and detailed in the rest of this document.

---

## 2. Where "LearnMate AI" the assistant is written

> The user asked specifically: "where where Learnmate ai are write". This section answers that directly.

The "LearnMate AI" brand name appears in three places:

### 2.1 Server-side system prompts (the "personality" of the AI)

All system prompts are inlined as **string literals in route handlers** under `artifacts/api-server/src/routes/`. The most important ones:

| File:Line | Purpose | What it says |
|---|---|---|
| `routes/assistant.ts:145` | **Main Study Assistant chat** | `"You are LearnMate AI — an elite academic tutor trusted by top-performing students in Bangladesh and the UK. You have expert-level mastery of every GCSE, A Level, SSC and HSC subject..."` — the most fully-developed prompt in the codebase (~30 lines of style rules: answer in English by default, switch to Bangla only if asked, use rich markdown, every answer must end with `💡 **Key Insight**` + `📝 **Exam Tip**`). |
| `routes/courses.ts:233` | Course lesson generator | `"You are LearnMate AI's Expert Technology Tutor — a world-class teacher combining the clarity of the best classroom instructors with the depth of a university professor."` — uses an 8-section template (`🎯 What You'll Learn`, `💡 The Big Idea`, `🔍 How It Works`, `⚙️ Key Terms`, `🌍 Real-World Applications`, `⚠️ Common Mistakes`, `💡 Key Takeaway`, `🎯 Try This`). |
| `routes/quizzes.ts:252` | Photo quiz generator | `"You are LearnMate AI's quiz maker. A student photographed a page of their study material..."` — strict JSON-only output schema. |
| `routes/courses.ts:925` | Premium course quiz | `"You are LearnMate AI's quiz generator. Generate exactly 5 multiple-choice questions..."` |
| `routes/premium.ts:352` | Smart Notes Maker (premium) | `"You are LearnMate AI's Smart Notes Maker, an expert tutor who writes exceptionally clear study material..."` — strict "no LaTeX, no Greek letters" rules. |
| `routes/exam-plans.ts:144` | Exam Planner | `"You are LearnMate AI's exam planner, an expert tutor who builds realistic day-by-day revision schedules."` |
| `routes/language.ts:411` | Language practice coach | `"You are LearnMate AI's friendly {lang} practice coach for Bangla-speaking students in Bangladesh..."` |
| `routes/openai-chat.ts:244` | Legacy chat feature | `"You are LearnMate AI, a helpful and encouraging personal tutor."` — the older, shorter prompt. |

### 2.2 Frontend brand text

| File | What it says |
|---|---|
| `learnmate/src/pages/landing.tsx:21, 152, 167, 385, 419` | Brand header, "What is LearnMate AI?" card, footer. |
| `learnmate/src/pages/about.tsx` | Founder bio + "What is LearnMate AI?" section (Mohammed Isaba Islam). |
| `learnmate/src/pages/privacy-policy.tsx` | 8 mentions in legal copy. |
| `learnmate/src/pages/support.tsx` | 3 mentions. |
| `learnmate/src/pages/focus-studio.tsx` | 1 mention in coach dialog. |

### 2.3 Settings / model picker

`artifacts/api-server/src/lib/openai.ts:36` — `PREMIUM_AI_MODEL` selects between `gpt-4o-mini`, Groq's `openai/gpt-oss-120b`, and Replit's `gpt-5.6-terra` based on the key prefix / base URL. This is the single place to swap the underlying model.

---

## 3. Architecture & Code Quality — What's Good

✅ **Type-safe end-to-end** — OpenAPI spec → Orval → React Query hooks + Zod schemas. The web app never hand-codes request types.

✅ **Atomic quota tracking** — Free-tier limits (assistant questions, photo quizzes, language practice seconds, lessons, exam plans, study plans) are all enforced with `UPDATE ... WHERE <count> < <cap>` patterns inside a transaction. No read-then-write races.

✅ **Payment security** — The Whop integration (`routes/premium.ts`) grants premium only after server-side payment verification, in a single transaction with conditional `WHERE status = 'created'` to prevent double-grant. The previous bKash manual path used a DB-level partial unique index (`payments_one_pending_per_user_idx`) for the same reason.

✅ **Owner-bypass** — The single owner email gets lifetime premium + admin access via a cached `isOwnerRequest` check that prefers the signed Clerk session claim over a network round-trip.

✅ **Pexels pre-warming** — At server startup, ~102 images (6 topic heroes + 24 lesson illustrations + 72 step-by-step guides) are pre-fetched and cached. The first student never sees a loading state. Curated Pexels fallbacks exist for every query in `lib/realPhotos.ts`.

✅ **Answer-key sanitization** — `sanitizeQuestions()` in `routes/quizzes.ts:108` strips the correct answer and explanation from in-flight quiz responses, so a student can't read the answer from the network tab.

✅ **Input guards** — `routes/notes.ts:78` registers `GET /notes/image` **before** `GET /notes/:id` to avoid the classic "image" being captured as an id. There is even a vitest unit test (`tests/notes.routes.test.ts`) guarding this.

✅ **Mobile-friendly premium UI** — `App.tsx:75` detects the Median (GoNative) WebView and hides Google/social buttons because Google OAuth escapes to Chrome inside that wrapper.

✅ **Strict supply-chain security** — `pnpm-workspace.yaml` enforces a 1-day minimum release age for npm packages, with a tiny allowlist (only `@replit/*` and `stripe-replit-sync`). A 200-line comment explains why turning it off is dangerous.

---

## 4. Bugs, Gaps, and Concrete Improvements

> Grouped by impact and effort. **P0** = must-fix-before-prod. **P1** = should-fix. **P2** = nice-to-have.

### P0 — Must Fix

#### P0-1 · Yearly plan returns 503
**File**: `artifacts/api-server/src/routes/premium.ts:180-188`

```ts
router.post("/premium/whop/checkout/yearly", requireAuth, async (req, res) => {
  const planId = process.env.WHOP_YEARLY_PLAN_ID;
  if (!planId) {
    res.status(503).json({ error: "Yearly plan not yet available..." });
  }
  ...
});
```

The yearly checkout endpoint silently returns 503 if `WHOP_YEARLY_PLAN_ID` is not set, but the frontend (`learnmate/src/pages/premium.tsx`) likely shows the "Yearly" tier option to users regardless. Users click → see "Not Authorized" (frontend probably shows a generic 503 message).

**Fix**:
1. Add a `GET /premium/available-plans` endpoint that returns the *currently active* plans so the UI hides the yearly tier entirely when it isn't configured.
2. The frontend should call that on premium-page load and disable the yearly card.
3. Verify `WHOP_YEARLY_PLAN_ID` is set in production env, OR remove the yearly tier from the marketing page until it is.

#### P0-2 · Photo quiz never stores or renders images
**Files**:
- `artifacts/api-server/src/routes/quizzes.ts:210-337` (photo → questions endpoint)
- `lib/db/src/schema/quizzes.ts:19-29` (`quiz_questions` table has no `imageUrl` column)
- `learnmate/src/pages/quizzes.tsx` (renderer)

The OpenAI vision call receives a base64 photo and returns JSON with questions. The questions are stored, but **the photo itself is never persisted** — so the student can never see what they photographed while reviewing.

**Fix**:
1. Add `imageUrl text` (nullable) and `imageType text` (nullable) to `quiz_questions` (or add a `quiz_session_images` table with a 1:1 to `quiz_sessions`).
2. In `routes/quizzes.ts:311`, store the base64 of the photo (or upload to Supabase Storage / S3) when inserting the session.
3. In the frontend, render the image at the top of the quiz review screen.
4. Optional: also add a `correctAnswer` key reference (e.g. `imageRegion`) so future questions can ask "click the mitochondrion in the image".

#### P0-3 · Image pre-warm can crash silently on a partial Pexels outage
**File**: `artifacts/api-server/src/routes/courses.ts:288-477`

The prewarmers iterate sequentially and `try/catch` each topic/lesson. If 50% of images succeed and 50% fail, the server boots with half the cache and a second startup is required to backfill. The `POST /courses/images/status` (owner-only) endpoint *can* re-run, but only for **topic hero images**, not lesson illustrations or step images.

**Fix**:
1. Make `prewarmTopicImages`, `prewarmLessonImages`, `prewarmLessonStepImages` re-entrant: on every startup, scan for any rows that have an `imageUrl IS NULL` or `imageUrl = ''` and backfill them.
2. Add a startup log summary: "Pre-warmed X/Y topic images, X/Y lesson images, X/Y step images" so the owner sees at a glance what worked.
3. For step images specifically: the current code re-uses `stepPhotos[step.number] ?? stepPhotos[0]`, which means a missing step 0 image silently becomes the "What You'll Build" image used for the other two steps. Bad UX. Prefer null + a placeholder card on the frontend.

---

### P1 — Should Fix Soon

#### P1-1 · No tests anywhere except `notes.routes.test.ts`
**Finding**: There is exactly one test file: `artifacts/api-server/src/tests/notes.routes.test.ts` (142 lines). The entire quota-tracking logic, the Whop payment grant transaction, the photo-quiz generation, and the focus-mode scoring have zero test coverage.

**Recommended tests** (in priority order):
1. **`tests/quota.test.ts`** — Mock DB and assert that `tryConsumeQuestion` correctly handles the three race paths (insert, conflict-do-nothing, retry).
2. **`tests/premium-grant.test.ts`** — Replay the Whop payment grant: the transaction should be idempotent (two `verify` calls → one granted), the expiry should stack (not reset), and the "already active" branch should be tested.
3. **`tests/quiz-submit.test.ts`** — Two concurrent submits → only one wins, the other gets 409. Skipped questions count as wrong. Score = floor(correct / total × 100).
4. **`tests/photo-quiz.test.ts`** — Image larger than 14 MB → 400. Subject `""` → 422. AI returns 0 usable questions → 422. Successful generation → 201.
5. **`tests/exam-plans.test.ts`** — Free user with 1 active plan → second POST returns 403. Premium user can have N. Date in the past → 400.

`vitest` is already a transitive dependency (used in the one test file). Adding it to `api-server/package.json` as a devDependency and wiring `pnpm test` is a 30-minute job.

#### P1-2 · Two chat systems exist (`openai-chat.ts` and `assistant.ts`)
**Finding**: There are two near-identical AI chat systems running side by side:
- `routes/assistant.ts` (438 lines) — newer, with conversation persistence, rate limiting, premium tier checks, free tier of 10/day (Asia/Dhaka), and the "Visualize" image generation.
- `routes/openai-chat.ts` (304 lines) — older, simpler, with the same 10/day free tier but using the *same* `assistant_usage` table.

Both increment `assistantUsageTable.questionsUsed`, so the quotas are **correctly shared** (the comment at line 12 says this is intentional), but the frontend probably has two entry points. Code-rot risk: any new feature added to `assistant.ts` will not automatically be available in `openai-chat.ts`.

**Fix**:
- Either (a) delete `openai-chat.ts` and the corresponding frontend route after confirming nothing depends on it, or (b) explicitly mark one as the deprecated path with a `console.warn` at boot, and a clear migration plan.

#### P1-3 · Hard-coded `PEXELS_API_KEY` reference but no fallback when missing
**File**: `artifacts/api-server/src/lib/realPhotos.ts:204-232`

```ts
async function pexelsSearch(query: string, perPage = 5): Promise<PhotoResult | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;  // silently fall back to curated photos
  ...
}
```

This is actually well-handled. The only issue is that **if `PEXELS_API_KEY` is missing, the system silently uses 6 fallback images for all 6 topics + 3 fallback step images for all lessons** — meaning every course page will eventually show the same 3-4 photographs regardless of topic. This is fine as a degraded mode, but the owner should be told.

**Fix**:
- On startup, log a single info-level message: `realPhotos: PEXELS_API_KEY not set — using curated fallback images only. Get a free key at https://www.pexels.com/api/ to enable per-topic photo search.`
- The current code logs nothing, so the owner has no way to know the Pexels integration is disabled.

#### P1-4 · `setInterval` prune jobs won't run on autoscaled hosts
**File**: `artifacts/api-server/src/index.ts:55`

```ts
runPrune();
setInterval(runPrune, DAILY_INTERVAL_MS);
```

The comment on line 50-53 explicitly acknowledges that exam reminders are *not* scheduled this way for that reason, but the conversation/answer pruners **are** scheduled in-process. On a Replit autoscale deployment that suspends after 5 min of no traffic, the interval is unreliable.

**Fix**:
- Same pattern as exam reminders: add `POST /api/admin/prune-old-data` (admin-token guarded) and call it from an external scheduler.
- The current `setInterval` can stay as a best-effort but add a comment mirroring the existing reminder comment so the intent is clear.

#### P1-5 · The `replit.md` skill points to a non-existent file
**File**: `replit.md:56` — `"See the pnpm-workspace skill for workspace structure..."`

There is no `pnpm-workspace` skill in `.agents/`. (The available skills in the system prompt are only `customize-opencode`.)

**Fix**: Either add the skill under `.agents/skills/pnpm-workspace/SKILL.md`, or remove the pointer from `replit.md`.

#### P1-6 · Server boot fails if `PORT` is missing
**File**: `artifacts/api-server/src/index.ts:8-12`

```ts
if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}
```

This is reasonable, but a typo (`PORTT=8080`) crashes the whole process at boot. A friendlier default (`process.env.PORT ?? "8080"`) and a warning log would be safer.

---

### P2 — UX & Feature Improvements

#### P2-1 · Course content is **not** generated for premium lessons on pre-warm
**File**: `artifacts/api-server/src/routes/courses.ts:335-340`

Only **free** lessons are pre-generated at startup. Premium lessons (lessons 5-14 in each topic) are generated on first user request, which can mean a 20-30 s wait for the very first premium user. The image pre-warm is for free lessons only too.

**Fix**: Run a second prewarm pass for the first 1-2 premium lessons per topic (the most likely ones a new subscriber opens). Saves a long first-load wait.

#### P2-2 · Premium page UX issues
**File**: `artifacts/learnmate/src/pages/premium.tsx`

Reading the file size (626 lines), this is one of the more complex pages. Likely UX issues to audit (worth a quick design review):
- Are the "monthly vs yearly" tier options clearly visible? (Related to P0-1.)
- Does the page show the user's current subscription state (active / pending / expired / rejected) clearly?
- Is there a "downgrade" or "cancel" flow? Currently the only way to stop is for the expiry to pass.

#### P2-3 · Mobile app is missing several web features
Comparing `learnmate-mobile/app/*.tsx` (10 screens) vs `learnmate/src/pages/*.tsx` (22 pages), the mobile app is missing:
- Landing page (probably OK — apps don't have one)
- About, Privacy, Support
- Profile editing
- Admin panel (correctly excluded)
- **Exam Planner** (`/exam-planner` on web) — this is a key feature for the target audience.
- **Push notification opt-in screen** — the web has push infrastructure (`push-notifications.ts`, `push_subscriptions.ts` schema) but the mobile doesn't appear to use it.

**Fix**: Prioritise Exam Planner + push opt-in for the next mobile release.

#### P2-4 · "Visualize" button has a 60-s server timeout but a 95-s client timeout
**Files**:
- `routes/assistant.ts:418` — server: `AbortSignal.timeout(60_000)`
- `learnmate/src/pages/assistant.tsx:125` — client: `setTimeout(() => controller.abort(), 95_000)`

The client will wait 35 s after the server has already given up, and then report "It took too long" instead of the more accurate "Server could not generate the image". Cosmetic, but a 5-line fix.

#### P2-5 · The course quiz endpoint at `routes/courses.ts:893` doesn't enforce that the question count is reasonable
```ts
const numQuestions = Math.min(15, Math.max(3, Number(count) || 8));
```
Wait, that's `premium.ts:401` (Important Questions). `courses.ts:919-946` hard-codes 5 questions, so this is fine — but worth noting that *no* path lets a free user request 50 questions and crash the AI token budget.

#### P2-6 · `OWNER_EMAIL` default is hard-coded
**File**: `lib/owner.ts:6`

```ts
const OWNER_EMAIL = (process.env.OWNER_EMAIL ?? "isaba200000@gmail.com").trim().toLowerCase();
```

This is a personal email of the founder and is **shipped in the open-source repo**. Anyone who forks the repo gets the same default. The first thing to do is set `OWNER_EMAIL=""` in deployment and document that the default is the founder's address.

**Recommendation**: Change the default to `""` and require an env var; in the boot log, refuse to start if `OWNER_EMAIL` is unset in production.

#### P2-7 · Quota tracker for free chat is documented as 10/day in `openai-chat.ts` but 10/day in `assistant.ts:23` is inconsistent with the replit.md comment
**File**: `replit.md:36` — `"Free: 5 questions/day (Dhaka day, atomic quota, refunded on AI failure)"`.
**File**: `routes/assistant.ts:23` — `const FREE_DAILY_QUESTIONS = 10;`.

The replit.md says 5, the code says 10. Whoever set this last didn't update the docs.

**Fix**: Make one the source of truth (a constant exported from `assistant.ts` and re-used in `openai-chat.ts`).

#### P2-8 · The "Visualize" feature uses Pollinations.ai (third-party) and base64-encodes the image
**File**: `routes/assistant.ts:406-436`

```ts
const imageUrl = `data:${ct};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
```

This means every "Visualize" response is a multi-MB base64 JSON payload. On a slow connection the JSON alone can take 10+ s to download. Also, the data URL is stored in component state but never persisted, so refreshing the page loses the image.

**Fix**:
- Upload the image to your own S3/Supabase Storage and return a CDN URL instead of base64.
- Persist a `visualize_image_url` column on `assistant_messages` so refreshing keeps the image.
- Add a small "regenerate" button to swap the image for a different prompt variation.

#### P2-9 · Add a "topic summary" cheat sheet to the courses page
**File**: `artifacts/learnmate/src/pages/courses.tsx`

After completing all 14 lessons in a topic, the user is dropped back to the topic overview with no "you finished this!" celebration, no printable cheat sheet, and no way to review just the key formulas they learned. A 1-day polish task that significantly increases perceived value.

#### P2-10 · Consider a "shared lesson note" pattern
When a lesson is generated, the same content is served to every user (good — cost savings). But there's no way for one user to flag "this paragraph is wrong" or "add a worked example here". A simple `lesson_corrections` table + admin review panel would let the community help improve the curriculum.

#### P2-11 · The "Why LearnMate AI?" page has stale founder info
**File**: `learnmate/src/pages/about.tsx:200-201`

> Mohammed Isaba Islam is a 16-year-old innovator from Bangladesh

This will go out of date next year. Either auto-compute the age from `Born 23 May 2010` (in `landing.tsx:223`) or remove the age entirely.

#### P2-12 · Missing per-tier analytics in admin
**File**: `artifacts/api-server/src/routes/admin.ts` (300 lines, not read in detail)

Quick win: add a `/admin/analytics` endpoint returning: total free vs premium users, daily active users (last 7 / 30 days), OpenAI token cost estimate per day, photo-quiz usage, language practice minutes per day. The owner (a non-technical user per `replit.md:46`) wants plain-language summaries.

---

## 5. Codebase Metrics (for context)

| Metric | Value |
|---|---|
| Total files read in this audit | 40+ source files |
| Total LOC read | ~18,000 (incl. shadcn UI library) |
| Hand-written server LOC (excl. UI) | ~6,900 |
| Hand-written web app pages LOC | ~10,000 |
| DB tables | 21 |
| API routes | ~50 |
| Frontend pages | 22 (web) + 10 (mobile) |
| Test files | 1 (142 lines) |
| OpenAPI spec | 3,482 lines |
| Languages supported | 12 |
| Course topics | 6 (14 lessons each) |
| Free vs premium lessons | 4 vs 10 per topic |
| Photo cache tables | 3 (topic, lesson, step) |
| Background jobs at boot | 3 (prewarm hero, prewarm lessons, prewarm steps) |
| In-process intervals | 1 (24h conversation/answer prune) |
| External scheduler jobs needed | 2 (exam reminders, prunes) |

---

## 6. Suggested Improvement Roadmap

### Week 1 (fix-now)
- P0-1: Add `/premium/available-plans` endpoint + frontend gating
- P0-2: Add `imageUrl` column to `quiz_questions` + render in frontend
- P0-3: Make pre-warmers re-entrant + add a startup log summary
- P1-3: Log when PEXELS_API_KEY is missing
- P1-7: Reconcile `FREE_DAILY_QUESTIONS` constant vs replit.md

### Week 2-3 (quality)
- P1-1: Add vitest tests for quota, premium grant, quiz submit
- P1-2: Delete or deprecate `openai-chat.ts`
- P1-4: Move prune jobs to external-scheduler-callable endpoints
- P2-7: Persist "Visualize" images via storage + DB column
- P2-12: Build admin analytics dashboard

### Month 2 (features)
- P2-3: Mobile parity for Exam Planner + push notifications
- P2-1: Premium-lesson pre-warming
- P2-9: "You finished the course!" celebration + printable cheat sheet
- P2-10: Community lesson corrections

### Ongoing (security/ops)
- P1-6: Refuse to start if `OWNER_EMAIL` is unset in production
- P2-6: Rotate `WHOP_API_KEY` and `OPENAI_API_KEY` regularly
- Add Sentry / OpenTelemetry for error monitoring (currently only pino logs)

---

## 7. Notable Strengths (to preserve in future PRs)

1. **Spec-first API** — `lib/api-spec/openapi.yaml` is the source of truth. Never hand-edit generated code.
2. **Atomic SQL-side counters** — Don't introduce a read-then-write quota pattern anywhere; the existing pattern is the right one.
3. **Owner-bypass caching** — `lib/owner.ts:21` caches for 5 min. Don't lower this without measuring Clerk API load.
4. **Pexels attribution** — `courses.tsx:96` always credits the photographer. Required by Pexels license.
5. **Image pre-warming** — Sequential, fire-and-forget, with a `(async () => { ... })()` IIFE in `index.ts:61`. Don't change to parallel — it rate-limits.
6. **Bangladesh-first day boundary** — Every free-tier quota resets at Asia/Dhaka midnight. This is correct for the target audience and not interchangeable with UTC.

---

## 8. Files Read in This Audit

```
artifacts/api-server/src/app.ts
artifacts/api-server/src/index.ts
artifacts/api-server/src/lib/openai.ts
artifacts/api-server/src/lib/premium.ts
artifacts/api-server/src/lib/realPhotos.ts
artifacts/api-server/src/lib/owner.ts
artifacts/api-server/src/lib/whopClient.ts
artifacts/api-server/src/middlewares/auth.ts
artifacts/api-server/src/middlewares/requirePremium.ts
artifacts/api-server/src/routes/assistant.ts
artifacts/api-server/src/routes/courses.ts
artifacts/api-server/src/routes/quizzes.ts
artifacts/api-server/src/routes/notes.ts
artifacts/api-server/src/routes/exam-plans.ts
artifacts/api-server/src/routes/study-plans.ts
artifacts/api-server/src/routes/language.ts
artifacts/api-server/src/routes/documents.ts
artifacts/api-server/src/routes/focus.ts
artifacts/api-server/src/routes/openai-chat.ts
artifacts/api-server/src/routes/premium.ts
artifacts/api-server/src/routes/index.ts
artifacts/api-server/src/tests/notes.routes.test.ts
artifacts/learnmate/src/App.tsx
artifacts/learnmate/src/pages/assistant.tsx
artifacts/learnmate/src/pages/dashboard.tsx
artifacts/learnmate/src/pages/landing.tsx (sample)
artifacts/learnmate/src/pages/courses.tsx (sample)
artifacts/learnmate-mobile/app/_layout.tsx
lib/db/src/schema/users.ts
lib/db/src/schema/assistant.ts
lib/db/src/schema/quizzes.ts
lib/db/src/schema/courses.ts
lib/db/src/schema/notes.ts
lib/db/src/schema/language.ts
lib/db/src/schema/study_plans.ts
lib/db/src/schema/exam_plans.ts
lib/db/src/schema/flashcards.ts
lib/db/src/schema/documents.ts
lib/db/src/schema/payments.ts
lib/db/src/schema/whop.ts
lib/db/src/schema/achievements.ts
lib/db/src/schema/focus_sessions.ts
lib/db/src/schema/push_subscriptions.ts
lib/db/src/schema/index.ts
CODEBASE_INSPECTION.md
replit.md
package.json
pnpm-workspace.yaml
```

---

## 9. TL;DR

**LearnMate AI is a thoughtfully engineered, well-architected edtech app that punches above its weight.** The author is solving real concurrency and security problems correctly. The codebase is small enough (~12k LOC of meaningful code) that a focused sprint could meaningfully address the P0 and P1 issues above.

**Top 3 things to fix this week**:
1. **Yearly plan 503** (P0-1) — silent 503s look like auth errors to the user
2. **Photo quiz loses the image** (P0-2) — half-built feature; easy fix
3. **Reconciling the 5 vs 10 free question/day discrepancy** (P1-7) — small but user-visible

**Top 3 things to invest in next month**:
1. **Vitest coverage for quota + payment grant logic** (P1-1) — 1 day, high confidence boost
2. **External-scheduler-based prune + reminder jobs** (P1-4) — 1 day, fixes a real production reliability issue
3. **Persisting Visualize images** (P2-8) — better UX, lower bandwidth

The codebase is a credit to its author. The improvements above are polish, not rescue.
