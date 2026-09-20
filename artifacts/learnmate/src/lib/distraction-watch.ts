/**
 * Shared "did the student leave the app?" detector used by BOTH focus surfaces
 * (the fullscreen Focus Mode overlay and the Focus Studio pomodoro page) so the
 * 3-strike rule behaves identically everywhere.
 *
 * ── The problem ─────────────────────────────────────────────────────────────
 * Browsers fire the SAME `visibilitychange -> hidden` event for two very
 * different things:
 *   1. the student switched to another app / tab   → must count as a strike
 *   2. the student turned the phone screen off     → must NOT count
 *      (owner requirement: ambient sounds keep playing with the screen off)
 *
 * ── Why strikes were being missed ───────────────────────────────────────────
 * • Desktop: the Focus Studio page had NO `blur` listener, and switching to
 *   another *application* (rather than another tab) leaves the page
 *   `visible` — so no `hidden` ever fired and the switch went uncounted.
 * • Phone: a hide only counted when a touch had landed in the previous 3s.
 *   Leaving an app is usually a SYSTEM gesture — edge-swipe home, the recents
 *   button, the notification shade, tapping a notification — and those deliver
 *   no touch to the page, so a real app switch looked exactly like a
 *   screen-off. Scrolling (the most common thing a reader does) wasn't
 *   tracked as interaction at all.
 *
 * ── The heuristic now ───────────────────────────────────────────────────────
 * • Desktop (fine pointer): every `hidden` counts, plus window `blur` for the
 *   "switched to another window that didn't hide the page" case.
 * • Phone (coarse pointer): a hide counts when the student interacted with the
 *   page shortly before it — using a much wider signal set (pointer, touch,
 *   key, scroll, wheel) and a 10s window instead of 3s, which is what actually
 *   precedes a deliberate app switch.
 * • A screen wake lock is held for the caller while the session runs, so the
 *   screen no longer times out mid-session. That removes the single most
 *   common accidental screen-off and keeps the timer readable — and anything
 *   that still hides the page is far more likely to be a real app switch.
 *
 * Deliberately NOT used on phones:
 * • `blur` — several mobile browsers fire it immediately before a screen-off's
 *   `hidden`, so treating it as evidence causes false strikes (regression that
 *   was caught in production once already).
 * • `document.hasFocus()` — the lock screen is a system window that takes
 *   focus, so a screen-off also reports focus loss.
 */

/** Strikes that fail a session. Must stay in lockstep with the server. */
export const STRICT_MAX_DISTRACTIONS = 3;

/**
 * How long before a hide a user interaction still marks that hide as a
 * deliberate app switch. Wide enough to cover "read, then tap a notification",
 * short enough that an idle phone left alone doesn't trip it.
 */
const INTERACTION_WINDOW_MS = 10_000;

/** visibilitychange + blur usually fire together — only ever count once. */
const DEBOUNCE_MS = 2_000;

/** Delay before judging a bare `blur` (lets a `hidden` land first). */
const BLUR_SETTLE_MS = 300;

type WakeLockLike = { release: () => Promise<void>; released: boolean };

export interface DistractionWatchOptions {
  /** Called once per detected distraction (already debounced). */
  onDistracted: () => void;
  /** Watcher is inert while this returns false (e.g. timer paused). */
  isActive: () => boolean;
}

function prefersCoarsePointer(): boolean {
  try {
    return window.matchMedia?.("(pointer: coarse)").matches ?? false;
  } catch {
    return false;
  }
}

/**
 * Keeps the screen awake while a session runs, re-acquiring after the page
 * comes back (the browser always drops the lock when the page hides).
 * Entirely best-effort: unsupported browsers just carry on without it.
 */
function createScreenWakeLock(isActive: () => boolean) {
  const api = (
    navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockLike> };
    }
  ).wakeLock;
  if (!api) return { acquire: () => {}, release: () => {} };

  let lock: WakeLockLike | null = null;
  let stopped = false;

  const acquire = () => {
    if (stopped || lock || document.visibilityState !== "visible") return;
    if (!isActive()) return;
    api
      .request("screen")
      .then((l) => {
        if (stopped) {
          void l.release().catch(() => {});
          return;
        }
        lock = l;
      })
      .catch(() => {
        // Denied (battery saver, permissions policy, unsupported) — ignore.
      });
  };

  const release = () => {
    stopped = true;
    const held = lock;
    lock = null;
    if (held && !held.released) void held.release().catch(() => {});
  };

  return { acquire, release };
}

/**
 * Starts watching for the student leaving the app.
 * Returns a cleanup function that removes every listener.
 */
export function watchForDistractions({
  onDistracted,
  isActive,
}: DistractionWatchOptions): () => void {
  const isPhone = prefersCoarsePointer();

  let lastStrikeAt = 0;
  let lastInteractionAt = 0;

  const wakeLock = createScreenWakeLock(isActive);
  wakeLock.acquire();

  const fire = () => {
    if (!isActive()) return;
    const now = Date.now();
    if (now - lastStrikeAt < DEBOUNCE_MS) return;
    lastStrikeAt = now;
    onDistracted();
  };

  // NOTE: `blur` is deliberately NOT recorded as an interaction — some phone
  // browsers fire blur right before a screen-off's `hidden`, and treating that
  // as a touch would turn every screen-off into a false strike.
  const noteInteraction = () => {
    lastInteractionAt = Date.now();
  };

  // Desktop only: another window can take over while this page stays
  // "visible", so the blur itself is the distraction. Re-checked after a beat
  // — if the page also went hidden, the visibility handler owns it and the
  // debounce keeps it to one strike.
  const onBlur = () => {
    window.setTimeout(() => {
      if (document.visibilityState === "visible") fire();
    }, BLUR_SETTLE_MS);
  };

  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      // Back in the app — re-arm the wake lock the browser dropped on hide.
      wakeLock.acquire();
      return;
    }
    if (document.visibilityState !== "hidden") return;
    if (!isPhone) {
      fire();
      return;
    }
    // Phone: a hide right after the student was using the page is an app
    // switch. An untouched phone going dark is a screen-off and stays free.
    if (Date.now() - lastInteractionAt < INTERACTION_WINDOW_MS) fire();
  };

  const interactionEvents = [
    "pointerdown",
    "touchstart",
    "keydown",
    "wheel",
    "scroll",
  ] as const;

  for (const type of interactionEvents) {
    window.addEventListener(type, noteInteraction, { capture: true, passive: true });
  }
  if (!isPhone) window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    for (const type of interactionEvents) {
      window.removeEventListener(type, noteInteraction, true);
    }
    if (!isPhone) window.removeEventListener("blur", onBlur);
    document.removeEventListener("visibilitychange", onVisibility);
    wakeLock.release();
  };
}
