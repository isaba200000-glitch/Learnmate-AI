# Focus Mode 3-strike rule — verification (July 29, 2026)

The distraction heuristic (count any app/tab switch; never count phone screen-off)
was verified three ways after the blur-only heuristic was replaced.

## 1. Automated UI tests (jsdom, `pnpm --filter @workspace/learnmate test`)

`src/components/focus/focus-mode.test.tsx` — all passing:

- **Phone, screen-off**: `(pointer: coarse)` + `visibilitychange → hidden` with
  no touch in the prior 3s → distraction count stays 0, no warning. ✅
- **Phone, screen-off with blur**: some phone browsers fire `blur` right before
  the screen-off `hidden`. Blur is no longer recorded as a user interaction
  (fixed during this verification — it previously caused a false strike),
  so `blur → hidden` with no touch stays at 0 distractions. ✅
- **Phone, app switch ×3**: touchstart shortly before each hidden → warnings
  "Distraction 1 of 3" and "2 of 3" appear, 3rd strike immediately shows the
  "Session failed" summary and saves the session with `distractions: 3`. ✅
- **Debounce**: a burst of hidden/visible events counts once per 2s. ✅
- **Desktop**: 3 hidden events (no touch needed) → fails and saves. ✅

## 2. API check (live dev server, real Clerk session token)

`POST /api/focus/sessions` for a throwaway Clerk user (deleted after):

- `distractions: 3` → `201 { failed: true, score: 0, strict: true }` ✅
- `distractions: 2` → `201 { failed: false, score: 90 }` (control) ✅
- `strict: false` sent by the client is ignored — server forces `strict: true`. ✅

## 3. Phone-browser check

The phone path was exercised with emulated coarse-pointer + touch events
(above), which covers the exact branch that hid the old bug: mobile browsers
that never fire `blur` on app switch. A spot-check on a physical phone is
still worthwhile when convenient:

1. Open LearnMate in a phone browser, start a Focus session.
2. Switch to another app (home gesture / recents) and come back →
   "Distraction 1 of 3" warning should appear.
3. Press the power button (screen off), turn it back on → count must NOT change.
4. Leave the app 3 times total → "Session failed" summary, focus score 0.
