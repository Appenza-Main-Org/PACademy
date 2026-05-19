/**
 * Diff helpers for the import wizard's new Step 6 (مراجعة التغييرات).
 *
 * The wizard needs to surface two distinct conflict shapes before
 * committing — both are computed here so the step component stays
 * presentational:
 *
 *   1. Existing-record diffs — incoming rows whose nationalId is
 *      already in the database. For each one, we emit a per-field old
 *      vs. new payload so the admin can decide whether to overwrite.
 *
 *   2. Upload duplicates — the same nationalId appearing twice (or
 *      more) inside the uploaded file, each with a different
 *      `totalGrade`. The wizard's default is "accept the higher" but
 *      the admin can pick / reject explicitly.
 *
 * Both helpers are pure functions over `NormalisedRow[]` + the current
 * `GradeRow[]` STATE so they can be unit-tested in isolation.
 */

import type { GradeRow, NormalisedRow } from '../types';

export type DiffField =
  | 'totalGrade'
  | 'maxGrade'
  | 'graduationYear'
  | 'track'
  | 'gender'
  | 'schoolCategory'
  | 'schoolName'
  | 'regionName'
  | 'examRound'
  | 'seatingNumber';

export interface DiffCell<T = string | number | null> {
  field: DiffField;
  labelAr: string;
  oldValue: T;
  newValue: T;
  /** True when `oldValue !== newValue` (after light normalisation). */
  changed: boolean;
}

export interface ExistingDiff {
  nationalId: string;
  nameAr: string;
  existing: GradeRow;
  incoming: NormalisedRow;
  /** Per-field comparison, ordered for display. Only entries where
   *  `changed === true` are surfaced in the diff UI; the rest are
   *  reference values that confirm "no change" for that field. */
  cells: DiffCell[];
  /** True when at least one cell shifted — the only rows that need an
   *  admin decision. Rows with no shifts pass through the wizard
   *  silently. */
  hasChanges: boolean;
}

export interface UploadDuplicate {
  nationalId: string;
  /** Latest non-null `nameAr` seen across the duplicate rows. */
  nameAr: string | null;
  /** All rows in the upload that share this NID. */
  rows: NormalisedRow[];
  /** Distinct `totalGrade` values across the duplicate rows. */
  distinctTotals: number[];
  /** True when at least two distinct non-null totals appear. */
  hasTotalConflict: boolean;
}

const DIFF_FIELD_LABELS: Record<DiffField, string> = {
  totalGrade: 'المجموع الكلي',
  maxGrade: 'الدرجة العظمى',
  graduationYear: 'سنة التخرج',
  track: 'الشعبة',
  gender: 'النوع',
  schoolCategory: 'فئة المدرسة',
  schoolName: 'اسم المدرسة',
  regionName: 'المنطقة',
  examRound: 'الدور',
  seatingNumber: 'رقم الجلوس',
};

function normalisedEquals(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  return String(a).trim() === String(b).trim();
}

/** Build per-row diff for every incoming row whose NID already exists.
 *  Rows that don't match an existing record are excluded so the diff
 *  view only renders the ones requiring a decision. */
export function buildExistingDiffs(
  rows: readonly NormalisedRow[],
  existing: readonly GradeRow[],
): ExistingDiff[] {
  const existingByNid = new Map(existing.map((r) => [r.nid, r]));
  const out: ExistingDiff[] = [];
  for (const r of rows) {
    if (!r.nationalId) continue;
    const ex = existingByNid.get(r.nationalId);
    if (!ex) continue;

    const cells: DiffCell[] = [
      {
        field: 'totalGrade',
        labelAr: DIFF_FIELD_LABELS.totalGrade,
        oldValue: ex.total,
        newValue: r.totalGrade,
        changed: !normalisedEquals(ex.total, r.totalGrade),
      },
      {
        field: 'maxGrade',
        labelAr: DIFF_FIELD_LABELS.maxGrade,
        oldValue: ex.importMax,
        newValue: r.maxGrade,
        changed: r.maxGrade != null && !normalisedEquals(ex.importMax, r.maxGrade),
      },
      {
        field: 'graduationYear',
        labelAr: DIFF_FIELD_LABELS.graduationYear,
        oldValue: ex.graduationYear,
        newValue: r.graduationYear,
        changed: !normalisedEquals(ex.graduationYear, r.graduationYear),
      },
      {
        field: 'track',
        labelAr: DIFF_FIELD_LABELS.track,
        oldValue: ex.branch,
        newValue: r.track,
        changed: !normalisedEquals(ex.branch, r.track),
      },
      {
        field: 'gender',
        labelAr: DIFF_FIELD_LABELS.gender,
        oldValue: ex.gender,
        newValue: r.gender,
        changed: r.gender != null && !normalisedEquals(ex.gender, r.gender),
      },
      {
        field: 'schoolCategory',
        labelAr: DIFF_FIELD_LABELS.schoolCategory,
        oldValue: ex.schoolCategoryCode,
        newValue: r.schoolCategory,
        changed: r.schoolCategory != null && !normalisedEquals(ex.schoolCategoryCode, r.schoolCategory),
      },
      {
        field: 'schoolName',
        labelAr: DIFF_FIELD_LABELS.schoolName,
        oldValue: ex.school,
        newValue: r.schoolName,
        changed: r.schoolName != null && !normalisedEquals(ex.school, r.schoolName),
      },
      {
        field: 'regionName',
        labelAr: DIFF_FIELD_LABELS.regionName,
        oldValue: ex.region,
        newValue: r.regionName,
        changed: r.regionName != null && !normalisedEquals(ex.region, r.regionName),
      },
      {
        field: 'examRound',
        labelAr: DIFF_FIELD_LABELS.examRound,
        oldValue: ex.examRound,
        newValue: r.examRound,
        changed: r.examRound != null && !normalisedEquals(ex.examRound, r.examRound),
      },
      {
        field: 'seatingNumber',
        labelAr: DIFF_FIELD_LABELS.seatingNumber,
        oldValue: ex.seatingNumber,
        newValue: r.seatingNumber,
        changed: r.seatingNumber != null && !normalisedEquals(ex.seatingNumber, r.seatingNumber),
      },
    ];

    const hasChanges = cells.some((c) => c.changed);
    out.push({
      nationalId: r.nationalId,
      nameAr: r.nameAr ?? ex.name,
      existing: ex,
      incoming: r,
      cells,
      hasChanges,
    });
  }
  return out;
}

/** Group upload rows by national-id and flag the cases where the same
 *  NID appears with two different `totalGrade` values. */
export function buildUploadDuplicates(
  rows: readonly NormalisedRow[],
): UploadDuplicate[] {
  const groups = new Map<string, NormalisedRow[]>();
  for (const r of rows) {
    if (!r.nationalId) continue;
    const bucket = groups.get(r.nationalId);
    if (bucket) bucket.push(r);
    else groups.set(r.nationalId, [r]);
  }

  const out: UploadDuplicate[] = [];
  for (const [nid, group] of groups) {
    if (group.length < 2) continue;
    const totals = group
      .map((r) => r.totalGrade)
      .filter((t): t is number => t != null && Number.isFinite(t));
    const distinct = Array.from(new Set(totals));
    const nameAr = group.map((r) => r.nameAr).find((n) => n != null) ?? null;
    out.push({
      nationalId: nid,
      nameAr,
      rows: group,
      distinctTotals: distinct,
      hasTotalConflict: distinct.length > 1,
    });
  }
  return out;
}
