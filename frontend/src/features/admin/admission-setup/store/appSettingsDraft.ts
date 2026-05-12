/**
 * Application Settings — in-memory draft store for the year-row editor.
 *
 * The YearTable supports per-row inline editing with bulk save. A row
 * can be in one of three transient states:
 *
 *   - `original`  → mirror of the server row
 *   - `dirty`     → server row + locally-edited fields (kind = update)
 *   - `new`       → user-added row (no server id yet) — temp id like
 *                   `temp-acs-3-2`
 *   - `deleted`   → server row staged for removal
 *
 * Deletes use a tombstone so the user can undo before bulk-save fires.
 *
 * The store is keyed at the top level by `categorySpecializationId` so
 * different specialization rows don't share state, and dirtiness is
 * computed by comparing the draft `row` against `original`. The bulk
 * save bar flattens every category-specialization slice into a single
 * payload at save time.
 */

import { create } from 'zustand';
import type { ApplicantSpecializationYear, GenderType } from '../types';

export type DraftKind = 'original' | 'new' | 'dirty' | 'deleted';

export interface DraftRow {
  /** Temp id for `new`, server id otherwise. */
  id: string;
  /** `null` for `new` rows (no server snapshot yet). */
  original: ApplicantSpecializationYear | null;
  /** The current editable shape. Always defined. */
  row: ApplicantSpecializationYear;
  kind: DraftKind;
}

interface DraftSliceState {
  byCs: Record<string, DraftRow[]>;
  /** Monotonic counter for temp ids — survives across slices. */
  tempIdSeed: number;
}

interface DraftActions {
  /** Replace a slice from a fresh server fetch unless any local edits exist. */
  hydrateSlice: (
    categorySpecializationId: string,
    serverRows: ApplicantSpecializationYear[],
  ) => void;
  /** Patch a single field on a row. Promotes `original` → `dirty`. */
  patchRow: (
    categorySpecializationId: string,
    id: string,
    patch: Partial<ApplicantSpecializationYear>,
  ) => void;
  /** Add a new row with sensible defaults; returns the temp id. */
  addRow: (categorySpecializationId: string, seed: Partial<ApplicantSpecializationYear>) => string;
  /** Mark a server row for deletion. New rows are removed outright. */
  deleteRow: (categorySpecializationId: string, id: string) => void;
  /** Undo a tombstone. */
  restoreRow: (categorySpecializationId: string, id: string) => void;
  /** Drop all unsaved edits across every slice. */
  resetAll: () => void;
  /** Reset a single slice — used after a successful per-slice save. */
  resetSlice: (categorySpecializationId: string) => void;
}

type Store = DraftSliceState & DraftActions;

