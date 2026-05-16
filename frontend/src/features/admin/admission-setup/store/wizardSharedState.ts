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
}

/** A single editable row inside one university-category section's form. */
export interface GeneralRuleRowInput {
  /** Genders accepted by this rule. Empty array means "any". */
  type: string[];
  /** Minimum acceptable academic grade — single code (الحد الأدنى). */
  grade: string;
  /** Maximum acceptable academic grade — single code (الحد الأقصى). */
  gradeMax: string;
  /** Inclusive minimum percentage score (الحد الأدنى للدرجة). 0–100. */
  scoreMin: number | null;
  /** Inclusive maximum percentage score (الحد الأقصى للدرجة). 0–100. */
  scoreMax: number | null;
  /** Academic degrees — multi-select (الدرجة العلمية). */
  academicDegrees: string[];
  /** Committee — single id (اللجنة). */
  committee: string;
  /** Graduation year — single year (سنة التخرج). */
  graduationYear: number | null;
}

/** A single editable row inside one pre-university (ثانوي) section's form. */
export interface ThanawiRuleRowInput {
  /** Exam-round lookup code (الدور). */
  examRound: string;
  /** Committee id, scoped to this applicant-category. */
  committee: string;
  /** Graduation year — single year. */
  graduationYear: number | null;
  /** School-category lookup codes (فئة المدرسة) — multi-select. */
  schoolCategories: string[];
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
  grade: string;
  gradeMax: string;
  scoreMin: number | null;
  scoreMax: number | null;
  /** 1-element array — preserves the legacy ApprovedRulesView shape. */
  academicDegrees: string[];
  committees: string[];
  graduationYears: number[];
}

export interface LocalThanawiRow extends LocalRowBase {
  kind: 'thanawi';
  examRound: string;
  committee: string;
  graduationYear: number | null;
  /** Multi-select fan-out per row (فئة المدرسة). */
  schoolCategories: string[];
  /* Legacy shape so ApprovedRulesView renders thanawi rows alongside
   * university rows in the same table without crashes. Empty arrays
   * render as «—» in the viewer. */
  type: string[];
  maritalStatus: string[];
  grade: string;
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
  removeLocalRow: (id: string) => void;
  removeApprovedRow: (id: string) => void;
  approveLocalForCategory: (categoryCode: string) => number;
}

type Store = WizardSharedState & WizardSharedActions;

export const INITIAL_HEADER: GeneralRulesHeader = {
  applicationStart: '',
  applicationEnd: '',
  ageReferenceDate: '',
  graduationYears: [],
  maritalStatus: [],
};

let rowIdSeed = 0;
function nextRowId(): string {
  rowIdSeed += 1;
  return `gr-${Date.now().toString(36)}-${rowIdSeed}`;
}

/** Composite key for university rows — duplicates are blocked at the
 *  call site by comparing this against existing local + approved
 *  rows under the same category. */
function universityCompositeKey(r: LocalUniversityRow): string {
  return [
    r.categoryCode,
    r.facultyCode,
    r.specializationCode,
    [...r.type].sort().join('|'),
    r.grade,
    r.gradeMax,
    String(r.scoreMin),
    String(r.scoreMax),
    [...r.academicDegrees].sort().join('|'),
    [...r.committees].sort().join('|'),
    [...r.graduationYears].sort().join('|'),
  ].join('::');
}

function thanawiCompositeKey(r: LocalThanawiRow): string {
  return [
    r.categoryCode,
    r.examRound,
    r.committee,
    String(r.graduationYear),
    [...r.schoolCategories].sort().join('|'),
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
    kind: 'university',
    categoryCode,
    header,
    facultyCode: spec.facultyCode,
    facultyNameAr: spec.facultyNameAr,
    specializationCode: spec.specializationCode,
    specializationNameAr: spec.specializationNameAr,
    type: input.type,
    maritalStatus: header.maritalStatus,
    grade: input.grade,
    gradeMax: input.gradeMax,
    scoreMin: input.scoreMin,
    scoreMax: input.scoreMax,
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
    kind: 'thanawi',
    categoryCode,
    header,
    examRound: input.examRound,
    committee: input.committee,
    graduationYear: input.graduationYear,
    schoolCategories: [...input.schoolCategories],
    type: [],
    maritalStatus: header.maritalStatus,
    grade: '',
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

  removeLocalRow: (id) =>
    set((s) => ({ local: s.local.filter((r) => r.id !== id) })),

  removeApprovedRow: (id) =>
    set((s) => ({ approved: s.approved.filter((r) => r.id !== id) })),

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
}));
