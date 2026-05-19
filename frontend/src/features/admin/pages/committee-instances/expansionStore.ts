/**
 * Day-section expansion state for /admin/committees-exam-config.
 *
 * Persisted to localStorage (under `pa-committees-exam-config-days`)
 * keyed by cycle id, so the admin's expand/collapse choices survive
 * navigation away from the page and full page reloads.
 *
 * The store records *which days are expanded* per cycle. A missing
 * entry means "expand by default" — see `getExpansionFor()` for the
 * default-on semantics.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface PersistedShape {
  /** cycleId → list of expanded day ISO strings. */
  byCycle: Record<string, string[]>;
}

interface ExpansionStore extends PersistedShape {
  /** Replace the expanded set for a cycle. Pass [] to mark all-collapsed
   *  (distinct from "untouched" which falls through to the default-on
   *  semantics). */
  setExpanded: (cycleId: string, dates: readonly string[]) => void;
  /** Reset the cycle's record so it falls back to default-on. */
  reset: (cycleId: string) => void;
}

export const useDayExpansionStore = create<ExpansionStore>()(
  persist(
    (set) => ({
      byCycle: {},
      setExpanded: (cycleId, dates) =>
        set((s) => ({
          byCycle: { ...s.byCycle, [cycleId]: [...dates] },
        })),
      reset: (cycleId) =>
        set((s) => {
          const next = { ...s.byCycle };
          delete next[cycleId];
          return { byCycle: next };
        }),
    }),
    {
      name: 'pa-committees-exam-config-days',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/**
 * Resolve the expansion state for a given cycle. Falls through to
 * "all days expanded" when the cycle has no recorded preference.
 */
export function resolveExpandedDates(
  byCycle: Record<string, string[]>,
  cycleId: string | null,
  allDates: readonly string[],
): string[] {
  if (!cycleId) return [...allDates];
  const stored = byCycle[cycleId];
  if (stored === undefined) return [...allDates];
  /* Filter against current day set so stale entries from deleted days
   * don't leak into the controlled accordion value. */
  return stored.filter((d) => allDates.includes(d));
}
