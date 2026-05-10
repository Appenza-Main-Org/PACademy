/**
 * Applicant-portal mock data — Sprint 2 (KARASA_GAPS §2).
 * Exam slots + initial draft state. Deterministic via the existing seed.
 */

import { rng } from './seed';
import type { ApplicantDraft, ExamSlot, PipelineState } from '@/shared/types/domain';

/* The three sites the academy schedules at. Order matters — each of the
 * next 3 displayed days gets one site by index so applicants see all
 * three options across the visible window. */
const LOCATIONS = [
  'أكاديمية الشرطة - المقر الرئيسي', // Main Police Academy
  'اللجنة الأولى',                     // Committee 1
  'اللجنة الثانية',                    // Committee 2
];

/* Daily-only scheduling — applicant picks a day, the academy assigns the
 * specific time internally (canonical 08:00 صباحاً). Capacity is the
 * day-level total, replacing the previous 4×50 per-hour breakdown.
 * Seed emits 5 future days so the next-3 view has at least one buffer. */
export const EXAM_SLOTS: ExamSlot[] = (() => {
  const slots: ExamSlot[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + 1); // start tomorrow
  let dayOffset = 0;
  while (slots.length < 5) {
    const date = new Date(start.getTime() + dayOffset * 86_400_000);
    dayOffset += 1;
    if (date.getDay() === 5) continue; // Friday off
    const location = LOCATIONS[slots.length % LOCATIONS.length] ?? LOCATIONS[0];
    const capacity = 200;
    const reserved = Math.floor(rng() * capacity * 0.6);
    slots.push({
      id: `SLT-${date.toISOString().slice(0, 10)}`,
      date: date.toISOString(),
      time: '08:00',
      location,
      capacity,
      reserved,
    });
  }
  return slots;
})();

const PIPE: PipelineState[] = ['passed', 'in-progress', 'pending'];

export const SAMPLE_DRAFT: ApplicantDraft = {
  applicantId: 'APP-2026000',
  cycleId: 'CYC-2026-M',
  furthestStage: 0,
  suspended: false,
  lastSavedAt: Date.now() - 90_000,
  /* Pre-populated payment so the print-card preview renders realistically
   * even when the wizard is opened directly without going through Stage 6. */
  payment: {
    method: 'fawry',
    refNumber: 'PAY-2026-000-1',
    fawryCode: '9366150206',
    amount: 1500,
    paidAt: Date.now() - 86_400_000,
  },
  followUp: {
    capacities: PIPE[0],
    traits: PIPE[0],
    sports: PIPE[1],
    medical: PIPE[2],
    investigation: PIPE[2],
    finalResult: PIPE[2],
  },
};
