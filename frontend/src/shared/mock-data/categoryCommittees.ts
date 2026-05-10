/**
 * CategoryCommittees seed — relationship rows binding admission committees
 * to applicant categories for the active academic year. Backs the
 * `/admin/admission-setup/wizard/committees` step picker and constrains
 * the applicant distribution stage to selected committees.
 *
 * Deterministic — every row carries an explicit `createdAt` so the seed
 * stays stable across re-renders.
 */

import type { CategoryCommittees } from '@/shared/types/domain';

const SEED_NOW = new Date('2026-04-01T08:00:00Z').toISOString();

export const CATEGORY_COMMITTEES_SEED: CategoryCommittees[] = [
  {
    id: 'CC-01',
    categoryId: 'officers_general',
    committeeId: 'C-01',
    academicYearId: '2026-2027',
    cycleId: 'CYC-2026-M',
    order: 1,
    createdAt: SEED_NOW,
    createdBy: 'U-001',
  },
  {
    id: 'CC-02',
    categoryId: 'officers_general',
    committeeId: 'C-02',
    academicYearId: '2026-2027',
    cycleId: 'CYC-2026-M',
    order: 2,
    createdAt: SEED_NOW,
    createdBy: 'U-001',
  },
  {
    id: 'CC-03',
    categoryId: 'officers_specialized',
    committeeId: 'C-03',
    academicYearId: '2026-2027',
    cycleId: 'CYC-2026-M',
    order: 3,
    createdAt: SEED_NOW,
    createdBy: 'U-001',
  },
  {
    id: 'CC-04',
    categoryId: 'officers_general',
    committeeId: 'C-04',
    academicYearId: '2026-2027',
    cycleId: 'CYC-2026-M',
    order: 4,
    createdAt: SEED_NOW,
    createdBy: 'U-001',
  },
];
