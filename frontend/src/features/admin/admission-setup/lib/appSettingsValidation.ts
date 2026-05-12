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
 *   - `minGrade <= maxGrade` when both are present
 *   - `applicationEndDate >= applicationStartDate`
 *   - `ageCalcDate` must be a parseable ISO date
 *   - no two rows under the same specialization share a graduation year
 *     while having any overlapping gender (gender sets intersect)
 *   - no two rows for the same specialization with overlapping gender
 *     sets may have overlapping `[applicationStartDate, applicationEndDate]`
 *     windows
 */

import type {
  AppSettingsConflict,
  ApplicantSpecializationYear,
  GenderType,
} from '../types';

function dayOnly(iso: string): string {
  return iso.slice(0, 10);
}

function intersects(a: readonly GenderType[], b: readonly GenderType[]): boolean {
  for (const g of a) if (b.includes(g)) return true;
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

export function validateGradeRange(
  minGrade: number | null,
  maxGrade: number | null,
): AppSettingsConflict | null {
  if (minGrade === null || maxGrade === null) return null;
  if (!Number.isFinite(minGrade) || !Number.isFinite(maxGrade)) {
    return 'GRADE_RANGE_INVALID';
  }
  if (minGrade > maxGrade) return 'GRADE_RANGE_INVALID';
  return null;
}

export function validateDateRange(
  start: string,
  end: string,
  ageCalc: string,
): AppSettingsConflict | null {
  if (!start || !end || !ageCalc) return 'INVALID_DATE_RANGE';
  const s = dayOnly(start);
  const e = dayOnly(end);
  if (e < s) return 'INVALID_DATE_RANGE';
  return null;
}

export function validateNoDuplicateYear(
  year: number,
  genders: readonly GenderType[],
  existingYears: readonly ApplicantSpecializationYear[],
  excludeId?: string,
): AppSettingsConflict | null {
  const collision = existingYears.find(
    (y) =>
      y.id !== excludeId &&
      y.graduationYear === year &&
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
  row: Omit<ApplicantSpecializationYear, 'id'>,
  siblingYears: readonly ApplicantSpecializationYear[],
  excludeId?: string,
): AppSettingsConflict | null {
  const gender = validateGender(row.genderTypes);
  if (gender) return gender;
  const age = validateAge(row.maxAge);
  if (age) return age;
  const grade = validateGradeRange(row.minGrade, row.maxGrade);
  if (grade) return grade;
  const dr = validateDateRange(
    row.applicationStartDate,
    row.applicationEndDate,
    row.ageCalcDate,
  );
  if (dr) return dr;
  const dup = validateNoDuplicateYear(
    row.graduationYear,
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
