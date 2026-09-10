---
name: Mobile timer throttling
description: Never measure elapsed time by counting setInterval ticks on mobile — derive from Date.now() anchors.
---

Phones pause/throttle JS timers when the screen is off or the browser app is backgrounded. Any duration measured by counting interval ticks silently loses nearly all of the time (Focus Mode sessions recorded 1–12s for 25-minute plans).

**Why:** Focus Mode intentionally allows screen-off study, so the countdown froze the moment the screen went dark; only the one desktop/screen-on session ever recorded correctly.

**How to apply:** anchor `startAt`/`endAt` with `Date.now()` at start, derive remaining/elapsed from the wall clock on every tick and at save time, and resync the display on `visibilitychange → visible`. Also render summaries from the same value that gets persisted, not from UI state.

Related: Radix ScrollArea sets `overflow: scroll` on its viewport with styles that Tailwind classes can't override — to block horizontal overflow, use a plain `div` with `overflow-y-auto overflow-x-hidden` instead of ScrollArea.
