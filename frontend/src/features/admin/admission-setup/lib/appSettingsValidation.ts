/**
 * Application Settings — validation helpers.
 *
 * Each function returns the conflict code on failure, or `null` on success.
 * The service calls `validateYearRow` before persisting; the form calls
 * each granular function inline for real-time per-field feedback.
 *
 * Rules:
 *   - at least one gender must be selected
 *   - `maxAge`, when present, must be a positive integer
 *   - GRADES rows: `minPercentage` must be in [0, 100]
 *   - `applicationEndDate >= applicationStartDate`
 *   - `ageReferenceDate <= applicationStartDate`
 *   - no two rows under the same specialization share a graduation year
 *     while having any overlapping gender (gender sets intersect)
 *   - no two rows for the same specialization with overlapping gender
 *     sets may have overlapping `[applicationStartDate, applicationEndDate]`
 *     windows
 *
 * GRADE_MODE_MISMATCH is enforced at the service boundary, not here —
 * the validator runs over a row in isolation and doesn't know what the
 * parent category's gradingMode is.
 */

import type { GradingMode } from '@/features/lookups';
import type {
  AppSettingsConflict,
  ApplicantSpecializationYear,
  GenderType,
} from '../types';

/** Distributive `Omit` — preserves the discriminated-union narrowing on
 *  `gradeKind` that the non-distributive built-in `Omit<A | B, K>` loses. */
export type YearRowDraft = ApplicantSpecializationYear extends infer T
  ? T extends ApplicantSpecializationYear
    ? Omit<T, 'id'>
    : never
  : never;

function dayOnly(iso: string): string {
  return iso.slice(0, 10);
}

function intersects(a: readonly GenderType[], b: readonly GenderType[]): boolean {
  for (const g of a) if (b.includes(g)) return true;
  return false;
}

function intersectsNumbers(a: readonly number[], b: readonly number[]): boolean {
  for (const n of a) if (b.includes(n)) return true;
  return false;
}

export function validateGender(
  genders: readonly GenderType[],
): AppSettingsConflict | null {
  return genders.length === 0 ? 'GENDER_REQUIRED' : null;
}

export function validateAge(
  maxAge: number | null,
): AppSettingsConflict | null {
  if (maxAge === null) return null;
  if (!Number.isFinite(maxAge)) return 'AGE_NOT_POSITIVE';
  if (maxAge <= 0) return 'AGE_NOT_POSITIVE';
  if (!Number.isInteger(maxAge)) return 'AGE_NOT_POSITIVE';
  return null;
}

/** Alias for `validateAge` matching the patch's naming. */
export const validateMaxAge = validateAge;

export function validateAgeRange(
  ageMin: number | null,
  ageMax: number | null,
): AppSettingsConflict | null {
  if (ageMin === null) return null;
  if (!Number.isInteger(ageMin) || ageMin <= 0) return 'AGE_NOT_POSITIVE';
  if (ageMax !== null && ageMin > ageMax) return 'AGE_RANGE_INVALID';
  return null;
}

export function validateAgeReferenceVsApplication(
  ageReferenceDate: string,
  applicationStartDate: string,
): AppSettingsConflict | null {
  if (!ageReferenceDate || !applicationStartDate) return null;
  const ref = dayOnly(ageReferenceDate);
  const start = dayOnly(applicationStartDate);
  if (ref > start) return 'AGE_REFERENCE_AFTER_START';
  return null;
}

/**
 * Verifies the row's `gradeKind` matches the parent category's
 * `gradingMode` (resolved upstream). The service layer enforces this
 * at the write boundary; the UI banner surfaces the conflict at the
 * read boundary for pre-existing rows that drifted (admin re-pointed a
 * category at a different submission-type).
 */
export function validateGradeKindMatchesCategory(
  row: Pick<ApplicantSpecializationYear, 'gradeKind'>,
  parentGradingMode: GradingMode,
): AppSettingsConflict | null {
  return row.gradeKind === parentGradingMode ? null : 'GRADE_MODE_MISMATCH';
}

