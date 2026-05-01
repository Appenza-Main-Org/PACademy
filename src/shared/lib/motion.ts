/**
 * Reduced-motion-aware motion helpers.
 *
 * Source: Tasks/DESIGN_SYSTEM.md §2.7 + Sprint 0 Part D.
 *
 * Every animation in the app routes through these helpers so that
 * `prefers-reduced-motion: reduce` is respected centrally rather than
 * scattered across components.
 *
 * Usage:
 *   import { motionDuration, prefersReducedMotion } from '@/shared/lib/motion';
 *   const dur = motionDuration('base'); // -> '180ms' | '0ms'
 */

export const DURATIONS = {
  instant: 80,
  fast:    120,
  base:    180,
  slow:    240,
  slower:  320,
} as const;

export type DurationToken = keyof typeof DURATIONS;

export const EASINGS = {
  standard:   'cubic-bezier(0.2, 0, 0, 1)',
  emphasized: 'cubic-bezier(0.3, 0, 0, 1)',
  decelerate: 'cubic-bezier(0, 0, 0, 1)',
  accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
} as const;

export type EasingToken = keyof typeof EASINGS;

/** True iff the user has asked for reduced motion. SSR-safe (defaults to false). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Duration in ms (number) — collapses to 0 when reduced motion is requested. */
export function motionDurationMs(token: DurationToken): number {
  return prefersReducedMotion() ? 0 : DURATIONS[token];
}

/** Duration as CSS string ("180ms"). */
export function motionDuration(token: DurationToken): string {
  return `${motionDurationMs(token)}ms`;
}

/** Build a CSS `transition` shorthand respecting reduced motion. */
export function transition(
  property: string,
  duration: DurationToken = 'fast',
  easing: EasingToken = 'standard',
): string {
  return `${property} ${motionDuration(duration)} ${EASINGS[easing]}`;
}

/**
 * Subscribe to reduced-motion changes (e.g. for a React effect). Returns an
 * unsubscribe function. Useful when a component caches motion presets.
 */
export function onReducedMotionChange(handler: (reduced: boolean) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const listener = (event: MediaQueryListEvent): void => handler(event.matches);
  mq.addEventListener('change', listener);
  return () => mq.removeEventListener('change', listener);
}
