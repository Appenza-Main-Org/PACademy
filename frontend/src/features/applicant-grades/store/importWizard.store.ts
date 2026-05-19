/**
 * Import Wizard v2 — sessionStorage-backed state machine.
 *
 * The wizard is driven entirely off this store; each step component reads
 * the slice it needs and dispatches via the actions exposed below. Persist
 * to sessionStorage so a mid-wizard refresh doesn't kill the session —
 * though the `File` object itself can't be serialised, so a refresh
 * always lands back at Step 1 with the metadata-bearing fields cleared.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ImportReport } from '../types';
import type { ParsedSheet } from '../lib/parseGradesFile';
import type { TargetField } from '../lib/targetFields';

export type ImportStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Per-row decision on an existing-record diff. `accept` writes the
 *  incoming values; `reject` leaves the existing row untouched. */
export type ExistingDiffDecision = 'accept' | 'reject';

/** Resolution for an intra-upload duplicate NID. The store records the
 *  picked total OR source-row index whenever the admin chooses a
 *  specific row, so the commit can write deterministic data even if the
 *  wizard is resumed mid-flow.
 *
 *  `pick-row` is the row-level picker — admins explicitly pick which
 *  source row to keep by its 1-based `sourceRowIndex` (mirrors
 *  `NormalisedRow.sourceRowIndex`). Surfaces every duplicate, not just
 *  total conflicts, so admins resolve which of the duplicate rows
 *  represents the canonical record. */
export type UploadDuplicateDecision =
  | { action: 'pick-higher' }
  | { action: 'pick-lower' }
  | { action: 'pick-specific'; pickedTotal: number }
  | { action: 'pick-row'; pickedSourceRowIndex: number }
  | { action: 'reject' };

export interface FilterState {
  /** `all` = include every distinct value; `include` = keep only those listed in `values`. */
  mode: 'all' | 'include';
  values: string[];
}

/** Shape that survives a JSON round-trip in sessionStorage. */
export interface PersistedImportWizardState {
  step: ImportStep;
  /** Codes of school-categories the import targets (from the
   *  `school-categories` lookup, e.g. `SCH-01`, `SCH-03`). Replaces the
   *  prior binary `secondaryType` (general | azhar) toggle so admins can
   *  load a mixed file in a single pass. */
  selectedSchoolCategories: string[];
  /** Per-category max grade (الدرجة العظمى) keyed by lookup code. The
   *  commit path reads `maxGradeByCategory[row.schoolCategoryCode]`, so
   *  every selected category must carry a value before advancing. */
  maxGradeByCategory: Record<string, number>;
  /** `null` = the admin hasn't picked a graduation year yet. Step 1's
   *  "متابعة" gate enforces that this is non-null before advancing —
   *  the field starts empty so admins don't accidentally import under
   *  the current year when they meant a back-year cohort. */
  graduationYear: number | null;
  /** File metadata only — the File object itself is non-serialisable. */
  fileMeta: { name: string; size: number } | null;
  selectedTableName: string | null;
  mapping: Record<TargetField, string | null>;
  filters: Record<string, FilterState>;
  importResult: ImportReport | null;
  perGroupActions: Record<string, 'skip' | 'override' | 'create-applicant'>;
  /** Per-row decision for rows whose national-id matches an existing
   *  record. Drives Step 6's diff-review UI; rows without an entry
   *  default to `reject` (existing record left alone) until the admin
   *  flips them via the per-row or bulk controls. */
  existingDiffDecisions: Record<string, ExistingDiffDecision>;
  /** Per-NID decision for upload rows whose `المجموع الكلي` appears
   *  with two different values inside the same file. Default action is
   *  `pick-higher` so the wizard is always advanceable; the admin can
   *  flip per-row or via the bulk "قبول الكل بالدرجة الأعلى" action. */
  uploadDuplicateDecisions: Record<string, UploadDuplicateDecision>;
}

export interface ImportWizardState extends PersistedImportWizardState {
  /** Live `File` reference + parsed structure — kept out of persist. */
  file: File | null;
  parsed: ParsedSheet | null;

  /** Mutators. */
  setStep: (step: ImportStep) => void;
  setSelectedSchoolCategories: (codes: string[]) => void;
  setMaxGradeForCategory: (code: string, value: number) => void;
  setGraduationYear: (y: number | null) => void;
  setFile: (file: File | null) => void;
  setParsed: (parsed: ParsedSheet | null) => void;
  setSelectedTableName: (name: string | null) => void;
  setMapping: (mapping: Record<TargetField, string | null>) => void;
  setMappingField: (field: TargetField, source: string | null) => void;
  setFilters: (filters: Record<string, FilterState>) => void;
  setFilter: (column: string, state: FilterState) => void;
  setImportResult: (r: ImportReport | null) => void;
  setPerGroupAction: (code: string, action: 'skip' | 'override' | 'create-applicant') => void;
  setExistingDiffDecision: (nid: string, decision: ExistingDiffDecision) => void;
  setBulkExistingDiffDecisions: (decisions: Record<string, ExistingDiffDecision>) => void;
  setUploadDuplicateDecision: (nid: string, decision: UploadDuplicateDecision) => void;
  setBulkUploadDuplicateDecisions: (decisions: Record<string, UploadDuplicateDecision>) => void;
  reset: () => void;
}

