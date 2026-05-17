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

export type ImportStep = 1 | 2 | 3 | 4 | 5 | 6;

export type SecondaryType = 'general' | 'azhar';

export interface FilterState {
  /** `all` = include every distinct value; `include` = keep only those listed in `values`. */
  mode: 'all' | 'include';
  values: string[];
}

/** Shape that survives a JSON round-trip in sessionStorage. */
export interface PersistedImportWizardState {
  step: ImportStep;
  secondaryType: SecondaryType;
  maxGrade: number;
  graduationYear: number;
  /** File metadata only — the File object itself is non-serialisable. */
  fileMeta: { name: string; size: number } | null;
  selectedTableName: string | null;
  mapping: Record<TargetField, string | null>;
  filters: Record<string, FilterState>;
  importResult: ImportReport | null;
  perGroupActions: Record<string, 'skip' | 'override' | 'create-applicant'>;
}

export interface ImportWizardState extends PersistedImportWizardState {
  /** Live `File` reference + parsed structure — kept out of persist. */
  file: File | null;
  parsed: ParsedSheet | null;

  /** Mutators. */
  setStep: (step: ImportStep) => void;
  setSecondaryType: (t: SecondaryType) => void;
  setMaxGrade: (v: number) => void;
  setGraduationYear: (y: number) => void;
  setFile: (file: File | null) => void;
  setParsed: (parsed: ParsedSheet | null) => void;
  setSelectedTableName: (name: string | null) => void;
  setMapping: (mapping: Record<TargetField, string | null>) => void;
  setMappingField: (field: TargetField, source: string | null) => void;
  setFilters: (filters: Record<string, FilterState>) => void;
  setFilter: (column: string, state: FilterState) => void;
  setImportResult: (r: ImportReport | null) => void;
  setPerGroupAction: (code: string, action: 'skip' | 'override' | 'create-applicant') => void;
  reset: () => void;
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
};

const CURRENT_YEAR = new Date().getFullYear();

function defaultState(): PersistedImportWizardState {
  return {
    step: 1,
    secondaryType: 'general',
    maxGrade: 410,
    graduationYear: CURRENT_YEAR,
    fileMeta: null,
    selectedTableName: null,
    mapping: { ...EMPTY_MAPPING },
    filters: {},
    importResult: null,
    perGroupActions: {},
  };
}

export const useImportWizardStore = create<ImportWizardState>()(
  persist(
    (set) => ({
      ...defaultState(),
      file: null,
      parsed: null,

      setStep: (step) => set({ step }),
      setSecondaryType: (secondaryType) =>
        set({
          secondaryType,
          maxGrade: secondaryType === 'azhar' ? 510 : 410,
        }),
      setMaxGrade: (maxGrade) => set({ maxGrade }),
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
        secondaryType: s.secondaryType,
        maxGrade: s.maxGrade,
        graduationYear: s.graduationYear,
        fileMeta: s.fileMeta,
        selectedTableName: s.selectedTableName,
        mapping: s.mapping,
        filters: s.filters,
        importResult: s.importResult,
        perGroupActions: s.perGroupActions,
      }),
    },
  ),
);
