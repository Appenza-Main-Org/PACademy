/**
 * Rule-overlap validation for application-settings rules.
 *
 * Two rules within the same applicant-category "overlap" when their
 * applicant scopes intersect — i.e. there exists at least one applicant
 * profile (gender × marital status × academic degree × school category
 * × graduation year × …) that satisfies both rules at the same time AND
 * their score / grade ranges intersect.
 *
 * An overlap means a submitted applicant would match more than one
 * rule, which the admission engine cannot disambiguate.
 *
 * Rules are checked against siblings under the same applicant-category
 * code only. Cross-category overlap is not a conflict — each category
 * runs its own admission filter.
 *
 * Cross-`excellenceMode` overlap is reported when the non-numeric
 * scopes intersect: the percentage axis and the categorical-grade axis
 * can both fire for the same applicant when the category exposes both
 * criteria, so two rules under different criteria but the same
 * scope still produce an ambiguous match.
 */

import type {
  LocalGeneralRuleRow,
  LocalThanawiRow,
  LocalUniversityRow,
  MaxScoreOperator,
  MinScoreOperator,
} from '../store/wizardSharedState';

/** Inclusive/exclusive numeric interval used for percentage-score and
 *  rank-based grade-band overlap math. `lowStrict` true means the lower
 *  bound is exclusive (operator `>`); `highStrict` true means the upper
 *  bound is exclusive (operator `<`). */
export interface NumericRange {
  low: number;
  lowStrict: boolean;
  high: number;
  highStrict: boolean;
}

export type OverlapReason =
  | 'SCORE_RANGE_OVERLAP'
  | 'GRADE_BAND_OVERLAP'
  | 'CONDITIONS_DUPLICATE';

export interface OverlapPair {
  aId: string;
  bId: string;
  reason: OverlapReason;
}

/* ── Range math ──────────────────────────────────────────────────── */

export function rangesOverlap(a: NumericRange, b: NumericRange): boolean {
  let low: number;
  let lowStrict: boolean;
  if (a.low > b.low) {
    low = a.low;
    lowStrict = a.lowStrict;
  } else if (b.low > a.low) {
    low = b.low;
    lowStrict = b.lowStrict;
  } else {
    low = a.low;
    lowStrict = a.lowStrict || b.lowStrict;
  }

  let high: number;
  let highStrict: boolean;
  if (a.high < b.high) {
    high = a.high;
    highStrict = a.highStrict;
  } else if (b.high < a.high) {
    high = b.high;
    highStrict = b.highStrict;
  } else {
    high = a.high;
    highStrict = a.highStrict || b.highStrict;
  }

  if (low > high) return false;
  if (low === high && (lowStrict || highStrict)) return false;
  return true;
}

export function toScoreRange(
  min: number | null,
  minOp: MinScoreOperator,
  max: number | null,
  maxOp: MaxScoreOperator,
): NumericRange | null {
  if (min === null || max === null) return null;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return {
    low: min,
    lowStrict: minOp === 'GREATER_THAN',
    high: max,
    highStrict: maxOp === 'LESS_THAN',
  };
}

/**
 * Build an inclusive rank-based range from a (minCode, maxCode) pair on a
 * tagdir rule. `gradeRank` maps each `academic-grades[code]` to its
 * position in the lookup ordering — `0` is the best grade (e.g. امتياز)
 * and `N-1` is the worst (e.g. مقبول).
 *
 * On the rule, `minCode` is the *lower* eligibility bound (worse end) and
 * `maxCode` is the *upper* eligibility bound (better end). In rank space
 * the accepted band runs `[rank(maxCode), rank(minCode)]` (lower index =
 * better grade).
 */
export function toGradeBandRange(
  minCode: string,
  maxCode: string,
  gradeRank: ReadonlyMap<string, number>,
): NumericRange | null {
  if (!minCode || !maxCode) return null;
  const minRank = gradeRank.get(minCode);
  const maxRank = gradeRank.get(maxCode);
  if (minRank === undefined || maxRank === undefined) return null;
  const low = Math.min(minRank, maxRank);
  const high = Math.max(minRank, maxRank);
  return { low, lowStrict: false, high, highStrict: false };
}

/* ── Set helpers ──────────────────────────────────────────────────── */

