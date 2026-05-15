/**
 * Exam Schedule — per-category calendar seed.
 *
 * For each `ApplicantCategoryConfig` marked active in step 1, seed ~30
 * consecutive days starting at a plausible point inside the active
 * cycle window. Weekends (Fri / Sat) are pre-marked `OFF`; weekdays
 * are `WORKING`. Note is null by default.
 *
 * Deterministic — no `rng()` calls. The seed pulls from MOCK indirectly
 * via the `APPLICANT_CATEGORY_CONFIGS` import (which itself is
 * deterministic), so the same render gives the same days.
 */

import { APPLICANT_CATEGORY_CONFIGS } from './appSettings.mock';
import { ADMISSION_CYCLES as admissionCyclesMockData } from '@/shared/mock-data/admissionCycles';
import { WEEKEND_DAY_INDICES } from '../types';
import type { ExamScheduleDay, DayKind } from '../types';

const FIXED_TS = '2026-05-11T08:00:00.000Z';

/** Pick the active demo cycle deterministically — the one labeled
 *  status 'open' is the demo's primary axis. */
function pickActiveCycleId(): string {
  const active = admissionCyclesMockData.find((c) => c.status === 'open');
  return (active ?? admissionCyclesMockData[0])!.id;
}

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildSeedForCategory(
  cycleId: string,
  applicantCategoryId: string,
  startIso: string,
  daySerialStart: number,
): ExamScheduleDay[] {
  const out: ExamScheduleDay[] = [];
  const start = new Date(`${startIso}T00:00:00.000Z`);
  let serial = daySerialStart;
  for (let i = 0; i < 30; i++) {
    const cursor = new Date(start);
    cursor.setUTCDate(cursor.getUTCDate() + i);
    const iso = toIsoDate(cursor);
    const kind: DayKind = WEEKEND_DAY_INDICES.includes(cursor.getUTCDay())
      ? 'OFF'
      : 'WORKING';
    out.push({
      id: `ESD-SEED-${serial}`,
      cycleId,
      applicantCategoryId,
      date: iso,
      kind,
      note: null,
      createdAt: FIXED_TS,
      updatedAt: FIXED_TS,
    });
    serial++;
  }
  return out;
}

/**
 * Stagger each category's start date inside the active cycle window
 * (`open_date` 2026-01-15 → `close_date` 2026-12-31) so the seeded
 * calendars don't fully overlap. Each block is 30 days; the cycle
 * window comfortably holds a year of staggered starts.
 */
const CATEGORY_START_DATES: Record<string, string> = {
  officers_general:            '2026-06-01',
  law_bachelor:                '2026-06-15',
  physical_education_bachelor: '2026-07-01',
  specialized_officers:        '2026-07-15',
};

export const EXAM_SCHEDULE_DAYS: ExamScheduleDay[] = (() => {
  const cycleId = pickActiveCycleId();
  const out: ExamScheduleDay[] = [];
  let serial = 1;
  for (const config of APPLICANT_CATEGORY_CONFIGS) {
    if (!config.isActive) continue;
    const startIso =
      CATEGORY_START_DATES[config.categoryId] ?? '2026-06-01';
    const rows = buildSeedForCategory(
      cycleId,
      config.categoryId,
      startIso,
      serial,
    );
    out.push(...rows);
    serial += rows.length;
  }
  return out;
})();
