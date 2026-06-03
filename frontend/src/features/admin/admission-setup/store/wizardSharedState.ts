/**
 * Admission-Setup wizard — cross-step shared state.
 *
 * Scoped to the application-settings → committees flow that spans two
 * wizard steps:
 *
 *   1. `application_settings` collects per-category rule rows in a
 *      `local` bucket while the admin edits the section form for any
 *      applicant-category.
 *   2. The «اعتماد» button at the bottom of each section moves rows
 *      from `local` into `approved` and clears the `local` bucket.
 *   3. `committees` reads `approved` to render the «عرض» tab.
 *
 * The shape covers two category families:
 *
 *   • University (`type === 'university'`) — admins build rules per
 *     (faculty, specialization) tuple. Header dates + marital status
 *     are captured once per section and stamped onto every row at
 *     approval time so the «عرض» grid renders a flat row shape.
 *
 *   • Pre-University / ثانوي (`type === 'pre_university'`) — admins
 *     build rules per (examRound, committee, graduationYear,
 *     schoolCategory) tuple. The same header (dates + marital status)
 *     applies.
 *
 * Backward compatibility: the existing committees-step viewer
 * (`ApprovedRulesView`) reads array-valued fields (`committees`,
 * `academicDegrees`, `graduationYears`) — the new single-select form
 * fields still serialise as 1-element arrays on the row so the viewer
 * keeps working unchanged.
 */

import { create } from 'zustand';
import type { ExcellenceMode } from '../lib/excellenceMode';

/** Shared header captured at the top of an applicant-category section.
 *
 *  `maritalStatus` was previously per-rule; moved here per the V2 brief
 *  so the same value applies to every rule the admin adds under this
 *  section. */
export interface GeneralRulesHeader {
  /** ISO yyyy-MM-dd or empty string. */
  applicationStart: string;
  applicationEnd: string;
  ageReferenceDate: string;
  graduationYears: number[];
  /** Marital-status codes — multi-select. Empty array = none picked
   *  yet (form blocks «إضافة» until at least one is chosen). */
  maritalStatus: string[];
  /** Category-level upper age bound («الحد الأقصى للسن») in years.
   *  Distinct from the per-year-row `maxAge` on
   *  `ApplicantSpecializationYear` — this one is a section-wide
   *  envelope on the general-conditions block. Positive integer only;
   *  `null` means «not set». */
  maxAge: number | null;
}

/** Comparison operator on the lower percentage-score bound.
 *  `GREATER_THAN_OR_EQUAL` is the inclusive default (legacy behaviour);
 *  `GREATER_THAN` becomes a strict lower bound. */
export type MinScoreOperator = 'GREATER_THAN_OR_EQUAL' | 'GREATER_THAN';

/** Comparison operator on the upper percentage-score bound.
 *  `LESS_THAN_OR_EQUAL` is the inclusive default (legacy behaviour);
 *  `LESS_THAN` becomes a strict upper bound. */
export type MaxScoreOperator = 'LESS_THAN_OR_EQUAL' | 'LESS_THAN';

/** Inclusive-bound default for the lower percentage score. */
export const DEFAULT_MIN_SCORE_OPERATOR: MinScoreOperator = 'GREATER_THAN_OR_EQUAL';
/** Inclusive-bound default for the upper percentage score. */
export const DEFAULT_MAX_SCORE_OPERATOR: MaxScoreOperator = 'LESS_THAN_OR_EQUAL';

/** A single editable row inside one university-category section's form. */
export interface GeneralRuleRowInput {
  /** Per-condition «معيار التمييز». Defaults from the parent category
   *  but remains editable on each شروط اللجنة row. */
  excellenceMode: ExcellenceMode;
  /** Genders accepted by this rule. Empty array means "any". */
  type: string[];
  /** Minimum acceptable academic grade — single code (الحد الأدنى). */
  grade: string;
  /** Maximum acceptable academic grade — single code (الحد الأقصى). */
  gradeMax: string;
  /** Inclusive minimum percentage score (الحد الأدنى للدرجة). 0–100. */
  scoreMin: number | null;
  /** Comparison operator paired with `scoreMin` — controls whether the
   *  lower bound is inclusive (`≥`) or strict (`>`). */
  minScoreOperator: MinScoreOperator;
  /** Inclusive maximum percentage score (الحد الأقصى للدرجة). 0–100. */
  scoreMax: number | null;
  /** Comparison operator paired with `scoreMax` — controls whether the
   *  upper bound is inclusive (`≤`) or strict (`<`). */
  maxScoreOperator: MaxScoreOperator;
  /** Academic degrees — multi-select (الدرجة العلمية). */
  academicDegrees: string[];
  /** Committee — single id (اللجنة). */
  committee: string;
  /** Graduation year — single year (سنة التخرج). */
  graduationYear: number | null;
}

