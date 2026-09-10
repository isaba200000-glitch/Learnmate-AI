---
name: LearnMate AI Architecture
description: Key decisions and quirks for the LearnMate AI full-stack education platform
---

## Stack
- Frontend: React + Vite (`artifacts/learnmate`), Clerk auth, TanStack Query, Wouter router, Tailwind v4
- Backend: Express 5 (`artifacts/api-server`), Clerk + @clerk/express, drizzle-orm + PostgreSQL, OpenAI npm SDK
- DB lib: `lib/db`, schema in `lib/db/src/schema/` (8 table files + index.ts)
- API client: codegen at `lib/api-client-react` and `lib/api-zod` from `lib/api-spec/openapi.yaml`

## Critical Rules
**Why:** Prevent regressions when editing.

- After adding schema files to `lib/db/src/schema/`, run `pnpm run typecheck:libs` (rebuilds declarations) before typechecking `api-server`.
- DB push command: `pnpm --filter @workspace/db run push`
- OpenAI: use `process.env.OPENAI_API_KEY` directly (not `AI_INTEGRATIONS_OPENAI_*`). Client at `artifacts/api-server/src/lib/openai.ts`.
- AI tutor chat is SSE streaming — NOT a generated hook. Frontend reads with `response.body.getReader()`.
- Clerk proxy middleware must be wired BEFORE body parsers in `app.ts` on the `CLERK_PROXY_PATH` route.
- Wouter sign-in/sign-up routes: `path="/sign-in/*?"` (optional wildcard required for OAuth callbacks).
- API contract changes are spec-first: edit `lib/api-spec/openapi.yaml`, then `pnpm --filter @workspace/api-spec run codegen` (regenerates clients + typechecks libs). Never hand-edit generated clients.
- List endpoints must return every nested resource the list UI renders (e.g. study-plans list includes `tasks`) — a bare list forces broken client-side casts.
- After adding a new radix/npm dep to learnmate, Vite HMR can throw transient "Invalid hook call" (stale dep-optimize cache) — restart the web workflow, don't chase it as a code bug.
- Tailwind v4 + Clerk: `@layer theme, base, clerk, components, utilities;` must come FIRST in index.css before `@import 'tailwindcss'`. Set `tailwindcss({ optimize: false })` in vite.config.ts.
- `publishableKeyFromHost` import: `@clerk/shared/keys` (server), `@clerk/react/internal` (client).
- Generated client exports a schema TYPE named `ApiError` that shadows the `ApiError` CLASS from custom-fetch. Never import `ApiError` in app code — cast structurally: `(err as { data?: { error?: string } | null } | null)?.data?.error ?? fallback`.
- Payment/premium invariants are DB-enforced, not app-checked: partial unique index = one pending payment per user; approve/reject use `WHERE status='pending'` claim + SQL `GREATEST(...)` expiry math. **Why:** read-then-write versions double-credited days under concurrent approves. Don't reintroduce pre-read logic on these paths.

## Owner Account (admin + lifetime premium)
- One owner email, `OWNER_EMAIL` env (default: owner's Gmail). Server-side check in `api-server/src/lib/owner.ts`: signed Clerk session `email` claim fast path → Clerk API verified-emails fallback → 5-min cache; never throws.
- Owner bypasses BOTH `requirePremium` and `requireAdmin` (admin also still accepts the HMAC password token). `/premium/subscription` returns `isOwner` and the frontend rides it (`usePremium().isOwner`).
- **Rule for new premium features:** gate server routes with `requirePremium` and client UI with `usePremium().isPremium` — the owner bypass then works automatically. Don't invent per-feature checks.
- Server logs `[owner] owner access bound to: …` at startup so env overrides are verifiable.

## Auth Pattern
- `requireAuth` middleware in `artifacts/api-server/src/middlewares/auth.ts`
- JIT provisions user row in `users` table on first authenticated request
- Sets `req.userId` on `AuthRequest` extended type
- JIT insert MUST stay idempotent (`onConflictDoNothing` on userId): a new user's first page load fires parallel requests that race to create the row; without it the losers 500.

## XP/Gamification
- XP awarded on quiz completion: `floor(score/10)*10 + 10`
- Achievements auto-granted in `/progress/stats` endpoint based on milestones
- Level stored in DB; not yet auto-leveled (future: level = floor(xp/1000) + 1)

## Time-capped features (language practice pattern)
- Daily time caps are metered server-side with an atomic upsert: heartbeat ticks credit wall-clock gap since `last_tick_at` (capped per tick; gap > pause threshold credits 0), and **every AI-consuming endpoint charges a minimum time cost through the same upsert**. **Why:** gating only on heartbeat-accrued seconds lets a client that skips heartbeats consume unlimited AI. Charge-at-the-gate closes it.
- Day boundary: current date in Asia/Dhaka (reset = 18:00 UTC). Owner gets `cap = null` → unlimited (consistent with the owner-bypass rule).
- Frontend must re-sync cap/lock state from every fresh server response (no one-shot hydration) and stop heartbeats when locked.

## Curl debugging
- API is mounted at `/api` — curl `https://$REPLIT_DEV_DOMAIN/api/...`. Paths like `/api-server/...` return Vite SPA HTML (red herring).
