/**
 * Admission cycles + versioned admission rules — Sprint 1 (KARASA_GAPS §1.2.C-D),
 * extended post-polish (Bucket E) with openCategories + conditionOverrides
 * + createdAt/updatedAt + a forward-looking 2027 draft.
 *
 * Cycle status mapping:
 *   2024-M     finalized → reads as archived in new flows
 *   2025-M     processing → reads as closed
 *   2025-F     open       → ACTIVE (female cohort)
 *   2026-M     open       → ACTIVE (male cohort) — both run concurrently
 *   2027-M     draft (post-polish addition for the cycles UI)
 *
 * The 2025-F and 2026-M cycles both have windows bracketing the 2026-05 demo,
 * so the public `/applicant/start` gate renders both as selectable. Existing
 * AdmissionRule rows reference these IDs; do not rename.
 */

import type { AdmissionCycle, AdmissionRule } from '@/shared/types/domain';

export const ADMISSION_CYCLES: readonly AdmissionCycle[] = [
  {
    id: 'CYC-2024-M',
    nameAr: 'دورة 2024 - الذكور',
    labelEn: 'Cycle 2024 (Male)',
    cohort: 'male',
    year: 2024,
    openDate: '2024-01-15T00:00:00.000Z',
    closeDate: '2024-03-31T00:00:00.000Z',
    expectedCapacity: 1500,
    applicantCount: 1487,
    status: 'finalized',
    openCategories: {
      officers_general: { isOpen: false, capacity: 1500, notes: 'دورة 2024 — منتهية' },
    },
    conditionOverrides: {},
    createdAt: '2023-11-01T00:00:00.000Z',
    updatedAt: '2024-03-31T00:00:00.000Z',
  },
  {
    id: 'CYC-2025-M',
    nameAr: 'دورة 2025 - الذكور',
    labelEn: 'Cycle 2025 (Male)',
    cohort: 'male',
    year: 2025,
    openDate: '2025-01-15T00:00:00.000Z',
    closeDate: '2025-03-31T00:00:00.000Z',
    expectedCapacity: 1800,
    applicantCount: 1762,
    status: 'processing',
    openCategories: {
      officers_general: { isOpen: false, capacity: 1800, notes: 'تحت المعالجة' },
      officers_specialized: { isOpen: false, capacity: 200, notes: '' },
    },
    conditionOverrides: {},
    createdAt: '2024-11-01T00:00:00.000Z',
    updatedAt: '2025-04-01T00:00:00.000Z',
  },
  {
    id: 'CYC-2025-F',
    nameAr: 'دورة 2025 - الإناث',
    labelEn: 'Cycle 2025 (Female)',
    cohort: 'female',
    year: 2025,
    openDate: '2025-02-15T00:00:00.000Z',
    /* Bumped from 2025-04-15 so the demo (May 2026) reads as open. */
    closeDate: '2026-12-31T23:59:59.000Z',
    expectedCapacity: 240,
    applicantCount: 238,
    status: 'open',
    openCategories: {
      officers_general: { isOpen: true, capacity: 200, notes: 'الفئة الرئيسية للدورة' },
      officers_specialized: { isOpen: true, capacity: 40, notes: 'تقديم لخريجي الجامعات' },
      postgraduate: { isOpen: true, capacity: 20, notes: 'برامج الدراسات العليا' },
      institute_officers_training: { isOpen: false, capacity: null, notes: 'بالترشيح فقط' },
      institute_traffic: { isOpen: false, capacity: null, notes: 'بالترشيح فقط' },
      institute_guarding: { isOpen: false, capacity: null, notes: 'بالترشيح فقط' },
      special_units: { isOpen: false, capacity: null, notes: 'بالترشيح فقط' },
    },
    conditionOverrides: {},
    createdAt: '2024-12-15T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'CYC-2026-M',
    nameAr: 'دورة 2026 - الذكور',
    labelEn: 'Cycle 2026 (Male)',
    cohort: 'male',
    year: 2026,
    openDate: '2026-01-15T00:00:00.000Z',
    /* Bumped from 2026-03-31 so the demo (May 2026) reads as open alongside
     * the 2025-F cycle — exercises the multi-active-cycle picker on
     * /applicant/start. */
    closeDate: '2026-12-31T23:59:59.000Z',
    expectedCapacity: 2000,
    applicantCount: 0,
    status: 'open',
    openCategories: {
      officers_general: {
        isOpen: true,
        capacity: 2000,
        notes: 'الفئة الرئيسية للدورة',
        genderTypes: ['male'],
        startDate: '2026-01-15',
        endDate: '2026-03-31',
      },
      officers_specialized: {
        isOpen: true,
        capacity: 240,
        notes: 'تقديم لخريجي الجامعات',
        genderTypes: ['male', 'female'],
        startDate: '2026-02-01',
        endDate: '2026-04-15',
      },
      postgraduate: {
        isOpen: false,
        capacity: null,
        notes: 'يفتح لاحقاً',
        genderTypes: ['female'],
      },
      institute_officers_training: { isOpen: false, capacity: null, notes: 'بالترشيح فقط' },
      institute_traffic: { isOpen: false, capacity: null, notes: 'بالترشيح فقط' },
      institute_guarding: { isOpen: false, capacity: null, notes: 'بالترشيح فقط' },
      special_units: { isOpen: false, capacity: null, notes: 'بالترشيح فقط' },
    },
    conditionOverrides: {},
    fees: {
      applicationFee: 1500,
      fawryConfig: {
        merchantCode: 'PA-ACADEMY-2026',
        label: 'فوري',
        /* MOI reference flow specifies a 48-hour validity window for
         * Fawry payment codes. Surfaced to applicants in Stage 6. */
        retryWindowHours: 48,
      },
    },
    createdAt: '2025-11-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'CYC-2027-M',
    nameAr: 'دورة 2027 - الذكور',
    labelEn: 'Cycle 2027 (Male)',
    cohort: 'male',
    year: 2027,
    openDate: '2027-01-15T00:00:00.000Z',
    closeDate: '2027-03-31T00:00:00.000Z',
    expectedCapacity: 2200,
    applicantCount: 0,
    status: 'draft',
    openCategories: {
      officers_general: { isOpen: false, capacity: 2200, notes: 'مسودة' },
    },
    conditionOverrides: {},
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
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
