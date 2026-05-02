/**
 * Applicant-portal mock data — Sprint 2 (KARASA_GAPS §2).
 * Exam slots + initial draft state. Deterministic via the existing seed.
 */

import { rng } from './seed';
import type { ApplicantDraft, ExamSlot, PipelineState } from '@/shared/types/domain';

const LOCATIONS = ['كلية الشرطة - مبنى الاختبارات', 'كلية الشرطة - القاعة الكبرى', 'فرع الإسكندرية', 'فرع الصعيد'];
const TIMES = ['08:00', '10:00', '12:00', '14:00'];

export const EXAM_SLOTS: ExamSlot[] = (() => {
  const slots: ExamSlot[] = [];
  const start = new Date('2026-03-01T00:00:00.000Z');
  for (let dayOffset = 0; dayOffset < 30; dayOffset += 1) {
    const date = new Date(start.getTime() + dayOffset * 86_400_000);
    const dow = date.getDay();
    if (dow === 5) continue; // Friday off
    for (const time of TIMES) {
      const location = LOCATIONS[Math.floor(rng() * LOCATIONS.length)] ?? LOCATIONS[0]!;
      const capacity = 50;
      const reserved = Math.floor(rng() * capacity * 0.9);
      slots.push({
        id: `SLT-${date.toISOString().slice(0, 10)}-${time.replace(':', '')}`,
        date: date.toISOString(),
        time,
        location,
        capacity,
        reserved,
      });
    }
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
  followUp: {
    capacities: PIPE[0]!,
    traits: PIPE[0]!,
    sports: PIPE[1]!,
    medical: PIPE[2]!,
    investigation: PIPE[2]!,
    finalResult: PIPE[2]!,
  },
};
