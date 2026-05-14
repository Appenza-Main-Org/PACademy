/**
 * deriveCommitteeGender — single rule mapping a committee's Arabic name
 * to a gender. The convention for the «الضباط المتخصصون» track is that
 * any committee whose name carries the marker "طالبات" admits female
 * applicants; every other name admits males.
 *
 * The helper is the single source of truth — used both when seeding the
 * mock fixtures (`shared/mock-data/index.ts`) and when persisting form
 * submissions (`features/committees`), so the client-side picker cannot
 * diverge from the rule that produced the seed.
 *
 * Lives in `shared/lib` so the seed (which can't import from features/)
 * and the committees feature can both consume it. Re-exported from
 * `features/committees` for convenience.
 *
 * Usage:
 *   const gender = deriveCommitteeGender(committee.name);
 */

const FEMALE_MARKER = 'طالبات';

export function deriveCommitteeGender(name: string): 'male' | 'female' {
  return name.includes(FEMALE_MARKER) ? 'female' : 'male';
}
