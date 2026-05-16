/**
 * TanStack Query hooks wrapping `gradesService`. The only thing that has
 * to change when the real backend lands is the body of the service
 * methods — every component below this layer keeps its contract.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gradesService } from './grades.service';
import type { ImportedGradeRow } from '../lib/parseAccessFile';
import type {
  AdjustmentReason,
  CommittedImport,
  GradeRow,
  ImportCommitResult,
  ImportGroupAction,
  ImportGroupCode,
  ImportReport,
  ImportResolution,
  NormalisedRow,
  StagedImport,
} from '../types';

export const gradesKeys = {
  all: ['applicant-grades'] as const,
  list: () => [...gradesKeys.all, 'list'] as const,
  paginated: (params: {
    page: number;
    pageSize: number;
    search: string;
    sort?: { key: keyof GradeRow; direction: 'asc' | 'desc' } | null;
  }) => [...gradesKeys.all, 'paginated', params] as const,
};

export function useGrades() {
  return useQuery({
    queryKey: gradesKeys.list(),
    queryFn: () => gradesService.list(),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: gradesKeys.list() }),
  });
}

export function useToggleAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { seat: number; entryId: string }) =>
      gradesService.toggleAdjustment(input.seat, input.entryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: gradesKeys.list() }),
  });
}

export function useDeleteAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { seat: number; entryId: string }) =>
      gradesService.deleteAdjustment(input.seat, input.entryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: gradesKeys.list() }),
  });
}

export function useUpdateOverrideMax() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { seat: number; overrideMax: number | null; by: string }) =>
      gradesService.updateOverrideMax(input.seat, input.overrideMax, input.by),
    onSuccess: () => qc.invalidateQueries({ queryKey: gradesKeys.list() }),
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
      qc.invalidateQueries({ queryKey: gradesKeys.list() });
    },
  });
}

/* ── Import wizard v2 ─────────────────────────────────────────────── */

export function useApplicantGradesPreflight() {
  return useMutation({
    mutationFn: (input: { rows: NormalisedRow[]; graduationYear: number }): Promise<ImportReport> =>
      gradesService.runImportPreflight(input),
  });
}

export function useApplicantGradesCommit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      rows: NormalisedRow[];
      graduationYear: number;
      perGroupActions: Record<ImportGroupCode, ImportGroupAction | undefined>;
    }): Promise<ImportCommitResult> => gradesService.runImportCommit(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: gradesKeys.all });
    },
  });
}

/* ── Paginated list (v2) ─────────────────────────────────────────── */

export function useApplicantGradesList(input: {
  page: number;
  pageSize: number;
  search: string;
  sort?: { key: keyof GradeRow; direction: 'asc' | 'desc' } | null;
}) {
  return useQuery({
    queryKey: gradesKeys.paginated(input),
    queryFn: () => gradesService.listPaginated(input),
    placeholderData: (prev) => prev,
  });
}
