import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { committeeService, type CommitteePayload } from './committee.service';

export const committeeKeys = {
  all: ['committees'] as const,
  list: () => [...committeeKeys.all, 'list'] as const,
  detail: (id: string) => [...committeeKeys.all, 'detail', id] as const,
  queue: (id: string) => [...committeeKeys.all, 'queue', id] as const,
  results: (id: string) => [...committeeKeys.all, 'results', id] as const,
};

export const useCommittees = () =>
  useQuery({ queryKey: committeeKeys.list(), queryFn: () => committeeService.list() });

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