/** True iff the two non-empty sets share any element. Empty inputs are
 *  treated as a non-match — the form gates required multi-value fields
 *  to be non-empty at submit time, so empty here means the row is still
 *  a draft and shouldn't trigger overlap detection. */
function intersectsArr<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  for (const x of a) if (b.includes(x)) return true;
  return false;
}

/* ── Scope checks (the non-numeric "any conditions") ─────────────── */

/** Two university rows share applicant scope when the faculty +
 *  specialization match AND every multi-value condition has at least
 *  one shared value. */
function universityScopesIntersect(
  a: LocalUniversityRow,
  b: LocalUniversityRow,
): boolean {
  if (a.facultyCode !== b.facultyCode) return false;
  if (a.specializationCode !== b.specializationCode) return false;
  if (!intersectsArr(a.type, b.type)) return false;
  if (!intersectsArr(a.maritalStatus, b.maritalStatus)) return false;
  if (!intersectsArr(a.academicDegrees, b.academicDegrees)) return false;
  if (!intersectsArr(a.committees, b.committees)) return false;
  if (!intersectsArr(a.graduationYears, b.graduationYears)) return false;
  return true;
}

function thanawiScopesIntersect(
  a: LocalThanawiRow,
  b: LocalThanawiRow,
): boolean {
  if (a.examRound !== b.examRound) return false;
  /* Committee is the assignment target, not an applicant discriminator.
   * Matching academic conditions across different committees would make
   * the same applicant eligible for multiple committees. */
  if (a.graduationYear === null || b.graduationYear === null) return false;
  if (a.graduationYear !== b.graduationYear) return false;
  if (!intersectsArr(a.schoolCategories, b.schoolCategories)) return false;
  if (!intersectsArr(a.maritalStatus, b.maritalStatus)) return false;
  return true;
}

/* ── Numeric-range pair check (mode-aware) ───────────────────────── */

interface NumericPairResult {
  /** `null` when either rule is missing the numeric bounds it needs to
   *  participate in the check (e.g. a tagdir rule under GRADES mode). */
  overlap: boolean | null;
  reason: 'SCORE_RANGE_OVERLAP' | 'GRADE_BAND_OVERLAP';
}

function checkNumericPair(
  a: LocalGeneralRuleRow,
  b: LocalGeneralRuleRow,
  gradeRank: ReadonlyMap<string, number>,
): NumericPairResult {
  /* Same mode → straight numeric/rank overlap on the appropriate axis. */
  if (a.excellenceMode === b.excellenceMode) {
    if (a.excellenceMode === 'GRADES') {
      const ra = toScoreRange(
        a.scoreMin,
        a.minScoreOperator,
        a.scoreMax,
        a.maxScoreOperator,
      );
      const rb = toScoreRange(
        b.scoreMin,
        b.minScoreOperator,
        b.scoreMax,
        b.maxScoreOperator,
      );
      if (!ra || !rb) return { overlap: null, reason: 'SCORE_RANGE_OVERLAP' };
      return {
        overlap: rangesOverlap(ra, rb),
        reason: 'SCORE_RANGE_OVERLAP',
      };
    }
    const ga = toGradeBandRange(a.grade, a.gradeMax, gradeRank);
    const gb = toGradeBandRange(b.grade, b.gradeMax, gradeRank);
    if (!ga || !gb) return { overlap: null, reason: 'GRADE_BAND_OVERLAP' };
    return {
      overlap: rangesOverlap(ga, gb),
      reason: 'GRADE_BAND_OVERLAP',
    };
  }
  /* Cross-mode under the same scope is itself an ambiguous match — the
   *  admission engine cannot tell which axis to score the applicant on.
   *  Surface as a CONDITIONS_DUPLICATE so the UI banner names it as a
   *  duplicate condition rather than a numeric overlap. */
  return { overlap: true, reason: 'GRADE_BAND_OVERLAP' };
}

/* ── Top-level overlap detection ─────────────────────────────────── */

/** Return every overlap pair under the given applicant-category. The
 *  return list is symmetric-free — each unordered pair appears once. */
