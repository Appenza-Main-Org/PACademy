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

function isLiveGradeRow(row: GradeRow): boolean {
  if (row.deletedAt != null && String(row.deletedAt).trim().length > 0) return false;
  if (row.isDeleted == null) return true;
  if (typeof row.isDeleted === 'boolean') return !row.isDeleted;
  return row.isDeleted.trim().toLowerCase() !== 'true';
}

/** Build per-row diff for every incoming row whose NID already exists.
 *  Rows that don't match an existing record are excluded so the diff
 *  view only renders the ones requiring a decision. */
export function buildExistingDiffs(
  rows: readonly NormalisedRow[],
  existing: readonly GradeRow[],
): ExistingDiff[] {
  const existingByNid = new Map(existing.filter(isLiveGradeRow).map((r) => [r.nid, r]));
  const out: ExistingDiff[] = [];
  for (const r of rows) {
    if (!r.nationalId) continue;
    const ex = existingByNid.get(r.nationalId);
    if (!ex) continue;

    /* Surface only the grade-shape fields (المجموع الكلي + الدرجة
     * العظمى). Other field comparisons (gender / school / region / …)
     * frequently show up as "phantom" diffs because the existing record
     * stores codes (e.g. `male`, `SCH-07`) while the import normalises
     * to Arabic display labels — review wise that's noise, so they're
     * intentionally excluded from the per-row diff view. Commit logic
     * still writes whatever the incoming row carries; this list only
     * controls what the admin reviews. */
    const cells: DiffCell[] = [
      {
        field: 'graduationYear',
        labelAr: DIFF_FIELD_LABELS.graduationYear,
        oldValue: ex.graduationYear,
        newValue: r.graduationYear,
        changed: !normalisedEquals(ex.graduationYear, r.graduationYear),
      },
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

/** Rows whose `nationalId` is already in the database AND whose
 *  `graduationYear` matches the existing row's stored year exactly.
 *  These are the "this sheet was already imported" cases — they need
 *  to be surfaced as an informational count so admins know the upload
 *  is partially (or fully) a no-op, then silently skipped during
 *  commit (never written, never counted as failed). The match key is
 *  intentionally `NID + graduationYear`: the same student from the
 *  same cohort is one record. A re-applicant from a different
 *  graduation year lands in `buildExistingDiffs` and requires an
 *  admin decision (graduation year shows up as a changed cell there). */
export interface AlreadyImportedRow {
  nationalId: string;
  nameAr: string;
  graduationYear: number;
  sourceRowIndex: number;
}

export function buildAlreadyImported(
  rows: readonly NormalisedRow[],
  existing: readonly GradeRow[],
): AlreadyImportedRow[] {
  const existingByNid = new Map(existing.filter(isLiveGradeRow).map((r) => [r.nid, r]));
  const out: AlreadyImportedRow[] = [];
  for (const r of rows) {
    if (!r.nationalId) continue;
    if (r.graduationYear == null || !Number.isFinite(r.graduationYear)) continue;
    const ex = existingByNid.get(r.nationalId);
    if (!ex) continue;
    if (ex.graduationYear == null) continue;
    if (ex.graduationYear !== r.graduationYear) continue;
    out.push({
      nationalId: r.nationalId,
      nameAr: r.nameAr ?? ex.name,
      graduationYear: r.graduationYear,
      sourceRowIndex: r.sourceRowIndex,
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
