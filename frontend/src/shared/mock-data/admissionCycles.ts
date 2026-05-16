/**
 * Admission cycles + versioned admission rules — Sprint 1 (KARASA_GAPS §1.2.C-D),
 * extended post-polish (Bucket E) with openCategories + conditionOverrides
 * + createdAt/updatedAt + a forward-looking 2027 draft.
 *
 * Cycle status mapping:
 *   2024-M     finalized → reads as archived in new flows
 *   2025-M     processing → reads as closed
 *   2025-F     closed     → inactive (kept as historical test data)
 *   2026     open       → ACTIVE — the single active admission cycle ("دورة التقديم 2026")
 *   2027-M     draft (post-polish addition for the cycles UI)
 *
 * Only `CYC-2026-M` is active for the demo so admins land on a single cycle
 * in /admin/admission-setup. Existing AdmissionRule rows reference these IDs;
 * do not rename.
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
      specialized_officers: { isOpen: false, capacity: 200, notes: '' },
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
    /* Closed for the demo so /admin/admission-setup highlights a single
     * active cycle (CYC-2026-M, "دورة التقديم 2026"). Kept as historical
     * test data. */
    closeDate: '2025-04-15T23:59:59.000Z',
    expectedCapacity: 240,
    applicantCount: 238,
    status: 'closed',
    openCategories: {
      officers_general: { isOpen: true, capacity: 200, notes: 'الفئة الرئيسية للدورة' },
      specialized_officers: { isOpen: true, capacity: 40, notes: 'تقديم لخريجي الجامعات' },
      law_bachelor: { isOpen: true, capacity: 30, notes: 'خريجو الحقوق' },
      physical_education_bachelor: { isOpen: false, capacity: null, notes: 'يفتح في الدورة النسائية' },
    },
    conditionOverrides: {},
    createdAt: '2024-12-15T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'CYC-2026-M',
    nameAr: 'دورة التقديم 2026',
    labelEn: 'Cycle 2026',
    cohort: 'male',
    year: 2026,
    openDate: '2026-01-15T00:00:00.000Z',
    /* The single active admission cycle for the demo — closeDate kept beyond
     * the demo date so /admin/admission-setup shows it as the active cycle. */
    closeDate: '2026-12-31T23:59:59.000Z',
    expectedCapacity: 2000,
    applicantCount: 0,
    status: 'open',
    /* Single-active invariant — only this cycle carries isActive=true at seed. */
    isActive: true,
    openCategories: {
      officers_general: {
        isOpen: true,
        capacity: 2000,
        notes: 'الفئة الرئيسية للدورة',
        genderTypes: ['male'],
        startDate: '2026-01-15',
        endDate: '2026-03-31',
      },
      specialized_officers: {
        isOpen: true,
        capacity: 240,
        notes: 'تقديم لخريجي الجامعات',
        genderTypes: ['male', 'female'],
        startDate: '2026-02-01',
        endDate: '2026-04-15',
      },
      law_bachelor: {
        isOpen: true,
        capacity: 120,
        notes: 'تقديم لخريجي كليات الحقوق',
        genderTypes: ['male', 'female'],
        startDate: '2026-02-01',
        endDate: '2026-04-15',
      },
      physical_education_bachelor: {
        isOpen: false,
        capacity: null,
        notes: 'يفتح في الدورة النسائية',
        genderTypes: ['female'],
      },
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
