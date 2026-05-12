/**
 * TanStack Query bindings for `committeeBindingService`.
 *
 * Query keys carry `(cycleId, applicantCategoryId)` so the bindings
 * sub-tab's per-category view re-fetches without manual invalidation
 * when the active category tab changes. Mutations invalidate just the
 * affected (cycle, category) pair plus the cycle-level aggregate that
 * drives the completion gate.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { toast } from '@/shared/components';
import { isConflictError } from '@/shared/lib/errors';
import { committeeBindingService } from './committeeBinding.service';
import type {
  BindingConflict,
  CommitteeDayBinding,
} from '../types';

export const committeeBindingKeys = {
  all: ['committee-bindings'] as const,
  list: (
    cycleId: string | null,
    applicantCategoryId: string | null,
  ) =>
    [
      ...committeeBindingKeys.all,
      'list',
      cycleId,
      applicantCategoryId,
    ] as const,
  cycle: (cycleId: string | null) =>
    [...committeeBindingKeys.all, 'cycle', cycleId] as const,
};

function invalidatePair(
  qc: QueryClient,
  cycleId: string,
  applicantCategoryId: string,
): void {
  qc.invalidateQueries({
    queryKey: committeeBindingKeys.list(cycleId, applicantCategoryId),
  });
  qc.invalidateQueries({
    queryKey: committeeBindingKeys.cycle(cycleId),
  });
}

const CONFLICT_MESSAGES_AR: Record<BindingConflict, string> = {
  DUPLICATE_BINDING: 'اللجنة مربوطة بالفعل بهذا اليوم',
  CAPACITY_NOT_POSITIVE: 'السعة يجب أن تكون أكبر من صفر',
  GRADE_RANGE_INVERTED: 'الحد الأدنى يجب أن يكون أقل من أو يساوي الحد الأقصى',
  PERCENTAGE_OUT_OF_RANGE: 'الدرجة المئوية يجب أن تكون بين 0 و 100',
  TAGDIR_GRADE_NOT_FOUND: 'التقدير المختار غير موجود',
  MODE_MISMATCH: 'نمط الأهلية لا يطابق نوع تقديم الفئة',
  DAY_NOT_WORKING: 'لا يمكن الربط بيوم عطلة',
  COMMITTEE_WRONG_CATEGORY: 'اللجنة تنتمي إلى فئة أخرى',
};

function surfaceError(err: unknown, fallback = 'تعذّر تنفيذ العملية'): void {
  if (isConflictError(err)) {
    const code = err.conflictCode as BindingConflict;
    const msg = CONFLICT_MESSAGES_AR[code] ?? `خطأ: ${code}`;
    toast(msg, 'danger');
    return;
  }
  toast(fallback, 'danger');
}

/* ── Reads ───────────────────────────────────────────────────────────── */

export function useCommitteeDayBindings(
  cycleId: string | null,
  applicantCategoryId: string | null,
) {
  return useQuery<CommitteeDayBinding[]>({
    queryKey: committeeBindingKeys.list(cycleId, applicantCategoryId),
    queryFn: () => {
      if (!cycleId || !applicantCategoryId) return Promise.resolve([]);
      return committeeBindingService.list({
        cycleId,
        applicantCategoryId,
      });
    },
    enabled: Boolean(cycleId && applicantCategoryId),
  });
}

export function useCycleCommitteeBindings(cycleId: string | null) {
  return useQuery<CommitteeDayBinding[]>({
    queryKey: committeeBindingKeys.cycle(cycleId),
    queryFn: () => {
      if (!cycleId) return Promise.resolve([]);
      return committeeBindingService.list({ cycleId });
    },
    enabled: Boolean(cycleId),
  });
}

/* ── Mutations ──────────────────────────────────────────────────────── */

export function useCreateBinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: committeeBindingService.create,
    onSuccess: (row) => invalidatePair(qc, row.cycleId, row.applicantCategoryId),
    onError: (err) => surfaceError(err),
  });
}

export function useUpdateBinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      cycleId: string;
      applicantCategoryId: string;
      patch: Parameters<typeof committeeBindingService.update>[1];
    }) => committeeBindingService.update(input.id, input.patch),
    onSuccess: (_row, vars) =>
      invalidatePair(qc, vars.cycleId, vars.applicantCategoryId),
    onError: (err) => surfaceError(err),
  });
}

export function useDeleteBinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      cycleId: string;
      applicantCategoryId: string;
    }) => committeeBindingService.delete(input.id),
    onSuccess: (_res, vars) =>
      invalidatePair(qc, vars.cycleId, vars.applicantCategoryId),
    onError: (err) => surfaceError(err),
  });
}

export function useToggleBindingActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      cycleId: string;
      applicantCategoryId: string;
    }) => committeeBindingService.toggleActive(input.id),
    onSuccess: (_res, vars) =>
      invalidatePair(qc, vars.cycleId, vars.applicantCategoryId),
    onError: (err) => surfaceError(err),
  });
}

export function useBulkSetEligibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: committeeBindingService.bulkSetEligibility,
    onSuccess: (_res, vars) =>
      invalidatePair(qc, vars.cycleId, vars.applicantCategoryId),
    onError: (err) => surfaceError(err),
  });
}

export function useCopyRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: committeeBindingService.copyRow,
    onSuccess: (_res, vars) =>
      invalidatePair(qc, vars.cycleId, vars.applicantCategoryId),
    onError: (err) => surfaceError(err),
  });
}

export function useCopyColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: committeeBindingService.copyColumn,
    onSuccess: (_res, vars) =>
      invalidatePair(qc, vars.cycleId, vars.applicantCategoryId),
    onError: (err) => surfaceError(err),
  });
}
