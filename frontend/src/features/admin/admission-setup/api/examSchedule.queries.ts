/**
 * TanStack Query bindings for `examScheduleService`.
 *
 * Query keys carry `(cycleId, applicantCategoryId)` — switching tabs
 * swaps the active query without manual invalidation. Mutations
 * invalidate just the affected (cycle, category) pair.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { toast } from '@/shared/components';
import { isConflictError } from '@/shared/lib/errors';
import { examScheduleService } from './examSchedule.service';
import type {
  ExamScheduleConflict,
  ExamScheduleDay,
  DayKind,
} from '../types';

export const examScheduleKeys = {
  all: ['exam-schedule'] as const,
  days: (cycleId: string | null, applicantCategoryId: string | null) =>
    [...examScheduleKeys.all, 'days', cycleId, applicantCategoryId] as const,
  aggregate: (cycleId: string | null) =>
    [...examScheduleKeys.all, 'aggregate', cycleId] as const,
};

function invalidatePair(
  qc: QueryClient,
  cycleId: string,
  applicantCategoryId: string,
): void {
  qc.invalidateQueries({
    queryKey: examScheduleKeys.days(cycleId, applicantCategoryId),
  });
  qc.invalidateQueries({
    queryKey: examScheduleKeys.aggregate(cycleId),
  });
}

const CONFLICT_MESSAGES_AR: Record<ExamScheduleConflict, string> = {
  DUPLICATE_DATE: 'يوجد يوم مسجل بالفعل في هذا التاريخ للفئة الحالية',
  DATE_OUT_OF_CYCLE_WINDOW: 'التاريخ خارج نطاق الدورة',
  INVALID_DATE_RANGE: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية',
  CATEGORY_NOT_ACTIVE: 'هذه الفئة غير مفعّلة في إعدادات الدورة',
};

function surfaceError(err: unknown, fallback = 'تعذّر تنفيذ العملية'): void {
  if (isConflictError(err)) {
    const code = err.conflictCode as ExamScheduleConflict;
    const msg = CONFLICT_MESSAGES_AR[code] ?? `خطأ: ${code}`;
    toast(msg, 'danger');
    return;
  }
  toast(fallback, 'danger');
}

/* ── Reads ───────────────────────────────────────────────────────────── */

export function useExamScheduleDays(
  cycleId: string | null,
  applicantCategoryId: string | null,
) {
  return useQuery<ExamScheduleDay[]>({
    queryKey: examScheduleKeys.days(cycleId, applicantCategoryId),
    queryFn: () => {
      if (!cycleId || !applicantCategoryId) return Promise.resolve([]);
      return examScheduleService.listDays(cycleId, applicantCategoryId);
    },
    enabled: Boolean(cycleId && applicantCategoryId),
  });
}

export interface ExamScheduleAggregate {
  activeCategoryIds: string[];
  days: ExamScheduleDay[];
}

export function useExamScheduleAggregate(cycleId: string | null) {
  return useQuery<ExamScheduleAggregate>({
    queryKey: examScheduleKeys.aggregate(cycleId),
    queryFn: () => {
      if (!cycleId)
        return Promise.resolve({ activeCategoryIds: [], days: [] });
      return examScheduleService.aggregateForCycle(cycleId);
    },
    enabled: Boolean(cycleId),
  });
}

/* ── Mutations ──────────────────────────────────────────────────────── */

export function useGenerateBulkDays() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: examScheduleService.generateBulk,
    onSuccess: (_res, vars) => invalidatePair(qc, vars.cycleId, vars.applicantCategoryId),
    onError: (err) => surfaceError(err),
  });
}

export function useAddDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      cycleId: string;
      applicantCategoryId: string;
      date: string;
      kind: DayKind;
      note: string | null;
    }) =>
      examScheduleService.addDay(input.cycleId, input.applicantCategoryId, {
        date: input.date,
        kind: input.kind,
        note: input.note,
      }),
    onSuccess: (_res, vars) => invalidatePair(qc, vars.cycleId, vars.applicantCategoryId),
    onError: (err) => surfaceError(err),
  });
}

export function useUpdateDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      dayId: string;
      cycleId: string;
      applicantCategoryId: string;
      patch: Partial<Pick<ExamScheduleDay, 'date' | 'kind' | 'note'>>;
    }) => examScheduleService.updateDay(input.dayId, input.patch),
    onSuccess: (_res, vars) => invalidatePair(qc, vars.cycleId, vars.applicantCategoryId),
    onError: (err) => surfaceError(err),
  });
}

export function useDeleteDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      dayId: string;
      cycleId: string;
      applicantCategoryId: string;
    }) => examScheduleService.deleteDay(input.dayId),
    onSuccess: (_res, vars) => invalidatePair(qc, vars.cycleId, vars.applicantCategoryId),
    onError: (err) => surfaceError(err),
  });
}

export function useToggleDayOff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      dayId: string;
      cycleId: string;
      applicantCategoryId: string;
    }) => examScheduleService.toggleOff(input.dayId),
    onSuccess: (_res, vars) => invalidatePair(qc, vars.cycleId, vars.applicantCategoryId),
    onError: (err) => surfaceError(err),
  });
}

export function useClearDayRange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      cycleId: string;
      applicantCategoryId: string;
      startDate: string;
      endDate: string;
    }) =>
      examScheduleService.clearRange(
        input.cycleId,
        input.applicantCategoryId,
        input.startDate,
        input.endDate,
      ),
    onSuccess: (_res, vars) => invalidatePair(qc, vars.cycleId, vars.applicantCategoryId),
    onError: (err) => surfaceError(err),
  });
}

export function useCopyScheduleFromCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: examScheduleService.copyFromCategory,
    onSuccess: (_res, vars) => {
      invalidatePair(qc, vars.cycleId, vars.targetCategoryId);
      invalidatePair(qc, vars.cycleId, vars.sourceCategoryId);
    },
    onError: (err) => surfaceError(err),
  });
}