export function findUniversityOverlaps(
  rows: readonly LocalUniversityRow[],
  gradeRank: ReadonlyMap<string, number>,
): OverlapPair[] {
  const out: OverlapPair[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = rows[i];
      const b = rows[j];
      if (a.categoryCode !== b.categoryCode) continue;
      if (!universityScopesIntersect(a, b)) continue;
      const numeric = checkNumericPair(a, b, gradeRank);
      if (numeric.overlap === true) {
        out.push({ aId: a.id, bId: b.id, reason: numeric.reason });
      } else if (numeric.overlap === null) {
        /* Both rows authored without numeric bounds — the scopes still
         *  fully overlap, so the rules duplicate at the condition level. */
        out.push({ aId: a.id, bId: b.id, reason: 'CONDITIONS_DUPLICATE' });
      }
    }
  }
  return out;
}

export function findThanawiOverlaps(
  rows: readonly LocalThanawiRow[],
  gradeRank: ReadonlyMap<string, number>,
): OverlapPair[] {
  const out: OverlapPair[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = rows[i];
      const b = rows[j];
      if (a.categoryCode !== b.categoryCode) continue;
      if (!thanawiScopesIntersect(a, b)) continue;
      const numeric = checkNumericPair(a, b, gradeRank);
      if (numeric.overlap === true) {
        out.push({ aId: a.id, bId: b.id, reason: numeric.reason });
      } else if (numeric.overlap === null) {
        out.push({ aId: a.id, bId: b.id, reason: 'CONDITIONS_DUPLICATE' });
      }
    }
  }
  return out;
}

/** Build a quick "row id → overlap reasons" map for the grid badges.
 *  A row may overlap with more than one sibling; we union the reasons. */
export function overlapsByRowId(
  pairs: readonly OverlapPair[],
): Map<string, Set<OverlapReason>> {
  const map = new Map<string, Set<OverlapReason>>();
  for (const pair of pairs) {
    let aSet = map.get(pair.aId);
    if (!aSet) {
      aSet = new Set();
      map.set(pair.aId, aSet);
    }
    aSet.add(pair.reason);
    let bSet = map.get(pair.bId);
    if (!bSet) {
      bSet = new Set();
      map.set(pair.bId, bSet);
    }
    bSet.add(pair.reason);
  }
  return map;
}

export const OVERLAP_REASON_LABEL_AR: Record<OverlapReason, string> = {
  SCORE_RANGE_OVERLAP: 'تداخل في نطاق الدرجة',
  GRADE_BAND_OVERLAP: 'تداخل في نطاق التقدير',
  CONDITIONS_DUPLICATE: 'تكرار في الشروط',
};

/** Check whether `candidate` would overlap any of the supplied
 *  siblings. Returns the matching siblings (with their overlap reason)
 *  so the caller can name them in a toast/banner. Used by the form
 *  submit gate to block the add/update before it reaches the store. */
export function findCandidateUniversityOverlaps(
  candidate: LocalUniversityRow,
  siblings: readonly LocalUniversityRow[],
  gradeRank: ReadonlyMap<string, number>,
): { row: LocalUniversityRow; reason: OverlapReason }[] {
  const out: { row: LocalUniversityRow; reason: OverlapReason }[] = [];
  for (const sib of siblings) {
    if (sib.id === candidate.id) continue;
    if (sib.categoryCode !== candidate.categoryCode) continue;
    if (!universityScopesIntersect(candidate, sib)) continue;
    const numeric = checkNumericPair(candidate, sib, gradeRank);
    if (numeric.overlap === true) {
      out.push({ row: sib, reason: numeric.reason });
    } else if (numeric.overlap === null) {
      out.push({ row: sib, reason: 'CONDITIONS_DUPLICATE' });
    }
  }
  return out;
}

export function findCandidateThanawiOverlaps(
  candidate: LocalThanawiRow,
  siblings: readonly LocalThanawiRow[],
  gradeRank: ReadonlyMap<string, number>,
): { row: LocalThanawiRow; reason: OverlapReason }[] {
  const out: { row: LocalThanawiRow; reason: OverlapReason }[] = [];
  for (const sib of siblings) {
    if (sib.id === candidate.id) continue;
    if (sib.categoryCode !== candidate.categoryCode) continue;
    if (!thanawiScopesIntersect(candidate, sib)) continue;
    const numeric = checkNumericPair(candidate, sib, gradeRank);
    if (numeric.overlap === true) {
      out.push({ row: sib, reason: numeric.reason });
    } else if (numeric.overlap === null) {
      out.push({ row: sib, reason: 'CONDITIONS_DUPLICATE' });
    }
  }
  return out;
}