/** A single editable row inside one pre-university (ثانوي) section's form. */
export interface ThanawiRuleRowInput {
  /** Per-condition «معيار التمييز». Defaults from the parent category
   *  but remains editable on each شروط اللجنة row. */
  excellenceMode: ExcellenceMode;
  /** Exam-round lookup code (الدور). */
  examRound: string;
  /** Committee id, scoped to this applicant-category. */
  committee: string;
  /** Graduation year — single year. */
  graduationYear: number | null;
  /** School-category lookup codes (فئة المدرسة). Persisted as an array
   *  for backward compatibility with `ApprovedRulesView`, but the UI now
   *  binds a single-select that emits a 0- or 1-element array. */
  schoolCategories: string[];
  /** Minimum acceptable academic grade — single code (الحد الأدنى).
   *  Only filled when the parent category's «معيار التمييز» is TAGDIR;
   *  blank under the GRADES branch. */
  grade: string;
  /** Maximum acceptable academic grade — single code (الحد الأقصى).
   *  Mirrors `grade`'s applicability rule. */
  gradeMax: string;
  /** Inclusive minimum percentage score (الحد الأدنى للدرجة). 0–100. */
  scoreMin: number | null;
  /** Comparison operator paired with `scoreMin` — controls whether the
   *  lower bound is inclusive (`≥`) or strict (`>`). */
  minScoreOperator: MinScoreOperator;
  /** Inclusive maximum percentage score (الحد الأقصى للدرجة). 0–100. */
  scoreMax: number | null;
  /** Comparison operator paired with `scoreMax` — controls whether the
   *  upper bound is inclusive (`≤`) or strict (`<`). */
  maxScoreOperator: MaxScoreOperator;
}

/** Faculty + specialization context attached at the call site of
 *  `addLocalRow`. Lives outside the input shape so the form's draft
 *  state stays minimal. */
export interface SpecKey {
  facultyCode: string;
  facultyNameAr: string;
  specializationCode: string;
  specializationNameAr: string;
}

/** Row in the local (un-approved) bucket. Discriminated by `kind` so
 *  university and thanawi rows can coexist in one list without
 *  spreading conditional logic across consumers. */
export type LocalGeneralRuleRow = LocalUniversityRow | LocalThanawiRow;

interface LocalRowBase {
  id: string;
  /** ISO timestamp captured when the condition is first authored. */
  createdAt?: string;
  /** FK to the applicant-category lookup row (e.g. `law_bachelor`). */
  categoryCode: string;
  /** Snapshot of the header at row-creation time. */
  header: GeneralRulesHeader;
}

export interface LocalUniversityRow extends LocalRowBase {
  kind: 'university';
  facultyCode: string;
  facultyNameAr: string;
  specializationCode: string;
  specializationNameAr: string;
  type: string[];
  /** Marital status mirrored from header at row-add time so historical
   *  rows are preserved if the admin later edits the header. */
  maritalStatus: string[];
  excellenceMode: ExcellenceMode;
  grade: string;
  gradeMax: string;
  scoreMin: number | null;
  minScoreOperator: MinScoreOperator;
  scoreMax: number | null;
  maxScoreOperator: MaxScoreOperator;
  /** 1-element array — preserves the legacy ApprovedRulesView shape. */
  academicDegrees: string[];
  committees: string[];
  graduationYears: number[];
}

