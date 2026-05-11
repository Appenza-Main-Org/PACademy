/**
 * Application Settings — global master data seeds.
 *
 * Pre-seeds the three-tier hierarchy from lookup master data:
 *   - one ApplicantCategoryConfig per `applicant-categories` lookup row
 *     (the first 3 active, the rest inactive)
 *   - a handful of ApplicantCategorySpecialization junctions per config,
 *     drawn from the global `specializations` lookup
 *   - 2–3 ApplicantSpecializationYear rows on roughly half the
 *     junctions (years 2024 / 2025 / 2026, mixed genders, plausible
 *     non-overlapping windows)
 *
 * Lookup MOCK (`MOCK.lookups['applicant-categories']`,
 * `MOCK.lookups['specializations']`) is **never mutated** — these seeds
 * import the source rows and use their `code` field as the FK.
 *
 * Determinism: uses `rng()` for capacity only. Re-seed parity with
 * `shared/mock-data/index.ts` is preserved because this module is
 * imported once at module load.
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

/* Walk the lookup `applicant-categories` rows verbatim — order preserved
 * so `sortOrder` is stable and deterministic. */
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

/**
 * V1 specialization attachments — no `category-specialization` mapping
 * exists in the lookup catalogue, so each config is pre-seeded with a
 * hand-picked subset of `specializations` rows. When the backend ships
 * the mapping table (DB_CONSTRAINTS §10.7 / §11.5), this seed switches
 * to a `WHERE (category_id, specialization_id) IN <mapping>` join.
 */
const ATTACHMENT_PLAN: Record<string, string[]> = {
  // Active configs — populated
  'CAT-01': ['SPC-01', 'SPC-02', 'SPC-03', 'SPC-07'], // ثانوية ذكور
  'CAT-02': ['SPC-01', 'SPC-09', 'SPC-11'],            // ثانوية إناث
  'CAT-03': ['SPC-01', 'SPC-02'],                      // الأزهر
  // Inactive configs — sparser seed so the user can verify the empty
  // case + the attach dialog
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
      // Guard: only attach if the specialization actually exists in the
      // lookup. Drops silently if the lookup is edited downstream.
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

/* Half of the junctions get year rows. Picked deterministically by
 * index parity rather than rng so the seed survives reseeds elsewhere. */
const YEAR_BLUEPRINT: Array<{
  year: number;
  gender: GenderType;
  appStart: string;
  appEnd: string;
  academicStart: string;
}> = [
  {
    year: 2024,
    gender: 'male',
    appStart: '2024-06-01',
    appEnd: '2024-07-31',
    academicStart: '2024-09-15',
  },
  {
    year: 2025,
    gender: 'male',
    appStart: '2025-06-01',
    appEnd: '2025-07-31',
    academicStart: '2025-09-15',
  },
  {
    year: 2026,
    gender: 'female',
    appStart: '2026-06-01',
    appEnd: '2026-07-31',
    academicStart: '2026-09-15',
  },
];

export const APPLICANT_SPECIALIZATION_YEARS: ApplicantSpecializationYear[] = (() => {
  const rows: ApplicantSpecializationYear[] = [];
  let serial = 1;
  APPLICANT_CATEGORY_SPECIALIZATIONS.forEach((cs, idx) => {
    if (idx % 2 !== 0) return; // roughly half
    YEAR_BLUEPRINT.forEach((blueprint, blueIdx) => {
      const capacity = Math.floor(rng() * 451) + 50; // 50..500
      rows.push({
        id: `asy-${serial}`,
        categorySpecializationId: cs.id,
        graduationYear: blueprint.year,
        genderType: blueprint.gender,
        capacity,
        applicationStartDate: blueprint.appStart,
        applicationEndDate: blueprint.appEnd,
        academicYearStartDate: blueprint.academicStart,
        isActive: blueIdx < 2, // first two active, last inactive
      });
      serial += 1;
    });
  });
  return rows;
})();
