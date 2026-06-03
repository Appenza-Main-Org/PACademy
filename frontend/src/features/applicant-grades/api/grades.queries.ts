/**
 * TanStack Query hooks wrapping `gradesService`. The only thing that has
 * to change when the real backend lands is the body of the service
 * methods — every component below this layer keeps its contract.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  gradesService,
  type ApplicantGradesColumnFilters,
  type ApplicantGradesSort,
} from './grades.service';
import type { ImportedGradeRow } from '../lib/parseAccessFile';
import type {
  AdjustmentReason,
  ApplicantGender,
  CommittedImport,
  ImportCommitResult,
  ImportCommitProgress,
  ImportGroupAction,
  ImportGroupCode,
  ImportPreflightProgress,
  ImportReport,
  ImportResolution,
  NormalisedRow,
  StagedImport,
} from '../types';

export interface PaginatedGradesParams {
  page: number;
  pageSize: number;
  search: string;
  sort?: ApplicantGradesSort | null;
  gender?: ApplicantGender | 'all';
  branch?: string | 'all';
  graduationYear?: number | 'all';
  schoolCategoryCode?: string | 'all';
  columnFilters?: ApplicantGradesColumnFilters;
  changedOnly?: boolean;
}

export const gradesKeys = {
  all: ['applicant-grades'] as const,
  list: () => [...gradesKeys.all, 'list'] as const,
  byNid: (nid: string, cycleId: string) =>
    [...gradesKeys.all, 'by-nid', cycleId, nid] as const,
  paginated: (params: PaginatedGradesParams) =>
    [...gradesKeys.all, 'paginated', params] as const,
};

export function useGrades() {
  return useQuery({
    queryKey: gradesKeys.list(),
    queryFn: () => gradesService.list(),
  });
}

/**
 * NID-driven grade lookup for the applicant-portal eligibility gate
 * (RFP §المرحلة 3-4). Disabled until both `nid` and `cycleId` are
 * available — TanStack Query won't fire and the consumer can render a
 * skeleton in the meantime.
 */
interface ApplicantGradeByNidOptions {
  enabled?: boolean;
}

export function useApplicantGradeByNid(
  nid: string | null,
  cycleId: string | null,
  options: ApplicantGradeByNidOptions = {},
) {
  return useQuery({
    queryKey: gradesKeys.byNid(nid ?? '', cycleId ?? ''),
    queryFn: () => gradesService.findByNationalId(nid!, cycleId!),
    enabled: Boolean(nid && cycleId) && (options.enabled ?? true),
    retry: false,
  });
}

export function useClearGrades() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => gradesService.clearAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: gradesKeys.all }),
  });
}

export function useDeleteGrades() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (seats: readonly number[]) => gradesService.deleteRows(seats),
    onSuccess: () => qc.invalidateQueries({ queryKey: gradesKeys.all }),
  });
}

export function useAddAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      seat: number;
      reason: AdjustmentReason;
      note: string | null;
      amount: number;
      isActive: boolean;
      by: string;
    }) =>
      gradesService.addAdjustment(input.seat, {
        reason: input.reason,
        note: input.note,
        amount: input.amount,
        isActive: input.isActive,
        by: input.by,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: gradesKeys.all }),
  });
}

export function useToggleAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { seat: number; entryId: string; isActive: boolean }) =>
      gradesService.toggleAdjustment(input.seat, input.entryId, input.isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: gradesKeys.all }),
  });
}

export function useDeleteAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { seat: number; entryId: string }) =>
      gradesService.deleteAdjustment(input.seat, input.entryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: gradesKeys.all }),
  });
}

export function useUpdateOverrideMax() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { seat: number; overrideMax: number | null; by: string }) =>
      gradesService.updateOverrideMax(input.seat, input.overrideMax, input.by),
    onSuccess: () => qc.invalidateQueries({ queryKey: gradesKeys.all }),
  });
}

export function useStageImport() {
  return useMutation({
    mutationFn: (input: {
      kind: 'general' | 'azhar';
      maxDegree: number;
      rows: ImportedGradeRow[];
    }) => gradesService.stageImport(input),
  });
}

export function useCommitImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { staged: StagedImport; resolutions: Record<string, ImportResolution> }) =>
      gradesService.commitImport(input.staged, input.resolutions),
    onSuccess: (_result: CommittedImport) => {
      qc.invalidateQueries({ queryKey: gradesKeys.all });
    },
  });
}

/* ── Import wizard v2 ─────────────────────────────────────────────── */

export function useApplicantGradesPreflight() {
  return useMutation({
    mutationFn: (input: {
      rows: NormalisedRow[];
      graduationYear: number;
      onProgress?: (progress: ImportPreflightProgress) => void;
    }): Promise<ImportReport> =>
      gradesService.runImportPreflight(input),
  });
}

export function useApplicantGradesCommit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      rows: NormalisedRow[];
      graduationYear: number;
      /** Lookup codes (from `school-categories`) the admin selected on
       *  Step 1 — used to constrain which rows the commit accepts and
       *  to derive each row's GradeKind. */
      selectedSchoolCategories: string[];
      /** Per-category الدرجة العظمى keyed by lookup code. The commit
       *  reads `maxGradeByCategory[row.schoolCategoryCode]` to gate the
       *  totalGrade range check and to seed `importMax`. */
      maxGradeByCategory: Record<string, number>;
      perGroupActions: Record<ImportGroupCode, ImportGroupAction | undefined>;
      /** Per-NID decisions from the diff-review step. Overrides the
       *  per-group DUPLICATE_NID action for the matching nids. */
      existingDiffDecisions?: Record<string, 'accept' | 'reject' | 'pending'>;
      /** Per-NID resolutions for intra-upload duplicate-NID cases —
       *  same NID appearing on two or more rows of the same file. */
      uploadDuplicateDecisions?: Record<
        string,
        | { action: 'pick-higher' }
        | { action: 'pick-lower' }
        | { action: 'pick-specific'; pickedTotal: number }
        | { action: 'pick-row'; pickedSourceRowIndex: number }
        | { action: 'reject' }
      >;
      onProgress?: (progress: ImportCommitProgress) => void;
    }): Promise<ImportCommitResult> => gradesService.runImportCommit(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: gradesKeys.all });
    },
  });
}

/* ── Paginated list (v2) ─────────────────────────────────────────── */

export function useApplicantGradesList(input: PaginatedGradesParams) {
  return useQuery({
    queryKey: gradesKeys.paginated(input),
    queryFn: () => gradesService.listPaginated(input),
    placeholderData: (prev) => prev,
  });
}
