/**
 * Graduation-year validation against the active admission cycle.
 *
 * The eligibility endpoint returns `allowedGraduationYears` per category —
 * the union of years configured in the cycle's matched rules. The applicant
 * profile form (`/applicant/profile`) constrains the year inputs to that set
 * so the applicant cannot submit a year outside the cycle's eligibility
 * window.
 *
 * Which year field carries the qualifying credential depends on the picked
 * category + qualification level:
 *   - officers_general (pre-university)        → thanawi year
 *   - specialized_officers · qualification = master   → postgrad year
 *   - specialized_officers · qualification = doctorate → doctorate year
 *   - any other category showing the bachelor block   → bachelor year
 */

import type { AcademicDegreeValue } from './profile-options';

export type GraduationYearField =
  | 'thanawiGradDate'
  | 'bachelorYear'
  | 'postgradYear'
  | 'doctorateYear';

export interface GraduationYearTarget {
  field: GraduationYearField;
  /**
   * Arabic label shown on the inline error message ("the bachelor's degree
   *  graduation year", etc.) so the applicant knows which credential the
   *  constraint applies to.
   */
  labelAr: string;
}

interface ResolveTargetInput {
  showBachelor: boolean;
  qualificationLevel: '' | AcademicDegreeValue;
}

/**
 * Resolves which year input the cycle's `allowedGraduationYears` applies to
 * for the applicant's current category/qualification selection. Returns
 * `null` when no terminal credential year is in scope (e.g. the bachelor
 * block is shown but the qualification level isn't picked yet).
 */
export function resolveGraduationYearTarget(
  input: ResolveTargetInput,
): GraduationYearTarget | null {
  if (!input.showBachelor) {
    return { field: 'thanawiGradDate', labelAr: 'سنة الحصول على الثانوية' };
  }
  switch (input.qualificationLevel) {
    case 'doctorate':
      return { field: 'doctorateYear', labelAr: 'سنة الحصول على الدكتوراه' };
    case 'master':
      return { field: 'postgradYear', labelAr: 'سنة الحصول على الماجستير' };
    case 'license':
    case 'bachelor':
      return { field: 'bachelorYear', labelAr: 'سنة تخرج البكالوريوس' };
    default:
      return null;
  }
}

/** Parse a graduation-year input. Date inputs (`thanawiGradDate`) yield the
 *  YYYY prefix; numeric inputs are coerced to integers. Returns `null` for
 *  empty / unparsable values. */
export function readGraduationYear(
  field: GraduationYearField,
  raw: string | number | undefined | null,
): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (field === 'thanawiGradDate') {
    const match = String(raw).match(/^(\d{4})/);
    if (!match) return null;
    const year = Number(match[1]);
    return Number.isFinite(year) ? year : null;
  }
  const year = Number(raw);
  return Number.isFinite(year) && year > 0 ? year : null;
}

/** Renders the allowed-years set in Arabic for inline error messages.
 *  Sorts ascending and joins with «، » (Arabic comma + space). */
export function formatAllowedYearsAr(
  allowedGraduationYears: readonly number[],
): string {
  return [...allowedGraduationYears]
    .sort((a, b) => a - b)
    .join('، ');
}

/**
 * Returns the inline Arabic validation message when the entered year is not
 * in the cycle's allowed set, or `null` when the entry is valid (or the
 * constraint doesn't apply yet).
 */
export function buildGraduationYearError(
  target: GraduationYearTarget,
  enteredYear: number | null,
  allowedGraduationYears: readonly number[],
): string | null {
  if (allowedGraduationYears.length === 0) return null;
  if (enteredYear === null) return null;
  if (allowedGraduationYears.includes(enteredYear)) return null;
  return `${target.labelAr} يجب أن تكون ضمن سنوات التخرج المسموح بها في دورة القبول (${formatAllowedYearsAr(allowedGraduationYears)}).`;
}