export interface LocalThanawiRow extends LocalRowBase {
  kind: 'thanawi';
  excellenceMode: ExcellenceMode;
  examRound: string;
  committee: string;
  graduationYear: number | null;
  /** Multi-select fan-out per row (فئة المدرسة). */
  schoolCategories: string[];
  /** Inclusive percentage bounds for the score range (الحد الأدنى/الأقصى للدرجة). */
  scoreMin: number | null;
  minScoreOperator: MinScoreOperator;
  scoreMax: number | null;
  maxScoreOperator: MaxScoreOperator;
  /** Min/max academic grade (التقدير). Filled only when the parent
   *  category's «معيار التمييز» is TAGDIR; blank under GRADES. */
  grade: string;
  gradeMax: string;
  /* Legacy shape so ApprovedRulesView renders thanawi rows alongside
   * university rows in the same table without crashes. Empty arrays
   * render as «—» in the viewer. */
  type: string[];
  maritalStatus: string[];
  academicDegrees: string[];
  committees: string[];
  graduationYears: number[];
  facultyCode: '';
  facultyNameAr: '';
  specializationCode: '';
  specializationNameAr: '';
}

/** Row in the approved bucket — header context stamped on. Identical
 *  in shape to a local row; the `header` field is already present on
 *  the local row so promotion is a straight reference copy. */
export type ApprovedGeneralRuleRow = LocalGeneralRuleRow;

interface WizardSharedState {
  /** Headers are keyed by applicant-category code so each section
   *  (officers_general, law_bachelor, …) keeps its own dates +
   *  marital-status picks. */
  headers: Record<string, GeneralRulesHeader>;
  local: LocalGeneralRuleRow[];
  approved: ApprovedGeneralRuleRow[];
  /** Row currently in edit mode across the wizard. `null` means every
   *  section form is in «add» mode. Single-edit across the wizard so
   *  switching focus to another row cleanly cancels the prior edit. */
  editingRowId: string | null;
}

interface WizardSharedActions {
  getHeader: (categoryCode: string) => GeneralRulesHeader;
  setHeaderField: <K extends keyof GeneralRulesHeader>(
    categoryCode: string,
    field: K,
    value: GeneralRulesHeader[K],
  ) => void;
  addUniversityRow: (
    categoryCode: string,
    spec: SpecKey,
    input: GeneralRuleRowInput,
  ) => { ok: true } | { ok: false; reason: 'duplicate' };
  addThanawiRow: (
    categoryCode: string,
    input: ThanawiRuleRowInput,
  ) => { ok: true } | { ok: false; reason: 'duplicate' };
  updateUniversityRow: (
    id: string,
    spec: SpecKey,
    input: GeneralRuleRowInput,
  ) => { ok: true } | { ok: false; reason: 'duplicate' | 'not-found' };
  updateThanawiRow: (
    id: string,
    input: ThanawiRuleRowInput,
  ) => { ok: true } | { ok: false; reason: 'duplicate' | 'not-found' };
  removeLocalRow: (id: string) => void;
  removeApprovedRow: (id: string) => void;
  approveLocalForCategory: (categoryCode: string) => number;
  setEditingRow: (id: string) => void;
  clearEditingRow: () => void;
}

type Store = WizardSharedState & WizardSharedActions;

export const INITIAL_HEADER: GeneralRulesHeader = {
  applicationStart: '',
  applicationEnd: '',
  ageReferenceDate: '',
  graduationYears: [],
  maritalStatus: [],
  maxAge: null,
};

/** Stable row id. `crypto.randomUUID` is available in every supported
 *  browser and in Node 19+; the small fallback keeps the demo working
 *  in older preview environments without changing the call-site. */
