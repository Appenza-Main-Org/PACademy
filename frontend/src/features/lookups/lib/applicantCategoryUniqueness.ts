/**
 * Applicant-category uniqueness across (faculty/specialization × gender).
 *
 * Rule. The applicant flow filters which faculties + specializations are
 * shown to an applicant by gender — so the same specialization must never
 * be claimed by more than one category for the same gender. (e.g. "تربية
 * رياضية" can sit in a male-only category AND a female-only category, but
 * never in two male categories.) Pre-university categories carry no
 * faculties/specs and are ignored.
 *
 * Empty `specializationCodes` is treated as "all specializations of the
 * picked faculties" (matches the seed `physical_education_bachelor` row
 * + the «اتركه فارغًا لقبول كل تخصصات الكليات المختارة» helper).
 *
 * INTEGRATION CONTRACT. Backend mirrors §10.8 of docs/DB_CONSTRAINTS.md
 * by throwing `ConflictError('CATEGORY_SPECIALIZATION_GENDER_CONFLICT',
 * { facultyCode?, specializationCode?, gender, conflictingCategoryCode })`
 * on POST/PATCH /api/lookups/applicant-categories.
 */

import type {
  ApplicantCategoryGenderScope,
  ApplicantCategoryRow,
  SpecializationRow,
} from '../types';

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

export type CategoryUniquenessKind = 'faculty' | 'specialization';

export interface BlockedReason {
  /** Code of the other category that already claims the option. */
  categoryCode: string;
  /** Display name of the other category (for the inline badge / message). */
  categoryName: string;
  /** Gender(s) where the conflict applies. */
  genders: ApplicantCategoryGenderScope[];
}

export interface BlockedSets {
  /** Faculty codes the candidate may not select — keyed by faculty code. */
  faculties: Map<string, BlockedReason>;
  /** Specialization codes the candidate may not select — keyed by spec code. */
  specializations: Map<string, BlockedReason>;
}

export interface CategoryUniquenessConflict {
  kind: CategoryUniquenessKind;
  /** Code of the offending faculty / specialization. */
  code: string;
  /** Display label (faculty / spec name). */
  label: string;
  /** Gender(s) where the conflict applies. */
  genders: ApplicantCategoryGenderScope[];
  /** Code of the existing category that already claims it. */
  conflictingCategoryCode: string;
  conflictingCategoryName: string;
}

interface CandidateLike {
  code: string | null;
  type: ApplicantCategoryRow['type'];
  genderScope: readonly ApplicantCategoryGenderScope[];
  facultyCodes: readonly string[];
  specializationCodes: readonly string[];
}

function gendersOverlap(
  a: readonly ApplicantCategoryGenderScope[],
  b: readonly ApplicantCategoryGenderScope[],
): ApplicantCategoryGenderScope[] {
  const set = new Set(a);
  return b.filter((g) => set.has(g));
}

/* The set of specs a category effectively claims:
 *   - non-empty `specializationCodes` → exactly those.
 *   - empty `specializationCodes`     → every spec whose facultyCode is in
 *                                       facultyCodes. */
function effectiveSpecCodes(
  row: Pick<CandidateLike, 'facultyCodes' | 'specializationCodes'>,
  specs: readonly SpecializationRow[],
): Set<string> {
  if (row.specializationCodes.length > 0) return new Set(row.specializationCodes);
  if (row.facultyCodes.length === 0) return new Set();
  const allowedFaculties = new Set(row.facultyCodes);
  const out = new Set<string>();
  for (const spec of specs) {
    if (allowedFaculties.has(spec.facultyCode)) out.add(spec.code);
  }
  return out;
}

export interface ComputeBlockedArgs {
  /** Code of the row being edited — excluded from the conflict set. Null
   *  when creating a new category. */
  candidateCode: string | null;
  /** Current gender scope of the row being edited / created. */
  candidateGenders: readonly ApplicantCategoryGenderScope[];
  /** Every applicant-category currently on file. */
  existing: readonly ApplicantCategoryRow[];
  /** Every specialization on file — used to expand "all specs of a
   *  faculty" claims. */
  specs: readonly SpecializationRow[];
  /** Whether the candidate row itself has an explicit spec list. When true,
   *  we DON'T block faculties that another category partially uses (the
   *  candidate can still pick that faculty AND just avoid the overlapping
   *  specs). When the candidate is "all specs", we block any faculty whose
   *  entire spec set is already covered by an overlap-gender category. */
  candidateHasSpecList: boolean;
}

