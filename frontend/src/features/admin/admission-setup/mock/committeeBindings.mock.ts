/**
 * Committee × Day Bindings — deterministic mock seed.
 *
 * Walks every active applicant category for every cycle and seeds one
 * binding row per (committee in the category's roster × WORKING day in
 * the category's exam-schedule calendar). Per-cell capacity is computed
 * as `floor(committee.capacity / workingDayCount)` (min 1) so the matrix
 * shows realistic numbers right out of the gate. Eligibility branches by
 * the category's resolved `gradingMode`:
 *
 *   - GRADES → `{ min: 60, max: 100 }`
 *   - TAGDIR → `{ min: 'AGR-03' (جيد), max: 'AGR-01' (امتياز) }`
 *
 * The seed is pure (no `Date.now()`, no `Math.random()`) — same module
 * load → same array — so the matrix demo stays stable across renders.
 */

import { MOCK } from '@/shared/mock-data';
import { resolveCategoryGradingMode } from '../lib/resolveGradingMode';
import type {
  CommitteeDayBinding,
  BindingEligibility,
} from '../types';
import type { GradingMode } from '@/features/lookups';

const SEED_ISO = '2026-01-01T00:00:00.000Z';

function defaultEligibility(mode: GradingMode | null): BindingEligibility {
  if (mode === 'TAGDIR') {
    return {
      gradeKind: 'TAGDIR',
      minAcademicGradeId: 'AGR-03',
      maxAcademicGradeId: 'AGR-01',
    };
  }
  /* GRADES is the default when the resolution chain breaks too —
   * matches what `appSettings.mock.ts:GRADING_MODE_BY_CATEGORY` does. */
  return {
    gradeKind: 'GRADES',
    minPercentage: 60,
    maxPercentage: 100,
  };
}

function build(): CommitteeDayBinding[] {
  const out: CommitteeDayBinding[] = [];
  const categoryLookup = MOCK.lookups['applicant-categories'];
  const submissionTypeLookup = MOCK.lookups['submission-types'];

  /* Group the cycle's roster set by (cycleId, categoryId) for fast walk. */
  const rosterByCycleCategory = new Map<string, string[]>();
  for (const row of MOCK.categoryCommittees) {
    const key = `${row.cycleId}__${row.categoryId}`;
    const list = rosterByCycleCategory.get(key) ?? [];
    list.push(row.committeeId);
    rosterByCycleCategory.set(key, list);
  }

  let serial = 1;
  for (const [key, committeeIds] of rosterByCycleCategory.entries()) {
    const [cycleId, categoryId] = key.split('__');
    if (!cycleId || !categoryId) continue;

    /* Working days for (cycle, category). */
    const workingDays = MOCK.examScheduleDays.filter(
      (d) =>
        d.cycleId === cycleId &&
        d.applicantCategoryId === categoryId &&
        d.kind === 'WORKING',
    );
    if (workingDays.length === 0) continue;

    const mode = resolveCategoryGradingMode(categoryId, {
      categoryLookup,
      submissionTypeLookup,
    });
    const eligibility = defaultEligibility(mode);

    for (const committeeId of committeeIds) {
      const committee = MOCK.committees.find((c) => c.id === committeeId);
      const totalCap = committee?.capacity ?? 0;
      const perDay = Math.max(
        1,
        Math.floor(totalCap / workingDays.length) || 1,
      );
      for (const day of workingDays) {
        out.push({
          id: `CDB-${String(serial).padStart(5, '0')}`,
          cycleId,
          applicantCategoryId: categoryId,
          committeeId,
          examScheduleDayId: day.id,
          capacity: perDay,
          eligibility,
          isActive: true,
          note: null,
          createdAt: SEED_ISO,
          updatedAt: SEED_ISO,
        });
        serial += 1;
      }
    }
  }

  return out;
}

export const COMMITTEE_DAY_BINDINGS_SEED: readonly CommitteeDayBinding[] = build();
