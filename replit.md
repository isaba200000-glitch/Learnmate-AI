# LearnMate AI

AI-powered study companion for students: notes, flashcards, quizzes, study plans, an AI tutor, and a paid Premium tier with advanced AI study tools.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/learnmate run dev` — run the web app (Vite, proxies `/api` to 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `CLERK_*` keys, `OPENAI_API_KEY`, `ADMIN_PASSWORD` (admin panel login), `SESSION_SECRET`; optional `OWNER_EMAIL` (owner account email, defaults to the owner's Gmail)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Web: React + Vite (`artifacts/learnmate`), Clerk auth, TanStack Query, Wouter, Tailwind v4
- API: Express 5 (`artifacts/api-server`)
- DB: PostgreSQL + Drizzle ORM (`lib/db`, schema in `lib/db/src/schema/`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval from `lib/api-spec/openapi.yaml` (spec-first; never hand-edit generated clients)
- AI: OpenAI SDK (`artifacts/api-server/src/lib/openai.ts`)

## Where things live

- Pages: `artifacts/learnmate/src/pages/` (incl. `premium.tsx` upgrade page, `admin.tsx` standalone admin panel)
- Premium UI: `artifacts/learnmate/src/components/premium/` (gate, sidebar card, Smart Notes dialog, Important Questions)
- Premium/admin API: `artifacts/api-server/src/routes/premium.ts`, `routes/admin.ts`; middlewares `requirePremium.ts`, `requireAdmin.ts`; constants in `src/lib/premium.ts`

## Product

- Free tier: notes, flashcards, quizzes, study plans, dashboard, AI tutor chat
- Premium (Tk 700 / 30 days, manual bKash Send Money to the owner's number): Smart Notes Maker (generate/summarize/solve), Important Questions predictor, AI-written quiz questions, and the Exam Prep AI study briefing — all server-gated
- Payment flow: student submits bKash TrxID + sender number → owner approves/rejects in `/admin` → premium activates instantly; duplicate TrxIDs and second pending submissions are rejected at the DB level
- AI Study Assistant (`/assistant`): streaming chat where students ask study questions in English or Bangla and get step-by-step, batch-aware answers (GCSE/A Level/SSC/HSC, NCTB & সৃজনশীল aware); conversations saved and resumable. Free: 10 questions/day (Dhaka day, atomic quota, refunded on AI failure) with visible counter + upgrade prompt. Premium/owner: unlimited. The quota is shared with the legacy OpenAI Chat endpoint — see `FREE_DAILY_QUESTIONS` in `routes/assistant.ts:23` and `routes/openai-chat.ts:14`. Streaming endpoint POST /api/assistant/chat is SSE and intentionally outside the OpenAPI spec
- Focus Mode (Focus Studio, `/tutor`, plus quick-start buttons on Notes, Planner, Exam Planner, Language): fullscreen study session with countdown; switching tabs/leaving is detected as a distraction with a "come back" warning; end-of-session summary saves time focused, distractions, and a 0-100 focus score. Free: sessions up to 30 min + basic detection. Premium/owner: up to 120 min, focus history/stats/streaks, and strict mode (fails after 3 distractions)
- Quizzes (`/quizzes`): free students get Open Trivia DB questions; Premium/owner get AI-written questions on their exact topic and difficulty, each with a teaching explanation (`lib/quiz-generation.ts`, gated in `routes/quizzes.ts` via `hasPremiumQuizAi`). If the AI provider fails, generation falls back to the question bank so quizzes never go down. Photo quizzes stay 3/24h free, unlimited Premium.
- Exam Prep (`/exam-prep`, detail at `/exam-prep/:examId`): verified reference data for 14 exams (format, timing, question counts, scoring, sections, syllabus topics with weightings, key facts, study tips, `officialSite`, `lastVerified`) in `api-server/src/lib/exam-data.ts` — free to browse. The AI study briefing (`POST /api/exam-types/deep-dive`) is Premium/owner only: `requireAuth + requirePremium` server-side, `usePremium()` + `PremiumGate` client-side. The prompt is grounded in the verified fact sheet so the model cannot describe a retired exam format. When an exam's format changes, update `exam-data.ts` and its `lastVerified`, and the accuracy tests in `src/tests/exam-types.routes.test.ts`.
- Exam Planner (`/exam-planner`): AI builds a day-by-day revision schedule for a chosen batch (GCSE, A Level, SSC, HSC) from subjects, exam date, and weak topics; students check off days and expand per-topic explanations. Free: 1 active plan, up to 14 study days, basic explanations. Premium/owner: unlimited plans, up to 60 days, deeper explanations, and regeneration with adjustments
- Tech Courses (`/courses`): 6 topics x 14 lessons (robotics, electronics, Python and more), written on demand by AI and cached forever in `course_lesson_cache`. The lesson prompt leads with an accuracy contract — omit anything uncertain rather than guessing, never invent component names/library functions/API calls/pin numbers/specs, code must actually run, state the language and hardware version, use correct SI units and realistic values, say where an analogy breaks down. Roughly the first 4 lessons per topic are free (`FREE_DAILY_LESSONS = 3`/day); the AI practice quiz is Premium/owner. Because lessons are cached globally and forever, **a prompt change does not reach existing students until the cache is cleared** — see the Gotchas.
- Language Learning (`/language`): Duolingo-style practice in 12 languages for Bangla speakers — six drills (vocabulary, grammar, fix-the-sentence, translate, **listening**, **match-the-pairs**) with Bangla explanations and a learned-words list. Listening reads the sentence aloud with the browser's speech synthesis (no audio files; falls back to showing the text where unsupported) and accepts answers ignoring case/punctuation/Latin accents. Match-the-pairs and listening are graded on the client, so they cost no extra AI calls. Gamification is free for every tier: a **daily challenge** that rotates by day (complete N exercises / answer N correctly / learn N words) plus **XP and levels** (10 XP correct, 2 XP attempted, bonus on challenge completion; level N costs 100×N XP). Challenge progress and the completion bonus are SQL-side and stamped once, so concurrent answers can't double-pay. Daily time limit enforced server-side: 10 min free / 30 min Premium, reset at midnight Asia/Dhaka; AI calls charge a minimum time cost (15s per exercise batch, 10s per grading) so the cap holds even without client heartbeats. Owner is unlimited.
- `/admin`: password login (ADMIN_PASSWORD secret), payments queue with filters, user list with premium grant/revoke
- Owner account (`OWNER_EMAIL` env, default isaba200000@gmail.com): signing in with this email auto-unlocks the admin panel (no password) and lifetime Premium; server-side check in `api-server/src/lib/owner.ts` (signed Clerk email claim fast path, verified-email API fallback, 5-min cache); server prints `[owner] owner access bound to: …` at startup

## User preferences

- Owner is non-technical: summaries in plain language, focused on what students/owner can now do

## Gotchas

- Don't import `ApiError` from the generated API client in app code — a schema type shadows the error class; read errors structurally (`err?.data?.error`)
- Payment approval/rejection and premium extension are concurrency-safe by design: status-guarded updates + SQL-side expiry math + partial unique index (`payments_one_pending_per_user_idx`). Keep it that way — no read-then-write on these paths
- Admin API calls send their own `Authorization: Bearer <admin token>`; the shared fetch only attaches the Clerk token when no Authorization header is set
- After adding a new npm dep to learnmate, transient Vite "Invalid hook call" errors are stale dep-cache artifacts — restart the web workflow
- Course lessons are cached globally and never expire. After changing the lesson prompt in `routes/courses.ts`, call `POST /api/courses/cache/clear` (owner only; optional `{"topic":"<slug>"}` to clear one topic) or students keep reading the old text. Lesson generation now rejects a truncated reply (`finish_reason === "length"`) so a half-written lesson can never enter the cache — if you shorten `max_tokens`, expect failures rather than silent truncation

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