function sameStringArray(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function gradeFieldsEqual(
  a: ApplicantSpecializationYear,
  b: ApplicantSpecializationYear,
): boolean {
  if (a.gradeKind !== b.gradeKind) return false;
  if (a.gradeKind === 'GRADES' && b.gradeKind === 'GRADES') {
    return a.minPercentage === b.minPercentage;
  }
  if (a.gradeKind === 'TAGDIR' && b.gradeKind === 'TAGDIR') {
    return a.academicGradeId === b.academicGradeId;
  }
  return false;
}

function isSameRow(
  a: ApplicantSpecializationYear,
  b: ApplicantSpecializationYear,
): boolean {
  return (
    a.graduationYear === b.graduationYear &&
    sameStringArray(a.genderTypes, b.genderTypes) &&
    sameStringArray(a.maritalStatusCodes, b.maritalStatusCodes) &&
    sameStringArray(a.divisionCodes, b.divisionCodes) &&
    a.maxAge === b.maxAge &&
    gradeFieldsEqual(a, b) &&
    a.applicationStartDate === b.applicationStartDate &&
    a.applicationEndDate === b.applicationEndDate &&
    a.ageReferenceDate === b.ageReferenceDate &&
    a.isActive === b.isActive
  );
}

export const useAppSettingsDraftStore = create<Store>((set, get) => ({
  byCs: {},
  tempIdSeed: 1,

  hydrateSlice: (csId, serverRows) => {
    const existing = get().byCs[csId];
    /* Don't blow away a slice with local edits — TanStack Query will
     * refetch on every invalidation; we only want to seed when the
     * slice has never been touched. A slice "has edits" if any row is
     * non-original or any non-deleted server id is missing. */
    if (existing && existing.some((r) => r.kind !== 'original')) {
      return;
    }
    const next: DraftRow[] = serverRows.map((row) => ({
      id: row.id,
      original: row,
      row,
      kind: 'original',
    }));
    set((state) => ({ byCs: { ...state.byCs, [csId]: next } }));
  },

  patchRow: (csId, id, patch) => {
    set((state) => {
      const slice = state.byCs[csId];
      if (!slice) return state;
      const updated = slice.map((draft) => {
        if (draft.id !== id) return draft;
        if (draft.kind === 'deleted') return draft; // ignore edits on tombstones
        /* `gradeKind` is immutable post-creation — drop any patch that
         * tries to flip it. Branch fields that don't apply to the
         * current kind are dropped silently too, so the discriminated
         * union stays consistent. */
        const sanitized: Partial<ApplicantSpecializationYear> = { ...patch };
        if ('gradeKind' in sanitized) delete sanitized.gradeKind;
        if (draft.row.gradeKind === 'GRADES' && 'academicGradeId' in sanitized) {
          delete (sanitized as { academicGradeId?: string }).academicGradeId;
        }
        if (draft.row.gradeKind === 'TAGDIR' && 'minPercentage' in sanitized) {
          delete (sanitized as { minPercentage?: number }).minPercentage;
        }
        const merged = { ...draft.row, ...sanitized } as ApplicantSpecializationYear;
        let kind: DraftKind = draft.kind;
        if (draft.kind === 'new') {
          kind = 'new';
        } else if (draft.original && isSameRow(merged, draft.original)) {
          kind = 'original';
        } else {
          kind = 'dirty';
        }
        return { ...draft, row: merged, kind };
      });
      return { byCs: { ...state.byCs, [csId]: updated } };
    });
  },

  /**
   * Default new rows to the GRADES branch with a `minPercentage` of 70.
   * Callers that already know the parent gradingMode should pass
   * `gradeKind: 'TAGDIR'` + `academicGradeId: ''` via `seed`; the
   * proper resolver wiring lands in a later commit.
   */
  addRow: (csId, seed) => {
    const seedNumber = get().tempIdSeed;
    const tempId = `temp-${csId}-${seedNumber}`;
    const today = new Date().toISOString().slice(0, 10);
    const seedBag = seed as Record<string, unknown>;
    const seedKind: 'GRADES' | 'TAGDIR' =
      seedBag.gradeKind === 'TAGDIR' ? 'TAGDIR' : 'GRADES';
    /* Strip the discriminator + the opposite-branch field from `seed`
     * before merging so the produced row stays in one branch. */
    const seedRest: Record<string, unknown> = { ...seedBag };
    delete seedRest.gradeKind;
    delete seedRest.minPercentage;
    delete seedRest.academicGradeId;
    const base = {
      id: tempId,
      categorySpecializationId: csId,
      graduationYear: new Date().getFullYear(),
      genderTypes: ['male'] as GenderType[],
      maritalStatusCodes: [] as string[],
      maxAge: null,
      divisionCodes: [] as string[],
      applicationStartDate: today,
      applicationEndDate: today,
      ageReferenceDate: today,
      isActive: true,
    };
    const row: ApplicantSpecializationYear =
      seedKind === 'TAGDIR'
        ? {
            ...base,
            ...seedRest,
            gradeKind: 'TAGDIR',
            academicGradeId:
              typeof seedBag.academicGradeId === 'string'
                ? (seedBag.academicGradeId as string)
                : '',
          }
        : {
            ...base,
            ...seedRest,
            gradeKind: 'GRADES',
            minPercentage:
              typeof seedBag.minPercentage === 'number'
                ? (seedBag.minPercentage as number)
                : 70,
          };
    set((state) => {
      const slice = state.byCs[csId] ?? [];
      return {
        byCs: { ...state.byCs, [csId]: [...slice, { id: tempId, original: null, row, kind: 'new' }] },
        tempIdSeed: state.tempIdSeed + 1,
      };
    });
    return tempId;
  },

  deleteRow: (csId, id) => {
    set((state) => {
      const slice = state.byCs[csId];
      if (!slice) return state;
      const updated = slice.flatMap((draft) => {
        if (draft.id !== id) return [draft];
        if (draft.kind === 'new') return []; // drop unsaved row outright
        return [{ ...draft, kind: 'deleted' as DraftKind }];
      });
      return { byCs: { ...state.byCs, [csId]: updated } };
    });
  },

  restoreRow: (csId, id) => {
    set((state) => {
      const slice = state.byCs[csId];
      if (!slice) return state;
      const updated = slice.map((draft) => {
        if (draft.id !== id) return draft;
        if (draft.kind !== 'deleted' || !draft.original) return draft;
        return {
          ...draft,
          row: draft.original,
          kind: 'original' as DraftKind,
        };
      });
      return { byCs: { ...state.byCs, [csId]: updated } };
    });
  },

  resetAll: () => set({ byCs: {}, tempIdSeed: 1 }),

  resetSlice: (csId) =>
    set((state) => {
      const slice = state.byCs[csId];
      if (!slice) return state;
      // Drop new rows; collapse dirty/deleted back to original snapshots.
      const next: DraftRow[] = slice
        .filter((d) => d.kind !== 'new')
        .map((d) => ({
          ...d,
          row: d.original ?? d.row,
          kind: 'original' as DraftKind,
        }));
      return { byCs: { ...state.byCs, [csId]: next } };
    }),
}));

/* ─── Selectors ──────────────────────────────────────────────────────── */

export function useDraftRows(csId: string): DraftRow[] {
  return useAppSettingsDraftStore((s) => s.byCs[csId] ?? []);
}

export function useDraftIsDirty(): boolean {
  return useAppSettingsDraftStore((s) =>
    Object.values(s.byCs).some((slice) =>
      slice.some((r) => r.kind !== 'original'),
    ),
  );
}

export interface DraftSummary {
  dirtyCount: number;
  newCount: number;
  deletedCount: number;
  total: number;
}

export function useDraftSummary(): DraftSummary {
  return useAppSettingsDraftStore((s) => {
    let dirtyCount = 0;
    let newCount = 0;
    let deletedCount = 0;
    for (const slice of Object.values(s.byCs)) {
      for (const r of slice) {
        if (r.kind === 'dirty') dirtyCount += 1;
        else if (r.kind === 'new') newCount += 1;
        else if (r.kind === 'deleted') deletedCount += 1;
      }
    }
    return {
      dirtyCount,
      newCount,
      deletedCount,
      total: dirtyCount + newCount + deletedCount,
    };
  });
}