/** Default max grade per school-category code. Falls back to 410 for
 *  any code not listed (e.g. STEM, foreign diplomas). The الأزهرية
 *  certificate ramps to 510 because the maximum credit total there is
 *  higher than the general curriculum. */
export const DEFAULT_MAX_GRADE_BY_CATEGORY: Readonly<Record<string, number>> = {
  'SCH-01': 410,
  'SCH-03': 510,
  'SCH-05': 410,
  'SCH-06': 410,
  'SCH-07': 410,
};

/** Hard-coded list of school-category codes that should map to the
 *  `azhar` GradeKind. Everything else maps to `general`. Hard-coded
 *  rather than read off the lookup so the kind partition stays explicit
 *  even if the lookup label changes downstream. */
export const AZHAR_CATEGORY_CODES: readonly string[] = ['SCH-03'];

export function defaultMaxFor(code: string): number {
  return DEFAULT_MAX_GRADE_BY_CATEGORY[code] ?? 410;
}

const EMPTY_MAPPING: Record<TargetField, string | null> = {
  nationalId: null,
  seatingNumber: null,
  nameAr: null,
  gender: null,
  track: null,
  graduationYear: null,
  totalGrade: null,
  maxGrade: null,
  schoolCategory: null,
  examRound: null,
  schoolName: null,
  regionName: null,
};

function defaultState(): PersistedImportWizardState {
  return {
    step: 1,
    selectedSchoolCategories: [],
    maxGradeByCategory: {},
    graduationYear: null,
    fileMeta: null,
    selectedTableName: null,
    mapping: { ...EMPTY_MAPPING },
    filters: {},
    importResult: null,
    perGroupActions: {},
    existingDiffDecisions: {},
    uploadDuplicateDecisions: {},
  };
}

export const useImportWizardStore = create<ImportWizardState>()(
  persist(
    (set) => ({
      ...defaultState(),
      file: null,
      parsed: null,

      setStep: (step) => set({ step }),
      setSelectedSchoolCategories: (codes) =>
        set((s) => {
          /* Seed any newly-selected category with its default max so
           * the UI never renders a blank input for a freshly-checked
           * chip. Untick → drop the entry so the persisted state stays
           * lean across sessions. */
          const next: Record<string, number> = {};
          for (const code of codes) {
            next[code] = s.maxGradeByCategory[code] ?? defaultMaxFor(code);
          }
          return { selectedSchoolCategories: codes, maxGradeByCategory: next };
        }),
      setMaxGradeForCategory: (code, value) =>
        set((s) => ({
          maxGradeByCategory: { ...s.maxGradeByCategory, [code]: value },
        })),
      setGraduationYear: (graduationYear) => set({ graduationYear }),
      setFile: (file) =>
        set({
          file,
          fileMeta: file ? { name: file.name, size: file.size } : null,
          /* Picking a new file invalidates everything downstream. */
          parsed: null,
          selectedTableName: null,
          mapping: { ...EMPTY_MAPPING },
          filters: {},
          importResult: null,
          perGroupActions: {},
          existingDiffDecisions: {},
          uploadDuplicateDecisions: {},
        }),
      setParsed: (parsed) => set({ parsed }),
      setSelectedTableName: (selectedTableName) => set({ selectedTableName }),
      setMapping: (mapping) => set({ mapping }),
      setMappingField: (field, source) =>
        set((s) => ({ mapping: { ...s.mapping, [field]: source } })),
      setFilters: (filters) => set({ filters }),
      setFilter: (column, state) =>
        set((s) => ({ filters: { ...s.filters, [column]: state } })),
      setImportResult: (importResult) => set({ importResult }),
      setPerGroupAction: (code, action) =>
        set((s) => ({ perGroupActions: { ...s.perGroupActions, [code]: action } })),
      setExistingDiffDecision: (nid, decision) =>
        set((s) => ({
          existingDiffDecisions: { ...s.existingDiffDecisions, [nid]: decision },
        })),
      setBulkExistingDiffDecisions: (decisions) =>
        set({ existingDiffDecisions: decisions }),
      setUploadDuplicateDecision: (nid, decision) =>
        set((s) => ({
          uploadDuplicateDecisions: { ...s.uploadDuplicateDecisions, [nid]: decision },
        })),
      setBulkUploadDuplicateDecisions: (decisions) =>
        set({ uploadDuplicateDecisions: decisions }),
      reset: () =>
        set({
          ...defaultState(),
          file: null,
          parsed: null,
        }),
    }),
    {
      name: 'pa-applicant-grades-import-v2',
      storage: createJSONStorage(() => sessionStorage),
      /* Only persist serialisable slices — the `File` + parsed structures
       * are recreated when the admin re-picks the file. */
      partialize: (s): PersistedImportWizardState => ({
        step: s.step,
        selectedSchoolCategories: s.selectedSchoolCategories,
        maxGradeByCategory: s.maxGradeByCategory,
        graduationYear: s.graduationYear,
        fileMeta: s.fileMeta,
        selectedTableName: s.selectedTableName,
        mapping: s.mapping,
        filters: s.filters,
        importResult: s.importResult,
        perGroupActions: s.perGroupActions,
        existingDiffDecisions: s.existingDiffDecisions,
        uploadDuplicateDecisions: s.uploadDuplicateDecisions,
      }),
    },
  ),
);