function nextRowId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `gr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function createdTime(row: LocalGeneralRuleRow): number | null {
  if (!row.createdAt) return null;
  const time = Date.parse(row.createdAt);
  return Number.isFinite(time) ? time : null;
}

export function sortGeneralRuleRowsNewestFirst<T extends LocalGeneralRuleRow>(
  rows: readonly T[],
): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const aTime = createdTime(a.row);
      const bTime = createdTime(b.row);
      if (aTime !== null && bTime !== null && aTime !== bTime) {
        return bTime - aTime;
      }
      if (aTime !== null && bTime === null) return -1;
      if (aTime === null && bTime !== null) return 1;
      return b.index - a.index;
    })
    .map(({ row }) => row);
}

/** Composite key for university rows — duplicates are blocked at the
 *  call site by comparing this against existing local + approved
 *  rows under the same category. */
function universityCompositeKey(r: LocalUniversityRow): string {
  return [
    r.categoryCode,
    r.facultyCode,
    r.specializationCode,
    r.excellenceMode,
    [...r.type].sort().join('|'),
    r.grade,
    r.gradeMax,
    String(r.scoreMin),
    r.minScoreOperator,
    String(r.scoreMax),
    r.maxScoreOperator,
    [...r.academicDegrees].sort().join('|'),
    [...r.committees].sort().join('|'),
    [...r.graduationYears].sort().join('|'),
  ].join('::');
}

function thanawiCompositeKey(r: LocalThanawiRow): string {
  return [
    r.categoryCode,
    r.excellenceMode,
    r.examRound,
    r.committee,
    String(r.graduationYear),
    [...r.schoolCategories].sort().join('|'),
    r.grade,
    r.gradeMax,
    String(r.scoreMin),
    r.minScoreOperator,
    String(r.scoreMax),
    r.maxScoreOperator,
  ].join('::');
}

function buildUniversityRow(
  categoryCode: string,
  spec: SpecKey,
  input: GeneralRuleRowInput,
  header: GeneralRulesHeader,
): LocalUniversityRow {
  return {
    id: nextRowId(),
    createdAt: nowIso(),
    kind: 'university',
    categoryCode,
    header,
    facultyCode: spec.facultyCode,
    facultyNameAr: spec.facultyNameAr,
    specializationCode: spec.specializationCode,
    specializationNameAr: spec.specializationNameAr,
    type: input.type,
    maritalStatus: header.maritalStatus,
    excellenceMode: input.excellenceMode,
    grade: input.grade,
    gradeMax: input.gradeMax,
    scoreMin: input.scoreMin,
    minScoreOperator: input.minScoreOperator,
    scoreMax: input.scoreMax,
    maxScoreOperator: input.maxScoreOperator,
    academicDegrees: [...input.academicDegrees],
    committees: input.committee ? [input.committee] : [],
    graduationYears: input.graduationYear !== null ? [input.graduationYear] : [],
  };
}

function buildThanawiRow(
  categoryCode: string,
  input: ThanawiRuleRowInput,
  header: GeneralRulesHeader,
): LocalThanawiRow {
  return {
    id: nextRowId(),
    createdAt: nowIso(),
    kind: 'thanawi',
    categoryCode,
    header,
    excellenceMode: input.excellenceMode,
    examRound: input.examRound,
    committee: input.committee,
    graduationYear: input.graduationYear,
    schoolCategories: [...input.schoolCategories],
    grade: input.grade,
    gradeMax: input.gradeMax,
    scoreMin: input.scoreMin,
    minScoreOperator: input.minScoreOperator,
    scoreMax: input.scoreMax,
    maxScoreOperator: input.maxScoreOperator,
    type: [],
    maritalStatus: header.maritalStatus,
    academicDegrees: [],
    committees: input.committee ? [input.committee] : [],
    graduationYears: input.graduationYear !== null ? [input.graduationYear] : [],
    facultyCode: '',
    facultyNameAr: '',
    specializationCode: '',
    specializationNameAr: '',
  };
}

export const useAdmissionSetupWizardStore = create<Store>((set, get) => ({
  headers: {},
  local: [],
  approved: [],
  editingRowId: null,

  getHeader: (categoryCode) => {
    const state = get();
    return state.headers[categoryCode] ?? INITIAL_HEADER;
  },

  setHeaderField: (categoryCode, field, value) =>
    set((s) => {
      const current = s.headers[categoryCode] ?? INITIAL_HEADER;
      return {
        headers: {
          ...s.headers,
          [categoryCode]: { ...current, [field]: value },
        },
      };
    }),

  addUniversityRow: (categoryCode, spec, input) => {
    const state = get();
    const header = state.headers[categoryCode] ?? INITIAL_HEADER;
    const candidate = buildUniversityRow(categoryCode, spec, input, header);
    const key = universityCompositeKey(candidate);
    const collision =
      state.local.some(
        (r) =>
          r.kind === 'university' &&
          r.categoryCode === categoryCode &&
          universityCompositeKey(r) === key,
      ) ||
      state.approved.some(
        (r) =>
          r.kind === 'university' &&
          r.categoryCode === categoryCode &&
          universityCompositeKey(r) === key,
      );
    if (collision) return { ok: false, reason: 'duplicate' };
    set((s) => ({ local: [...s.local, candidate] }));
    return { ok: true };
  },

  addThanawiRow: (categoryCode, input) => {
    const state = get();
    const header = state.headers[categoryCode] ?? INITIAL_HEADER;
    const candidate = buildThanawiRow(categoryCode, input, header);
    const key = thanawiCompositeKey(candidate);
    const collision =
      state.local.some(
        (r) =>
          r.kind === 'thanawi' &&
          r.categoryCode === categoryCode &&
          thanawiCompositeKey(r) === key,
      ) ||
      state.approved.some(
        (r) =>
          r.kind === 'thanawi' &&
          r.categoryCode === categoryCode &&
          thanawiCompositeKey(r) === key,
      );
    if (collision) return { ok: false, reason: 'duplicate' };
    set((s) => ({ local: [...s.local, candidate] }));
    return { ok: true };
  },

  updateUniversityRow: (id, spec, input) => {
    const state = get();
    const existing =
      state.local.find((r) => r.id === id) ??
      state.approved.find((r) => r.id === id);
    if (!existing || existing.kind !== 'university') {
      return { ok: false, reason: 'not-found' };
    }
    const candidate: LocalUniversityRow = {
      ...buildUniversityRow(existing.categoryCode, spec, input, existing.header),
      id,
      createdAt: existing.createdAt,
    };
    const key = universityCompositeKey(candidate);
    const collision =
      state.local.some(
        (r) =>
          r.id !== id &&
          r.kind === 'university' &&
          r.categoryCode === existing.categoryCode &&
          universityCompositeKey(r) === key,
      ) ||
      state.approved.some(
        (r) =>
          r.id !== id &&
          r.kind === 'university' &&
          r.categoryCode === existing.categoryCode &&
          universityCompositeKey(r) === key,
      );
    if (collision) return { ok: false, reason: 'duplicate' };
    set((s) => ({
      local: s.local.map((r) => (r.id === id ? candidate : r)),
      approved: s.approved.map((r) => (r.id === id ? candidate : r)),
      editingRowId: null,
    }));
    return { ok: true };
  },

  updateThanawiRow: (id, input) => {
    const state = get();
    const existing =
      state.local.find((r) => r.id === id) ??
      state.approved.find((r) => r.id === id);
    if (!existing || existing.kind !== 'thanawi') {
      return { ok: false, reason: 'not-found' };
    }
    const candidate: LocalThanawiRow = {
      ...buildThanawiRow(existing.categoryCode, input, existing.header),
      id,
      createdAt: existing.createdAt,
    };
    const key = thanawiCompositeKey(candidate);
    const collision =
      state.local.some(
        (r) =>
          r.id !== id &&
          r.kind === 'thanawi' &&
          r.categoryCode === existing.categoryCode &&
          thanawiCompositeKey(r) === key,
      ) ||
      state.approved.some(
        (r) =>
          r.id !== id &&
          r.kind === 'thanawi' &&
          r.categoryCode === existing.categoryCode &&
          thanawiCompositeKey(r) === key,
      );
    if (collision) return { ok: false, reason: 'duplicate' };
    set((s) => ({
      local: s.local.map((r) => (r.id === id ? candidate : r)),
      approved: s.approved.map((r) => (r.id === id ? candidate : r)),
      editingRowId: null,
    }));
    return { ok: true };
  },

  removeLocalRow: (id) =>
    set((s) => ({
      local: s.local.filter((r) => r.id !== id),
      editingRowId: s.editingRowId === id ? null : s.editingRowId,
    })),

  removeApprovedRow: (id) =>
    set((s) => ({
      approved: s.approved.filter((r) => r.id !== id),
      editingRowId: s.editingRowId === id ? null : s.editingRowId,
    })),

  approveLocalForCategory: (categoryCode) => {
    const { local, approved } = get();
    const moving = local.filter((r) => r.categoryCode === categoryCode);
    if (moving.length === 0) return 0;
    set({
      approved: [...approved, ...moving],
      local: local.filter((r) => r.categoryCode !== categoryCode),
    });
    return moving.length;
  },

  setEditingRow: (id) => set({ editingRowId: id }),
  clearEditingRow: () => set({ editingRowId: null }),
}));

/* ── Completion-state selector ───────────────────────────────────────
 *
 * Pure derivation off the wizard's authored rows (`local` ⊕ `approved`)
 * and the category's scoped specialization list. Both buckets count as
 * "saved" from the admin's perspective — anything visible in the grid
 * has all required fields filled (the `canSubmit` gate in the form
 * enforces it). Pulling from just `approved` would lag behind authoring
 * until the admin clicks the section-level «اعتماد» button, which is
 * confusing.
 *
 *   • `'complete'` — every active specialization under the category has
 *     at least one authored row with all required fields filled. For
 *     pre-university (ثانوي) categories the category itself is the unit.
 *   • `'partial'`  — at least one specialization has authored rows but
 *     the all-units-complete condition fails.
 *   • `'empty'`    — no specialization under the category has authored
 *     rows at all.
 */

export type CategoryCompletionState = 'complete' | 'partial' | 'empty';

function isHeaderComplete(h: GeneralRulesHeader): boolean {
  return (
    h.applicationStart !== '' &&
    h.applicationEnd !== '' &&
    h.ageReferenceDate !== '' &&
    h.maxAge !== null &&
    h.maritalStatus.length > 0
  );
}

/** The row's «معيار التمييز» branch is satisfied when either the grade
 *  pair or the score pair is fully filled — the form only ever surfaces
 *  one of the two depending on the parent category's criterion. */
function hasGradePair(r: { grade: string; gradeMax: string }): boolean {
  return r.grade !== '' && r.gradeMax !== '';
}

function hasScorePair(r: { scoreMin: number | null; scoreMax: number | null }): boolean {
  return r.scoreMin !== null && r.scoreMax !== null;
}

function isUniversityRowComplete(r: LocalUniversityRow): boolean {
  return (
    isHeaderComplete(r.header) &&
    r.type.length > 0 &&
    (r.excellenceMode === 'TAGDIR' ? hasGradePair(r) : hasScorePair(r)) &&
    r.academicDegrees.length > 0 &&
    r.committees.length > 0 &&
    r.graduationYears.length > 0
  );
}

function isThanawiRowComplete(r: LocalThanawiRow): boolean {
  return (
    isHeaderComplete(r.header) &&
    r.examRound !== '' &&
    r.committee !== '' &&
    r.graduationYear !== null &&
    r.schoolCategories.length > 0 &&
    (r.excellenceMode === 'TAGDIR' ? hasGradePair(r) : hasScorePair(r))
  );
}

export function selectCategoryCompletion(
  categoryCode: string,
  categoryType: 'university' | 'pre_university',
  authoredRows: readonly LocalGeneralRuleRow[],
  scopedSpecCodes: readonly string[],
): CategoryCompletionState {
  const rows = authoredRows.filter((r) => r.categoryCode === categoryCode);
  if (rows.length === 0) return 'empty';

  if (categoryType === 'pre_university') {
    const hasComplete = rows.some(
      (r): r is LocalThanawiRow =>
        r.kind === 'thanawi' && isThanawiRowComplete(r),
    );
    return hasComplete ? 'complete' : 'partial';
  }

  // university — when the category has no spec scope (rare), treat the
  // whole category as one unit so the badge isn't permanently `partial`.
  if (scopedSpecCodes.length === 0) {
    const hasComplete = rows.some(
      (r): r is LocalUniversityRow =>
        r.kind === 'university' && isUniversityRowComplete(r),
    );
    return hasComplete ? 'complete' : 'partial';
  }

  let allUnitsComplete = true;
  for (const specCode of scopedSpecCodes) {
    const specRows = rows.filter(
      (r): r is LocalUniversityRow =>
        r.kind === 'university' && r.specializationCode === specCode,
    );
    if (specRows.length === 0 || !specRows.some(isUniversityRowComplete)) {
      allUnitsComplete = false;
    }
  }
  return allUnitsComplete ? 'complete' : 'partial';
}
