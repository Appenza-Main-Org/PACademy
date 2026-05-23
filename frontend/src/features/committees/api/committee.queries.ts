import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { committeeService, type CommitteePayload } from './committee.service';
import type {
  Committee,
  CommitteeStatus,
} from '@/shared/types/domain';

export const scheduleKeys = {
  all: ['committee-schedule'] as const,
  byCategory: (key: string) =>
    [...scheduleKeys.all, 'by-category', key] as const,
};

export const committeeKeys = {
  all: ['committees'] as const,
  list: (opts?: { includeDeleted?: boolean }) =>
    [...committeeKeys.all, 'list', opts ?? null] as const,
  detail: (id: string) => [...committeeKeys.all, 'detail', id] as const,
  queue: (id: string) => [...committeeKeys.all, 'queue', id] as const,
  results: (id: string) => [...committeeKeys.all, 'results', id] as const,
  dependencies: (id: string) => [...committeeKeys.all, 'dependencies', id] as const,
  eligibleOfficers: () => [...committeeKeys.all, 'eligible-officers'] as const,
  specializations: () => [...committeeKeys.all, 'specializations'] as const,
  educationTypes: () => [...committeeKeys.all, 'education-types'] as const,
  assigned: (id: string) => [...committeeKeys.all, 'assigned', id] as const,
};

export const useCommittees = (opts: { includeDeleted?: boolean } = {}) =>
  useQuery({ queryKey: committeeKeys.list(opts), queryFn: () => committeeService.list(opts) });

export const useCommitteeDependencies = (id: string | null) =>
  useQuery({
    queryKey: committeeKeys.dependencies(id ?? ''),
    queryFn: () => committeeService.getDependencies(id!),
    enabled: Boolean(id),
  });

export const useCommitteeSoftDelete = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      committeeService.softDelete(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: committeeKeys.all }),
  });
};

export const useCommitteeRestore = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => committeeService.restore(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: committeeKeys.all }),
  });
};

export const useCommittee = (id: string | null) =>
  useQuery({
    queryKey: committeeKeys.detail(id ?? ''),
    queryFn: () => committeeService.getById(id!),
    enabled: Boolean(id),
  });

export const useCommitteeQueue = (id: string | null) =>
  useQuery({
    queryKey: committeeKeys.queue(id ?? ''),
    queryFn: () => committeeService.getDailyQueue(id!),
    enabled: Boolean(id),
  });

export const useCommitteeResults = (id: string | null) =>
  useQuery({
    queryKey: committeeKeys.results(id ?? ''),
    queryFn: () => committeeService.listResults(id!),
    enabled: Boolean(id),
  });

export const useCreateCommittee = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CommitteePayload) => committeeService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: committeeKeys.list() }),
  });
};

export const useEnterResult = (committeeId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof committeeService.enterResult>[1]) =>
      committeeService.enterResult(committeeId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: committeeKeys.results(committeeId) }),
  });
};

export const useApproveResults = (committeeId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (resultIds: string[]) => committeeService.approveResults(committeeId, resultIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: committeeKeys.results(committeeId) }),
  });
};

export const useRejectResult = (committeeId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ resultId, reason }: { resultId: string; reason: string }) =>
      committeeService.rejectResult(resultId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: committeeKeys.results(committeeId) }),
  });
};

export const useBulkUploadResults = (committeeId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: Record<string, unknown>[]) => committeeService.bulkUploadResults(committeeId, rows),
    onSuccess: () => qc.invalidateQueries({ queryKey: committeeKeys.results(committeeId) }),
  });
};

