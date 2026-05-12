/**
 * Application Settings — global master data seeds.
 *
 * Pre-seeds the three-tier hierarchy from lookup master data:
 *   - one ApplicantCategoryConfig per `applicant-categories` lookup row
 *     (the first 3 active, the rest inactive)
 *   - a handful of ApplicantCategorySpecialization junctions per config,
 *     drawn from the global `specializations` lookup
 *   - 2–3 ApplicantSpecializationYear rows on roughly half the
 *     junctions; the row's `gradeKind` is derived from the parent
 *     category's submission-type `gradingMode` so GRADES vs TAGDIR
 *     branches are populated correctly out of the box
 *
 * Lookup MOCK (`MOCK.lookups['applicant-categories']`,
 * `MOCK.lookups['specializations']`, `MOCK.lookups['submission-types']`)
 * is **never mutated** — these seeds import the source rows and use
 * their `code` field as the FK.
 *
 * Marital statuses are MAR-NN codes from the `marital-statuses` lookup
 * (added 2026-05-12); divisions are DIV-NN codes from the
 * `applicant-divisions` lookup. Academic grades are AGR-NN codes from
 * the `academic-grades` lookup (read via `readPercentageRange` to show
 * the percentage hint under the picked تقدير in the UI).
 */

import { rng } from '@/shared/mock-data/seed';
import { LOOKUPS_SEED } from '@/features/lookups/mock/lookups.mock';
import { readGradingMode } from '@/features/lookups';
import type {
  ApplicantCategoryConfig,
  ApplicantCategorySpecialization,
  ApplicantSpecializationYear,
  GenderType,
} from '../types';

const FIXED_TS = '2026-05-11T08:00:00.000Z';

const CATEGORY_ROWS = LOOKUPS_SEED['applicant-categories'];
const SPECIALIZATION_ROWS = LOOKUPS_SEED['specializations'];
const SUBMISSION_TYPE_ROWS = LOOKUPS_SEED['submission-types'];

const ACTIVE_CONFIG_LIMIT = 3;

export const APPLICANT_CATEGORY_CONFIGS: ApplicantCategoryConfig[] = CATEGORY_ROWS.map(
  (cat, index) => ({
    id: `acc-${index + 1}`,
    categoryId: cat.code,
    isActive: index < ACTIVE_CONFIG_LIMIT,
    sortOrder: (index + 1) * 10,
    createdAt: FIXED_TS,
    updatedAt: FIXED_TS,
  }),
);

/**
 * Per-category attachment plan, keyed by the lookup's actual `code`
 * (snake_case, not the brief's CAT-NN prefix). Empty arrays for
 * categories the seed doesn't surface specializations for —
 * the UI shows them collapsed but creatable.
 */
const ATTACHMENT_PLAN: Record<string, string[]> = {
  officers_general:            ['SPC-01', 'SPC-02', 'SPC-03', 'SPC-07'],
  officers_specialized:        ['SPC-04', 'SPC-05', 'SPC-12'],
  postgraduate:                ['SPC-11', 'SPC-10'],
  institute_officers_training: ['SPC-09'],
  institute_traffic:           [],
  institute_guarding:          [],
  special_units:               [],
};

export const APPLICANT_CATEGORY_SPECIALIZATIONS: ApplicantCategorySpecialization[] = (() => {
  const rows: ApplicantCategorySpecialization[] = [];
  let serial = 1;
  for (const config of APPLICANT_CATEGORY_CONFIGS) {
    const planned = ATTACHMENT_PLAN[config.categoryId] ?? [];
    for (const specCode of planned) {
      if (!SPECIALIZATION_ROWS.some((s) => s.code === specCode)) continue;
      rows.push({
        id: `acs-${serial}`,
        configId: config.id,
        specializationId: specCode,
        isActive: true,
      });
      serial += 1;
    }
  }
  return rows;
})();

const CURRENT_YEAR = new Date().getFullYear();

/** Static gradingMode lookup for each category code at seed time. */
const GRADING_MODE_BY_CATEGORY: Record<string, 'GRADES' | 'TAGDIR'> = (() => {
  const out: Record<string, 'GRADES' | 'TAGDIR'> = {};
  for (const cat of CATEGORY_ROWS) {
    const md = (cat.metadata ?? {}) as { submissionTypeCode?: unknown };
    const stCode = typeof md.submissionTypeCode === 'string' ? md.submissionTypeCode : null;
    const st = stCode
      ? SUBMISSION_TYPE_ROWS.find((s) => s.code === stCode)
      : undefined;
    out[cat.code] = st ? readGradingMode(st) : 'GRADES';
  }
  return out;
})();

interface YearBlueprintBase {
  graduationYear: number;
  genderTypes: GenderType[];
  maritalStatusCodes: string[];
  maxAge: number | null;
  divisionCodes: string[];
  applicationStartDate: string;
  applicationEndDate: string;
  ageReferenceDate: string;
  isActive: boolean;
  /** Used by the GRADES branch. */
  minPercentage: number;
  /** Used by the TAGDIR branch. */
  academicGradeId: string;
}

