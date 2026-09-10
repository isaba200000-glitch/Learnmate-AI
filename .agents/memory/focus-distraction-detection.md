---
name: Focus distraction detection heuristic
description: How LearnMate tells "phone screen off" (allowed) apart from "left the app" (strike) during focus sessions
---

Rule: during a focus session, leaving the app = distraction strike (3 strikes fail the session, always on for all tiers, enforced client AND server side with `>= 3`), but turning the phone screen off must NOT count (sounds keep playing, owner's explicit requirement).

**Why:** browsers fire the same `visibilitychange: hidden` for both. A blur-before-hidden heuristic FAILED in production — many mobile browsers never fire `blur` on app switch, so distractions were silently swallowed and the owner reported the feature "not working".

**How to apply:** on coarse-pointer devices, count `hidden` only if a user interaction (pointerdown/touchstart/keydown — NOT blur; some phone browsers fire blur right before screen-off's hidden, so treating blur as an interaction causes false strikes) happened within ~3s before — app switching always requires touching the screen; power button/screen timeout does not. Desktop counts every hidden plus window blur (with a 2s debounce since blur+hidden fire together). Keep client and server failure thresholds in lockstep.