/**
 * Build the "blocked" sets the form must surface in its MultiSelects.
 *
 * Empty arrays / empty gender scope short-circuit to "nothing blocked"
 * so the form stays usable while the admin is mid-edit.
 */
export function computeBlockedSets({
  candidateCode,
  candidateGenders,
  existing,
  specs,
  candidateHasSpecList,
}: ComputeBlockedArgs): BlockedSets {
  const blocked: BlockedSets = {
    faculties: new Map(),
    specializations: new Map(),
  };
  if (candidateGenders.length === 0) return blocked;

  for (const other of existing) {
    if (!other.isActive) continue;
    if (other.type !== 'university') continue;
    if (other.code === candidateCode) continue;
    if (other.facultyCodes.length === 0) continue;

    const sharedGenders = gendersOverlap(candidateGenders, other.genderScope);
    if (sharedGenders.length === 0) continue;

    const reason: BlockedReason = {
      categoryCode: other.code,
      categoryName: other.name,
      genders: sharedGenders,
    };

    const otherEffective = effectiveSpecCodes(other, specs);
    for (const spec of otherEffective) {
      if (!blocked.specializations.has(spec)) {
        blocked.specializations.set(spec, reason);
      }
    }

    /* Block a faculty entirely only when its full spec set is claimed by
     * the other category. When the other category claims specific specs,
     * the candidate can still pick that faculty and avoid the overlap by
     * choosing different specs (explicit spec list path). */
    if (other.specializationCodes.length === 0) {
      for (const fac of other.facultyCodes) {
        if (!blocked.faculties.has(fac)) blocked.faculties.set(fac, reason);
      }
    } else if (!candidateHasSpecList) {
      /* The candidate is in "all specs of selected faculties" mode. If
       * any of the other category's specs sits inside a faculty the
       * candidate would pick, the candidate's implicit "all" claim
       * collides. Treat the faculty as blocked so the option list never
       * looks tempting; the user can switch to explicit specs to unlock
       * it. */
      const facultiesTouched = new Set<string>();
      for (const specCode of other.specializationCodes) {
        const row = specs.find((s) => s.code === specCode);
        if (row) facultiesTouched.add(row.facultyCode);
      }
      for (const fac of facultiesTouched) {
        if (!blocked.faculties.has(fac)) blocked.faculties.set(fac, reason);
      }
    }
  }

  return blocked;
}

export interface FindConflictsArgs {
  candidate: CandidateLike;
  existing: readonly ApplicantCategoryRow[];
  specs: readonly SpecializationRow[];
}

/**
 * Run the full conflict check the drawer submit handler relies on. Returns
 * the list of overlap (spec, gender) pairs so the form can surface a
 * precise inline error and the backend handshake stays symmetrical.
 */
export function findApplicantCategoryConflicts({
  candidate,
  existing,
  specs,
}: FindConflictsArgs): CategoryUniquenessConflict[] {
  if (candidate.type !== 'university') return [];
  if (candidate.genderScope.length === 0) return [];
  if (candidate.facultyCodes.length === 0) return [];

  const specByCode = new Map<string, SpecializationRow>();
  for (const s of specs) specByCode.set(s.code, s);

  const candidateSpecs = effectiveSpecCodes(candidate, specs);
  const conflicts: CategoryUniquenessConflict[] = [];

  for (const other of existing) {
    if (!other.isActive) continue;
    if (other.type !== 'university') continue;
    if (other.code === candidate.code) continue;
    if (other.facultyCodes.length === 0) continue;

    const sharedGenders = gendersOverlap(candidate.genderScope, other.genderScope);
    if (sharedGenders.length === 0) continue;

    const otherSpecs = effectiveSpecCodes(other, specs);
    for (const specCode of candidateSpecs) {
      if (!otherSpecs.has(specCode)) continue;
      const specRow = specByCode.get(specCode);
      conflicts.push({
        kind: 'specialization',
        code: specCode,
        label: specRow?.name ?? specCode,
        genders: sharedGenders,
        conflictingCategoryCode: other.code,
        conflictingCategoryName: other.name,
      });
    }
  }

  return conflicts;
}

const GENDER_LABEL: Record<ApplicantCategoryGenderScope, string> = {
  male: 'ذكور',
  female: 'إناث',
};

export function formatGenders(
  genders: readonly ApplicantCategoryGenderScope[],
): string {
  return genders.map((g) => GENDER_LABEL[g]).join(' و ');
}