/**
 * Three rows per attached spec, varying by graduation year. The same
 * shared-field shape is used regardless of `gradeKind`; the branch-
 * specific column is filled from `minPercentage` or `academicGradeId`
 * depending on the resolved parent gradingMode.
 *
 * `maxAge` defaults are tiered by category intent: 22 for ثانوية-track
 * (officers_general / institute_officers_training), 28 for خريجين
 * (officers_specialized), 35 for postgrad. The `divisionCodes` default
 * is empty for postgrad and خريجين categories where الشعبة doesn't
 * apply cleanly — flagged in the migration report.
 */
const YEAR_BLUEPRINTS_PER_CATEGORY: Record<string, YearBlueprintBase[]> = (() => {
  function basicGrades(year: number, gender: GenderType, divisions: string[]): YearBlueprintBase {
    return {
      graduationYear: year,
      genderTypes: [gender],
      maritalStatusCodes: ['MAR-01'],
      maxAge: 22,
      divisionCodes: divisions,
      applicationStartDate: `${year}-06-01`,
      applicationEndDate: `${year}-07-31`,
      ageReferenceDate: `${year}-04-01`,
      isActive: true,
      minPercentage: 70,
      academicGradeId: 'AGR-03',
    };
  }

  const officersGeneral: YearBlueprintBase[] = [
    { ...basicGrades(CURRENT_YEAR - 2, 'male',   ['DIV-01']),             minPercentage: 70 },
    { ...basicGrades(CURRENT_YEAR - 1, 'male',   ['DIV-01', 'DIV-02']),    minPercentage: 75 },
    { ...basicGrades(CURRENT_YEAR,     'female', ['DIV-01']),             minPercentage: 80,
      maritalStatusCodes: ['MAR-01'] },
  ];

  const officersSpecialized: YearBlueprintBase[] = [
    { ...basicGrades(CURRENT_YEAR - 4, 'male', []), maxAge: 28, academicGradeId: 'AGR-02' },
    { ...basicGrades(CURRENT_YEAR - 2, 'male', []), maxAge: 28, academicGradeId: 'AGR-03' },
    { ...basicGrades(CURRENT_YEAR - 1, 'female', []), maxAge: 28, academicGradeId: 'AGR-03',
      maritalStatusCodes: ['MAR-01', 'MAR-02'] },
  ];

  const postgraduate: YearBlueprintBase[] = [
    { ...basicGrades(CURRENT_YEAR - 5, 'male', []), maxAge: 35,
      maritalStatusCodes: ['MAR-01', 'MAR-02'], academicGradeId: 'AGR-02' },
    { ...basicGrades(CURRENT_YEAR - 3, 'male', []), maxAge: 35,
      maritalStatusCodes: ['MAR-01', 'MAR-02'], academicGradeId: 'AGR-02' },
  ];

  const instituteOfficersTraining: YearBlueprintBase[] = [
    { ...basicGrades(CURRENT_YEAR - 1, 'male', []), maxAge: 30, academicGradeId: 'AGR-03' },
  ];

  return {
    officers_general:            officersGeneral,
    officers_specialized:        officersSpecialized,
    postgraduate:                postgraduate,
    institute_officers_training: instituteOfficersTraining,
  };
})();

/**
 * Walk every attached (config, spec) and emit one row per blueprint
 * defined for the parent category code, branching the discriminator on
 * the resolved gradingMode.
 */
export const APPLICANT_SPECIALIZATION_YEARS: ApplicantSpecializationYear[] = (() => {
  const rows: ApplicantSpecializationYear[] = [];
  const configById = new Map(APPLICANT_CATEGORY_CONFIGS.map((c) => [c.id, c] as const));
  let serial = 1;
  for (const cs of APPLICANT_CATEGORY_SPECIALIZATIONS) {
    const config = configById.get(cs.configId);
    if (!config) continue;
    const blueprints = YEAR_BLUEPRINTS_PER_CATEGORY[config.categoryId] ?? [];
    const gradingMode = GRADING_MODE_BY_CATEGORY[config.categoryId] ?? 'GRADES';
    for (const bp of blueprints) {
      // burn one rng so seeded mock streams stay deterministic across
      // edits to row count
      void rng();
      const shared = {
        id: `asy-${serial}`,
        categorySpecializationId: cs.id,
        graduationYear: bp.graduationYear,
        genderTypes: bp.genderTypes,
        maritalStatusCodes: bp.maritalStatusCodes,
        maxAge: bp.maxAge,
        divisionCodes: bp.divisionCodes,
        applicationStartDate: bp.applicationStartDate,
        applicationEndDate: bp.applicationEndDate,
        ageReferenceDate: bp.ageReferenceDate,
        isActive: bp.isActive,
      };
      rows.push(
        gradingMode === 'TAGDIR'
          ? { ...shared, gradeKind: 'TAGDIR', academicGradeId: bp.academicGradeId }
          : { ...shared, gradeKind: 'GRADES', minPercentage: bp.minPercentage },
      );
      serial += 1;
    }
  }
  return rows;
})();