export function validateMinPercentage(
  p: number,
): AppSettingsConflict | null {
  if (!Number.isFinite(p)) return 'PERCENTAGE_OUT_OF_RANGE';
  if (p < 0 || p > 100) return 'PERCENTAGE_OUT_OF_RANGE';
  return null;
}

export function validateDateRange(
  start: string,
  end: string,
  ageReference: string,
): AppSettingsConflict | null {
  if (!start || !end || !ageReference) return 'INVALID_DATE_RANGE';
  const s = dayOnly(start);
  const e = dayOnly(end);
  if (e < s) return 'INVALID_DATE_RANGE';
  return null;
}

export function validateGraduationYears(
  years: readonly number[],
): AppSettingsConflict | null {
  return years.length === 0 ? 'GRAD_YEAR_REQUIRED' : null;
}

export function validateNoDuplicateYear(
  years: readonly number[],
  genders: readonly GenderType[],
  existingYears: readonly ApplicantSpecializationYear[],
  excludeId?: string,
): AppSettingsConflict | null {
  const collision = existingYears.find(
    (y) =>
      y.id !== excludeId &&
      intersectsNumbers(y.graduationYears, years) &&
      intersects(y.genderTypes, genders),
  );
  return collision ? 'DUPLICATE_YEAR' : null;
}

interface DateWindow {
  applicationStartDate: string;
  applicationEndDate: string;
  genderTypes: readonly GenderType[];
}

export function validateNoOverlap(
  candidate: DateWindow,
  existingYears: readonly ApplicantSpecializationYear[],
  excludeId?: string,
): AppSettingsConflict | null {
  const cStart = dayOnly(candidate.applicationStartDate);
  const cEnd = dayOnly(candidate.applicationEndDate);
  if (!cStart || !cEnd) return null;
  for (const y of existingYears) {
    if (y.id === excludeId) continue;
    if (!intersects(y.genderTypes, candidate.genderTypes)) continue;
    const yStart = dayOnly(y.applicationStartDate);
    const yEnd = dayOnly(y.applicationEndDate);
    if (!yStart || !yEnd) continue;
    if (cStart <= yEnd && yStart <= cEnd) return 'OVERLAPPING_PERIOD';
  }
  return null;
}

export function validateYearRow(
  row: YearRowDraft,
  siblingYears: readonly ApplicantSpecializationYear[],
  excludeId?: string,
): AppSettingsConflict | null {
  const gradYears = validateGraduationYears(row.graduationYears);
  if (gradYears) return gradYears;
  const years = validateGraduationYears(row.graduationYears);
  if (years) return years;
  const gender = validateGender(row.genderTypes);
  if (gender) return gender;
  const age = validateAge(row.maxAge);
  if (age) return age;
  const ageRange = validateAgeRange(row.ageMin, row.maxAge);
  if (ageRange) return ageRange;
  if (row.gradeKind === 'GRADES') {
    const pct = validateMinPercentage(row.minPercentage);
    if (pct) return pct;
  }
  const dr = validateDateRange(
    row.applicationStartDate,
    row.applicationEndDate,
    row.ageReferenceDate,
  );
  if (dr) return dr;
  const refOrder = validateAgeReferenceVsApplication(
    row.ageReferenceDate,
    row.applicationStartDate,
  );
  if (refOrder) return refOrder;
  const dup = validateNoDuplicateYear(
    row.graduationYears,
    row.genderTypes,
    siblingYears,
    excludeId,
  );
  if (dup) return dup;
  const overlap = validateNoOverlap(
    {
      applicationStartDate: row.applicationStartDate,
      applicationEndDate: row.applicationEndDate,
      genderTypes: row.genderTypes,
    },
    siblingYears,
    excludeId,
  );
  if (overlap) return overlap;
  return null;
}
