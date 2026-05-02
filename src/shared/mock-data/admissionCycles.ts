/**
 * Admission cycles + versioned admission rules — Sprint 1 (KARASA_GAPS §1.2.C-D).
 *
 * Three cycles: 2024 finalized, 2025 active, 2026 draft. Each cycle has at
 * least one versioned admission-rule snapshot showing who changed what when.
 */

import type { AdmissionCycle, AdmissionRule } from '@/shared/types/domain';

export const ADMISSION_CYCLES: readonly AdmissionCycle[] = [
  {
    id: 'CYC-2024-M',
    nameAr: 'دورة 2024 - الذكور',
    cohort: 'male',
    year: 2024,
    openDate: '2024-01-15T00:00:00.000Z',
    closeDate: '2024-03-31T00:00:00.000Z',
    expectedCapacity: 1500,
    applicantCount: 1487,
    status: 'finalized',
  },
  {
    id: 'CYC-2025-M',
    nameAr: 'دورة 2025 - الذكور',
    cohort: 'male',
    year: 2025,
    openDate: '2025-01-15T00:00:00.000Z',
    closeDate: '2025-03-31T00:00:00.000Z',
    expectedCapacity: 1800,
    applicantCount: 1762,
    status: 'processing',
  },
  {
    id: 'CYC-2025-F',
    nameAr: 'دورة 2025 - الإناث',
    cohort: 'female',
    year: 2025,
    openDate: '2025-02-15T00:00:00.000Z',
    closeDate: '2025-04-15T00:00:00.000Z',
    expectedCapacity: 240,
    applicantCount: 238,
    status: 'open',
  },
  {
    id: 'CYC-2026-M',
    nameAr: 'دورة 2026 - الذكور',
    cohort: 'male',
    year: 2026,
    openDate: '2026-01-15T00:00:00.000Z',
    closeDate: '2026-03-31T00:00:00.000Z',
    expectedCapacity: 2000,
    applicantCount: 0,
    status: 'draft',
  },
];

const baseRule = (cycleId: string, version: number, effectiveAt: string, who: string): AdmissionRule => ({
  id: `RULE-${cycleId}-V${version}`,
  cycleId,
  version,
  effectiveAt,
  changedBy: { userId: 'U-001', name: who },
  age: { minYears: 17, maxYears: 22 },
  height: {
    male: { min: 170, max: 195 },
    female: { min: 162, max: 185 },
  },
  bmi: { min: 19, max: 28 },
  eyesight: { minRightEye: '6/9', minLeftEye: '6/9', correctionAllowed: false },
  maritalStatus: ['single'],
  noCriminalRecord: true,
  acceptedCertificates: ['ثانوية عامة', 'ثانوية أزهرية'],
  minPercentByCertType: { 'ثانوية عامة': 75, 'ثانوية أزهرية': 75 },
  applicationFee: { 'ثانوية عامة': 1500, 'ثانوية أزهرية': 1500 },
  maxApplicationsPerYear: 1,
});

export const ADMISSION_RULES: readonly AdmissionRule[] = [
  baseRule('CYC-2024-M', 1, '2024-01-01T00:00:00.000Z', 'العميد د. أحمد محمود الفقي'),
  baseRule('CYC-2025-M', 1, '2024-12-15T00:00:00.000Z', 'العميد د. أحمد محمود الفقي'),
  {
    ...baseRule('CYC-2025-M', 2, '2025-01-10T00:00:00.000Z', 'العميد د. أحمد محمود الفقي'),
    bmi: { min: 19, max: 30 },
    minPercentByCertType: { 'ثانوية عامة': 78, 'ثانوية أزهرية': 78 },
  },
  baseRule('CYC-2025-F', 1, '2025-02-01T00:00:00.000Z', 'العميد د. أحمد محمود الفقي'),
  baseRule('CYC-2026-M', 1, '2026-01-01T00:00:00.000Z', 'العميد د. أحمد محمود الفقي'),
];
