/**
 * Application Settings — validation helpers.
 *
 * Single source of truth for the 4 year-row invariants. Each function
 * returns the conflict code on failure, or `null` on success. Service
 * calls `validateYearRow` before mutating; the form calls each function
 * inline for real-time feedback as the admin types.
 *
 * Rules:
 *   - dates must be ISO `YYYY-MM-DD`
 *   - capacity must be > 0
 *   - graduation year + gender must be unique within sibling rows
 *   - application windows for the same gender under the same
 *     specialization must not overlap
 */

import type {
  AppSettingsConflict,
  ApplicantSpecializationYear,
} from '../types';

function dayOnly(iso: string): string {
  // Accept full ISO timestamps as well as date-only strings.
  return iso.slice(0, 10);
}

export function validateDateRange(
  start: string,
  end: string,
  academic: string,
): AppSettingsConflict | null {
  if (!start || !end || !academic) return 'INVALID_DATE_RANGE';
  const s = dayOnly(start);
  const e = dayOnly(end);
  const a = dayOnly(academic);
  if (e < s) return 'INVALID_DATE_RANGE';
  if (a < e) return 'INVALID_DATE_RANGE';
  return null;
}

export function validateCapacity(
  capacity: number,
): AppSettingsConflict | null {
  if (!Number.isFinite(capacity)) return 'CAPACITY_NOT_POSITIVE';
  if (capacity <= 0) return 'CAPACITY_NOT_POSITIVE';
  if (!Number.isInteger(capacity)) return 'CAPACITY_NOT_POSITIVE';
  return null;
}

export function validateNoDuplicateYear(
  year: number,
  gender: ApplicantSpecializationYear['genderType'],
  existingYears: readonly ApplicantSpecializationYear[],
  excludeId?: string,
): AppSettingsConflict | null {
  const collision = existingYears.find(
    (y) =>
      y.id !== excludeId &&
      y.graduationYear === year &&
      y.genderType === gender,
  );
  return collision ? 'DUPLICATE_YEAR' : null;
}

interface DateWindow {
  applicationStartDate: string;
  applicationEndDate: string;
  genderType: ApplicantSpecializationYear['genderType'];
}

export function validateNoOverlap(
  candidate: DateWindow,
  existingYears: readonly ApplicantSpecializationYear[],
  excludeId?: string,
): AppSettingsConflict | null {
  const cStart = dayOnly(candidate.applicationStartDate);
  const cEnd = dayOnly(candidate.applicationEndDate);
  if (!cStart || !cEnd) return null; // date-range validator will surface
  for (const y of existingYears) {
    if (y.id === excludeId) continue;
    if (y.genderType !== candidate.genderType) continue;
    const yStart = dayOnly(y.applicationStartDate);
    const yEnd = dayOnly(y.applicationEndDate);
    if (!yStart || !yEnd) continue;
    /* Half-open overlap: ranges [a, b] and [c, d] overlap iff a <= d
     * AND c <= b. */
    if (cStart <= yEnd && yStart <= cEnd) {
      return 'OVERLAPPING_PERIOD';
    }
  }
  return null;
}

export function validateYearRow(
  row: Omit<ApplicantSpecializationYear, 'id'>,
  siblingYears: readonly ApplicantSpecializationYear[],
  excludeId?: string,
): AppSettingsConflict | null {
  const cap = validateCapacity(row.capacity);
  if (cap) return cap;
  const dr = validateDateRange(
    row.applicationStartDate,
    row.applicationEndDate,
    row.academicYearStartDate,
  );
  if (dr) return dr;
  const dup = validateNoDuplicateYear(
    row.graduationYear,
    row.genderType,
    siblingYears,
    excludeId,
  );
  if (dup) return dup;
  const overlap = validateNoOverlap(
    {
      applicationStartDate: row.applicationStartDate,
      applicationEndDate: row.applicationEndDate,
      genderType: row.genderType,
    },
    siblingYears,
    excludeId,
  );
  if (overlap) return overlap;
  return null;
}
