/**
 * Admission-Setup wizard — cross-step shared state.
 *
 * Scoped to the «الضباط المتخصصون» → «قواعد عامة» flow that spans two
 * wizard steps:
 *
 *   1. `application_settings` collects per-specialization rule rows in a
 *      `local` bucket while the admin edits the General Rules form.
 *   2. The «اعتماد» button at the bottom of the section moves rows from
 *      the `local` bucket into the `approved` bucket and clears the
 *      `local` bucket.
 *   3. `committees` reads `approved` to render the «عرض» tab.
 *
 * Header context (start/end dates, age date, top-level graduation years)
 * is captured once at the top of the section and stamped onto every row
 * at approval time so the «عرض» grid renders a flat row shape.
 */

import { create } from 'zustand';

/** Composite key — one specialization under one faculty. */
export interface SpecKey {
  facultyCode: string;
  specializationCode: string;
}

/** Shared header captured at the top of the «قواعد عامة» sub-section. */
export interface GeneralRulesHeader {
  /** ISO yyyy-MM-dd or empty string. */
  applicationStart: string;
  applicationEnd: string;
  ageReferenceDate: string;
  graduationYears: number[];
}

/** A single editable row inside one specialization's «General Rules» form. */
export interface GeneralRuleRowInput {
  /** Genders accepted by this rule. Empty array means "any". The form
   *  renders this as a multi-select; downstream committee filtering
   *  matches a committee when its gender is in this list (or list is
   *  empty). */
  type: string[];
  maritalStatus: string;
  grade: string;
  academicDegrees: string[];
  committees: string[];
  graduationYears: number[];
}

/** Row in the local (un-approved) bucket — keyed by faculty + spec. */
export interface LocalGeneralRuleRow extends GeneralRuleRowInput {
  id: string;
  facultyCode: string;
  facultyNameAr: string;
  specializationCode: string;
  specializationNameAr: string;
}

/** Row in the approved bucket — header context stamped on. */
export interface ApprovedGeneralRuleRow extends LocalGeneralRuleRow {
  header: GeneralRulesHeader;
}

interface WizardSharedState {
  header: GeneralRulesHeader;
  /** Local rows awaiting approval — promoted to `approved` on «اعتماد». */
  local: LocalGeneralRuleRow[];
  /** Rows promoted via «اعتماد», read by the committees «عرض» tab. */
  approved: ApprovedGeneralRuleRow[];
}

interface WizardSharedActions {
  setHeaderField: <K extends keyof GeneralRulesHeader>(
    field: K,
    value: GeneralRulesHeader[K],
  ) => void;
  addLocalRow: (
    spec: SpecKey & { facultyNameAr: string; specializationNameAr: string },
    input: GeneralRuleRowInput,
  ) => void;
  removeLocalRow: (id: string) => void;
  removeApprovedRow: (id: string) => void;
  approveLocal: () => number;
}

type Store = WizardSharedState & WizardSharedActions;

const INITIAL_HEADER: GeneralRulesHeader = {
  applicationStart: '',
  applicationEnd: '',
  ageReferenceDate: '',
  graduationYears: [],
};

let rowIdSeed = 0;
function nextRowId(): string {
  rowIdSeed += 1;
  return `gr-${Date.now().toString(36)}-${rowIdSeed}`;
}

export const useAdmissionSetupWizardStore = create<Store>((set, get) => ({
  header: INITIAL_HEADER,
  local: [],
  approved: [],

  setHeaderField: (field, value) =>
    set((s) => ({ header: { ...s.header, [field]: value } })),

  addLocalRow: (spec, input) =>
    set((s) => ({
      local: [
        ...s.local,
        {
          id: nextRowId(),
          facultyCode: spec.facultyCode,
          facultyNameAr: spec.facultyNameAr,
          specializationCode: spec.specializationCode,
          specializationNameAr: spec.specializationNameAr,
          ...input,
        },
      ],
    })),

  removeLocalRow: (id) =>
    set((s) => ({ local: s.local.filter((r) => r.id !== id) })),

  removeApprovedRow: (id) =>
    set((s) => ({ approved: s.approved.filter((r) => r.id !== id) })),

  approveLocal: () => {
    const { local, header, approved } = get();
    if (local.length === 0) return 0;
    const stamped: ApprovedGeneralRuleRow[] = local.map((r) => ({
      ...r,
      header,
    }));
    set({ approved: [...approved, ...stamped], local: [] });
    return stamped.length;
  },
}));
