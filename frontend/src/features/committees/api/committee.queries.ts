import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { committeeService, type CommitteePayload } from './committee.service';
import type { Committee, CommitteeStatus } from '@/shared/types/domain';

export const committeeKeys = {
  all: ['committees'] as const,
  list: (opts?: { includeDeleted?: boolean; cycleId?: string }) =>
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

/**
 * Lists committees. When `cycleId` is provided, hits the real backend
 * (`GET /admin/committees?cycleId=...`). Without cycleId, falls back to
 * the legacy mock state — used by the committees overview page.
 */
export const useCommittees = (
  opts: { includeDeleted?: boolean; cycleId?: string } = {},
) =>
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
    onSuccess: () => void qc.invalidateQueries({ queryKey: committeeKeys.list() }),
  });
};

export const useEnterResult = (committeeId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof committeeService.enterResult>[1]) =>
      committeeService.enterResult(committeeId, payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: committeeKeys.results(committeeId) }),
  });
};

export const useApproveResults = (committeeId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (resultIds: string[]) => committeeService.approveResults(committeeId, resultIds),
    onSuccess: () => void qc.invalidateQueries({ queryKey: committeeKeys.results(committeeId) }),
  });
};

export const useRejectResult = (committeeId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ resultId, reason }: { resultId: string; reason: string }) =>
      committeeService.rejectResult(resultId, reason),
    onSuccess: () => void qc.invalidateQueries({ queryKey: committeeKeys.results(committeeId) }),
  });
};

export const useBulkUploadResults = (committeeId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: Record<string, unknown>[]) => committeeService.bulkUploadResults(committeeId, rows),
    onSuccess: () => void qc.invalidateQueries({ queryKey: committeeKeys.results(committeeId) }),
  });
};

export const useCommitteeUpdate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Committee> }) =>
      committeeService.update(id, patch),
    onSuccess: (committee) => {
      void qc.invalidateQueries({ queryKey: committeeKeys.list() });
      void qc.invalidateQueries({ queryKey: committeeKeys.detail(committee.id) });
    },
  });
};

export const useCommitteeScheduleSlot = (committeeId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { applicantId: string; dateIso: string }) =>
      committeeService.scheduleSlot(committeeId, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: committeeKeys.queue(committeeId) }),
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
