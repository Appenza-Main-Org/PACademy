/**
 * Admission cycles + versioned admission rules — Sprint 1 (KARASA_GAPS §1.2.C-D),
 * extended post-polish (Bucket E) with openCategories + conditionOverrides
 * + createdAt/updatedAt.
 *
 * Demo invariant: ONE published + active cycle, every other row is a
 * draft (`إدراج ومراجعة` / `غير نشطة`) parked on an old year.
 *
 *   2023-M     draft → إدراج ومراجعة / غير نشطة
 *   2024-M     draft → إدراج ومراجعة / غير نشطة
 *   2025-M     draft → إدراج ومراجعة / غير نشطة
 *   2025-F     draft → إدراج ومراجعة / غير نشطة
 *   2026     open + isActive → اعتماد ونشر / نشطة — the single active cycle
 *
 * Only `CYC-2026-M` is published/active for the demo so admins land on a
 * single cycle in /admin/admission-setup. Existing AdmissionRule rows
 * reference these IDs; do not rename.
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
    applicantCount: 1487,
    status: 'draft',
    openCategories: {
      officers_general: { isOpen: false, capacity: 1500, notes: 'دورة 2024 — أرشيف' },
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
    applicantCount: 1762,
    status: 'draft',
    openCategories: {
      officers_general: { isOpen: false, capacity: 1800, notes: 'أرشيف' },
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
    /* Parked as draft for the demo so /admin/admission-setup highlights a
     * single published cycle (CYC-2026-M, "دورة التقديم 2026"). Kept as
     * historical test data. */
    closeDate: '2025-04-15T23:59:59.000Z',
    applicantCount: 238,
    status: 'draft',
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
      applicationFee: 250,
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
    id: 'CYC-2023-M',
    nameAr: 'دورة 2023 - الذكور',
    labelEn: 'Cycle 2023 (Male)',
    cohort: 'male',
    year: 2023,
    openDate: '2023-01-15T00:00:00.000Z',
    closeDate: '2023-03-31T00:00:00.000Z',
    applicantCount: 1352,
    status: 'draft',
    openCategories: {
      officers_general: { isOpen: false, capacity: 1400, notes: 'أرشيف' },
    },
    conditionOverrides: {},
    createdAt: '2022-11-01T00:00:00.000Z',
    updatedAt: '2023-03-31T00:00:00.000Z',
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
