/**
 * Motion components — thin wrappers around framer-motion for consistent
 * refined-and-subtle animations across the app.
 *
 * Durations & easings come from `--duration-base` (240ms) and
 * `--ease-out-soft` defined in `src/index.css`. All components respect
 * `prefers-reduced-motion` automatically.
 */

export { default as MotionFade } from "./motion-fade";
export { default as MotionStagger, MotionStaggerItem } from "./motion-stagger";
export { default as MotionScale } from "./motion-scale";
export { default as MotionPress } from "./motion-press";
