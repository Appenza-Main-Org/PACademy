/**
 * Admission setup seed data.
 *
 * Active consumer: seed source / demo dataset — do not delete during the
 * admin sprint. Admin pages must read the backend APIs, not this file.
 */

import { LOOKUPS_SEED } from '@/features/lookups/mock/lookups.mock';
import { ADMISSION_CYCLES as admissionCyclesMockData } from './admissionCycles';

const FIXED_TS = '2026-05-11T08:00:00.000Z';
const WEEKEND_DAY_INDICES: readonly number[] = [5, 6];

type GenderType = 'male' | 'female';
type DayKind = 'WORKING' | 'OFF';
type YearGradeKind = 'GRADES' | 'TAGDIR';

interface ApplicantCategoryConfigSeed {
  id: string;
  categoryId: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface ApplicantCategorySpecializationSeed {
  id: string;
  configId: string;
  specializationId: string;
  isActive: boolean;
}

interface ApplicantSpecializationYearBaseSeed {
  id: string;
  categorySpecializationId: string;
  graduationYears: number[];
  genderTypes: GenderType[];
  maritalStatusCodes: string[];
  ageMin: number | null;
  maxAge: number | null;
  divisionCodes: string[];
  schoolCategoryCodes: string[];
  applicationStartDate: string;
  applicationEndDate: string;
  ageReferenceDate: string;
  isActive: boolean;
}

interface ApplicantSpecializationYearGradesSeed extends ApplicantSpecializationYearBaseSeed {
  gradeKind: 'GRADES';
  minPercentage: number;
}

interface ApplicantSpecializationYearTagdirSeed extends ApplicantSpecializationYearBaseSeed {
  gradeKind: 'TAGDIR';
  academicGradeId: string;
}

type ApplicantSpecializationYearSeed =
  | ApplicantSpecializationYearGradesSeed
  | ApplicantSpecializationYearTagdirSeed;

interface ExamScheduleDaySeed {
  id: string;
  cycleId: string;
  applicantCategoryId: string;
  date: string;
  kind: DayKind;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

const CATEGORY_ROWS = LOOKUPS_SEED['applicant-categories'];
const SPECIALIZATION_ROWS = LOOKUPS_SEED['specializations'];
const SUBMISSION_TYPE_ROWS = LOOKUPS_SEED['submission-types'];

function readSeedGradingMode(row: (typeof SUBMISSION_TYPE_ROWS)[number]): YearGradeKind {
  const metadata = row.metadata as { gradingMode?: unknown } | undefined;
  return metadata?.gradingMode === 'TAGDIR' ? 'TAGDIR' : 'GRADES';
}

export const APPLICANT_CATEGORY_CONFIGS: ApplicantCategoryConfigSeed[] = CATEGORY_ROWS.map(
  (cat, index) => ({
    id: `acc-${index + 1}`,
    categoryId: cat.code,
    isActive: true,
    sortOrder: index + 1,
    createdAt: FIXED_TS,
    updatedAt: FIXED_TS,
  }),
);

export const IMPLICIT_DEFAULT_SPEC_CODE = '__default__';

const ATTACHMENT_PLAN: Record<string, string[]> = Object.fromEntries(
  CATEGORY_ROWS.map((category) => [
    category.code,
    attachmentPlanForCategory(category.code),
  ]),
);

function attachmentPlanForCategory(categoryCode: string): string[] {
  const category = CATEGORY_ROWS.find((row) => row.code === categoryCode);
  if (!category) return [];
  if (category.type === 'pre_university') return [IMPLICIT_DEFAULT_SPEC_CODE];

  if (category.specializationCodes.length > 0) {
    return [...category.specializationCodes];
  }

  if (category.facultyCodes.length > 0) {
    const allowedFaculties = new Set(category.facultyCodes);
    return SPECIALIZATION_ROWS
      .filter((spec) => spec.isActive && allowedFaculties.has(spec.facultyCode))
      .map((spec) => spec.code);
  }

  return [IMPLICIT_DEFAULT_SPEC_CODE];
}

export const APPLICANT_CATEGORY_SPECIALIZATIONS: ApplicantCategorySpecializationSeed[] = (() => {
  const rows: ApplicantCategorySpecializationSeed[] = [];
  let serial = 1;
  for (const config of APPLICANT_CATEGORY_CONFIGS) {
    const planned = ATTACHMENT_PLAN[config.categoryId] ?? [];
    for (const specCode of planned) {
      if (
        specCode !== IMPLICIT_DEFAULT_SPEC_CODE &&
        !SPECIALIZATION_ROWS.some((s) => s.code === specCode)
      ) {
        continue;
      }
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

const GRADING_MODE_BY_CATEGORY: Record<string, YearGradeKind> = (() => {
  const out: Record<string, YearGradeKind> = {};
  for (const cat of CATEGORY_ROWS) {
    const metadata = cat.metadata as { submissionTypeCode?: unknown } | undefined;
    const stCode = typeof metadata?.submissionTypeCode === 'string'
      ? metadata.submissionTypeCode
      : null;
    const st = stCode
      ? SUBMISSION_TYPE_ROWS.find((s) => s.code === stCode)
      : undefined;
    out[cat.code] = st ? readSeedGradingMode(st) : 'GRADES';
  }
  return out;
})();

interface YearBlueprintBase {
  graduationYears: number[];
  genderTypes: GenderType[];
  maritalStatusCodes: string[];
  ageMin: number | null;
  maxAge: number | null;
  divisionCodes: string[];
  schoolCategoryCodes: string[];
  applicationStartDate: string;
  applicationEndDate: string;
  ageReferenceDate: string;
  isActive: boolean;
  minPercentage: number;
  academicGradeId: string;
}

const YEAR_BLUEPRINTS_PER_CATEGORY: Record<string, YearBlueprintBase[]> = (() => {
  function basicGrades(year: number, gender: GenderType): YearBlueprintBase {
    return {
      graduationYears: [year],
      genderTypes: [gender],
      maritalStatusCodes: ['MAR-01'],
      ageMin: 17,
      maxAge: 22,
      divisionCodes: [],
      schoolCategoryCodes: [],
      applicationStartDate: `${year}-06-01`,
      applicationEndDate: `${year}-07-31`,
      ageReferenceDate: `${year}-04-01`,
      isActive: true,
      minPercentage: 70,
      academicGradeId: 'AGR-03',
    };
  }

  const officersGeneral: YearBlueprintBase[] = [
    {
      ...basicGrades(CURRENT_YEAR - 1, 'male'),
      ageMin: 17,
      maxAge: 22,
      minPercentage: 75,
      schoolCategoryCodes: ['SCH-01', 'SCH-03'],
    },
    {
      ...basicGrades(CURRENT_YEAR, 'male'),
      ageMin: 17,
      maxAge: 22,
      minPercentage: 80,
      schoolCategoryCodes: ['SCH-01', 'SCH-03', 'SCH-05'],
    },
  ];

  const lawBachelor: YearBlueprintBase[] = [
    {
      ...basicGrades(CURRENT_YEAR - 2, 'male'),
      ageMin: 21,
      maxAge: 28,
      academicGradeId: 'AGR-02',
      maritalStatusCodes: ['MAR-01', 'MAR-02'],
    },
    {
      ...basicGrades(CURRENT_YEAR - 1, 'female'),
      ageMin: 21,
      maxAge: 28,
      academicGradeId: 'AGR-03',
      maritalStatusCodes: ['MAR-01', 'MAR-02'],
    },
  ];

  const physicalEducationBachelor: YearBlueprintBase[] = [
    {
      ...basicGrades(CURRENT_YEAR - 2, 'female'),
      ageMin: 21,
      maxAge: 26,
      academicGradeId: 'AGR-03',
    },
    {
      ...basicGrades(CURRENT_YEAR, 'female'),
      ageMin: 21,
      maxAge: 26,
      academicGradeId: 'AGR-02',
    },
  ];

  const specializedOfficers: YearBlueprintBase[] = [
    {
      ...basicGrades(CURRENT_YEAR - 3, 'male'),
      ageMin: 21,
      maxAge: 28,
      academicGradeId: 'AGR-02',
    },
    {
      ...basicGrades(CURRENT_YEAR - 1, 'male'),
      ageMin: 21,
      maxAge: 28,
      academicGradeId: 'AGR-03',
    },
    {
      ...basicGrades(CURRENT_YEAR, 'female'),
      ageMin: 21,
      maxAge: 28,
      academicGradeId: 'AGR-03',
      maritalStatusCodes: ['MAR-01', 'MAR-02'],
    },
  ];

  return {
    officers_general: officersGeneral,
    law_bachelor: lawBachelor,
    physical_education_bachelor: physicalEducationBachelor,
    specialized_officers: specializedOfficers,
  };
})();

export const APPLICANT_SPECIALIZATION_YEARS: ApplicantSpecializationYearSeed[] = (() => {
  const rows: ApplicantSpecializationYearSeed[] = [];
  const configById = new Map(APPLICANT_CATEGORY_CONFIGS.map((c) => [c.id, c] as const));
  let serial = 1;
  for (const cs of APPLICANT_CATEGORY_SPECIALIZATIONS) {
    const config = configById.get(cs.configId);
    if (!config) continue;
    const blueprints = YEAR_BLUEPRINTS_PER_CATEGORY[config.categoryId] ?? [];
    const gradingMode = GRADING_MODE_BY_CATEGORY[config.categoryId] ?? 'GRADES';
    for (const bp of blueprints) {
      const shared = {
        id: `asy-${serial}`,
        categorySpecializationId: cs.id,
        graduationYears: bp.graduationYears,
        genderTypes: bp.genderTypes,
        maritalStatusCodes: bp.maritalStatusCodes,
        ageMin: bp.ageMin,
        maxAge: bp.maxAge,
        divisionCodes: bp.divisionCodes,
        schoolCategoryCodes: bp.schoolCategoryCodes,
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
): ExamScheduleDaySeed[] {
  const out: ExamScheduleDaySeed[] = [];
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
    serial += 1;
  }
  return out;
}

const CATEGORY_START_DATES: Record<string, string> = {
  officers_general: '2026-06-01',
  law_bachelor: '2026-06-15',
  physical_education_bachelor: '2026-07-01',
  specialized_officers: '2026-07-15',
};

export const EXAM_SCHEDULE_DAYS: ExamScheduleDaySeed[] = (() => {
  const cycleId = pickActiveCycleId();
  const out: ExamScheduleDaySeed[] = [];
  let serial = 1;
  for (const config of APPLICANT_CATEGORY_CONFIGS) {
    if (!config.isActive) continue;
    const startIso = CATEGORY_START_DATES[config.categoryId] ?? '2026-06-01';
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
