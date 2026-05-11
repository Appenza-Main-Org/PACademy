/**
 * Application Settings — global master data seeds.
 *
 * Pre-seeds the three-tier hierarchy from lookup master data:
 *   - one ApplicantCategoryConfig per `applicant-categories` lookup row
 *     (the first 3 active, the rest inactive)
 *   - a handful of ApplicantCategorySpecialization junctions per config,
 *     drawn from the global `specializations` lookup
 *   - 2–3 ApplicantSpecializationYear rows on roughly half the
 *     junctions (years drawn from "last 5 + current year")
 *
 * Lookup MOCK (`MOCK.lookups['applicant-categories']`,
 * `MOCK.lookups['specializations']`) is **never mutated** — these seeds
 * import the source rows and use their `code` field as the FK.
 *
 * Marital statuses are sourced from the in-feature
 * `lib/maritalStatuses.ts` (see file header for why the lookup
 * catalogue does not host them today).
 */

import { rng } from '@/shared/mock-data/seed';
import { LOOKUPS_SEED } from '@/features/lookups/mock/lookups.mock';
import type {
  ApplicantCategoryConfig,
  ApplicantCategorySpecialization,
  ApplicantSpecializationYear,
  GenderType,
} from '../types';

const FIXED_TS = '2026-05-11T08:00:00.000Z';

const CATEGORY_ROWS = LOOKUPS_SEED['applicant-categories'];
const SPECIALIZATION_ROWS = LOOKUPS_SEED['specializations'];

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

const ATTACHMENT_PLAN: Record<string, string[]> = {
  'CAT-01': ['SPC-01', 'SPC-02', 'SPC-03', 'SPC-07'],
  'CAT-02': ['SPC-01', 'SPC-09', 'SPC-11'],
  'CAT-03': ['SPC-01', 'SPC-02'],
  'CAT-04': ['SPC-04', 'SPC-05', 'SPC-12'],
  'CAT-05': [],
  'CAT-06': ['SPC-10'],
  'CAT-07': [],
  'CAT-08': ['SPC-11', 'SPC-10'],
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

interface YearBlueprint {
  graduationYear: number;
  genderTypes: GenderType[];
  maritalStatusCodes: string[];
  maxAge: number | null;
  minGrade: number | null;
  maxGrade: number | null;
  applicationStartDate: string;
  applicationEndDate: string;
  ageCalcDate: string;
}

const YEAR_BLUEPRINT: YearBlueprint[] = [
  {
    graduationYear: CURRENT_YEAR - 2,
    genderTypes: ['male'],
    maritalStatusCodes: ['single'],
    maxAge: 22,
    minGrade: 70,
    maxGrade: 100,
    applicationStartDate: `${CURRENT_YEAR - 2}-06-01`,
    applicationEndDate: `${CURRENT_YEAR - 2}-07-31`,
    ageCalcDate: `${CURRENT_YEAR - 2}-10-01`,
  },
  {
    graduationYear: CURRENT_YEAR - 1,
    genderTypes: ['male'],
    maritalStatusCodes: ['single', 'married'],
    maxAge: 23,
    minGrade: 75,
    maxGrade: 100,
    applicationStartDate: `${CURRENT_YEAR - 1}-06-01`,
    applicationEndDate: `${CURRENT_YEAR - 1}-07-31`,
    ageCalcDate: `${CURRENT_YEAR - 1}-10-01`,
  },
  {
    graduationYear: CURRENT_YEAR,
    genderTypes: ['female'],
    maritalStatusCodes: ['single'],
    maxAge: 22,
    minGrade: 80,
    maxGrade: 100,
    applicationStartDate: `${CURRENT_YEAR}-06-01`,
    applicationEndDate: `${CURRENT_YEAR}-07-31`,
    ageCalcDate: `${CURRENT_YEAR}-10-01`,
  },
];

export const APPLICANT_SPECIALIZATION_YEARS: ApplicantSpecializationYear[] = (() => {
  const rows: ApplicantSpecializationYear[] = [];
  let serial = 1;
  APPLICANT_CATEGORY_SPECIALIZATIONS.forEach((cs, idx) => {
    if (idx % 2 !== 0) return; // roughly half
    YEAR_BLUEPRINT.forEach((blueprint, blueIdx) => {
      // burn one rng so capacity-shaped variance stays in the seed stream
      void rng();
      rows.push({
        id: `asy-${serial}`,
        categorySpecializationId: cs.id,
        ...blueprint,
        isActive: blueIdx < 2,
      });
      serial += 1;
    });
  });
  return rows;
})();