export const useCommitteeUpdate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Committee> }) =>
      committeeService.update(id, patch),
    onMutate: async ({ id, patch }) => {
      /* Optimistic — apply the patch to every cached committee shape
       * before the mutation resolves so the row in the list and the
       * detail card reflect the new values instantly. Rollback on
       * error from the captured snapshot. */
      await qc.cancelQueries({ queryKey: committeeKeys.all });
      const listSnapshots = qc.getQueriesData<Committee[]>({
        queryKey: committeeKeys.all,
      });
      const detailSnapshot = qc.getQueryData<Committee>(committeeKeys.detail(id));
      qc.setQueriesData<Committee[] | undefined>(
        { queryKey: committeeKeys.all },
        (rows) => (Array.isArray(rows) ? rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) : rows),
      );
      if (detailSnapshot) {
        qc.setQueryData<Committee>(committeeKeys.detail(id), {
          ...detailSnapshot,
          ...patch,
        });
      }
      return { listSnapshots, detailSnapshot };
    },
    onError: (_err, { id }, context) => {
      const ctx = context as
        | { listSnapshots: ReturnType<typeof qc.getQueriesData<Committee[]>>; detailSnapshot: Committee | undefined }
        | undefined;
      if (!ctx) return;
      for (const [key, snapshot] of ctx.listSnapshots) {
        qc.setQueryData(key, snapshot);
      }
      if (ctx.detailSnapshot) {
        qc.setQueryData(committeeKeys.detail(id), ctx.detailSnapshot);
      }
    },
    onSettled: (committee) => {
      qc.invalidateQueries({ queryKey: committeeKeys.list() });
      if (committee) qc.invalidateQueries({ queryKey: committeeKeys.detail(committee.id) });
    },
  });
};

export const useCommitteeScheduleSlot = (committeeId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { applicantId: string; dateIso: string }) =>
      committeeService.scheduleSlot(committeeId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: committeeKeys.queue(committeeId) }),
  });
};

export const useEligibleOfficers = () =>
  useQuery({
    queryKey: committeeKeys.eligibleOfficers(),
    queryFn: () => committeeService.getEligibleOfficers(),
  });

export const useCommitteeSpecializations = () =>
  useQuery({
    queryKey: committeeKeys.specializations(),
    queryFn: () => committeeService.listSpecializations(),
  });

export const useCommitteeEducationTypes = () =>
  useQuery({
    queryKey: committeeKeys.educationTypes(),
    queryFn: () => committeeService.listEducationTypes(),
  });

export const useCommitteeAssignedApplicants = (id: string | null) =>
  useQuery({
    queryKey: committeeKeys.assigned(id ?? ''),
    queryFn: () => committeeService.getAssignedApplicants(id!),
    enabled: Boolean(id),
  });

export const useCommitteeSetStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: CommitteeStatus }) =>
      committeeService.setStatus(id, status),
    onSuccess: (committee) => {
      qc.invalidateQueries({ queryKey: committeeKeys.list() });
      qc.invalidateQueries({ queryKey: committeeKeys.detail(committee.id) });
    },
  });
};

/* ── Exam-date schedule (per-(committee × date) seat capacity) ─────── */

export const useScheduleByCategory = (key: string) =>
  useQuery({
    queryKey: scheduleKeys.byCategory(key),
    queryFn: () => committeeService.listSchedule(key),
  });

export const useAddScheduleBatchMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: committeeService.addScheduleBatch,
    onSuccess: (_rows, vars) => {
      qc.invalidateQueries({ queryKey: scheduleKeys.byCategory(vars.categoryKey) });
    },
  });
};

export const useAddScheduleEntriesMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: committeeService.addScheduleEntries,
    onSuccess: (_rows, vars) => {
      const cats = new Set(vars.map((v) => v.categoryKey));
      for (const cat of cats) {
        qc.invalidateQueries({ queryKey: scheduleKeys.byCategory(cat) });
      }
    },
  });
};

export const useRemoveScheduleEntryMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; categoryKey: string }) =>
      committeeService.removeScheduleEntry(input.id),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: scheduleKeys.byCategory(vars.categoryKey) });
    },
  });
};

export const useUpdateScheduleEntryMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      categoryKey: string;
      patch: Parameters<typeof committeeService.updateScheduleEntry>[1];
    }) => committeeService.updateScheduleEntry(input.id, input.patch),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: scheduleKeys.byCategory(vars.categoryKey) });
    },
  });
};
