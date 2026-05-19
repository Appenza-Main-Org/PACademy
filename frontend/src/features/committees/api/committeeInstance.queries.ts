/**
 * Committee Instances — TanStack Query bindings.
 *
 * Both the admission-setup wizard step (`/admin/cycles/admission-setup/wizard/committees`)
 * and the new management page (`/admin/committees-exam-config`) consume the same
 * query keys so mutations on one surface reactively refresh the other.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  committeeInstanceService,
  type CommitteeInstanceAddInput,
  type CommitteeInstanceListFilters,
  type CommitteeInstancePatch,
} from './committeeInstance.service';
import type { CommitteeInstance } from '@/shared/types/domain';

export const committeeInstanceKeys = {
  all: ['committee-instances'] as const,
  list: (filters: CommitteeInstanceListFilters) =>
    [...committeeInstanceKeys.all, 'list', filters] as const,
};

export function useCommitteeInstances(
  filters: CommitteeInstanceListFilters = {},
) {
  return useQuery<CommitteeInstance[]>({
    queryKey: committeeInstanceKeys.list(filters),
    queryFn: () => committeeInstanceService.list(filters),
  });
}

export function useAddCommitteeInstancesMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReadonlyArray<CommitteeInstanceAddInput>) =>
      committeeInstanceService.addMany(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: committeeInstanceKeys.all });
    },
  });
}

export function useUpdateCommitteeInstanceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; patch: CommitteeInstancePatch }) =>
      committeeInstanceService.update(input.id, input.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: committeeInstanceKeys.all });
    },
  });
}

export function useRemoveCommitteeInstanceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => committeeInstanceService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: committeeInstanceKeys.all });
    },
  });
}

export function useRemoveCommitteeInstanceDayMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { cycleId: string; date: string }) =>
      committeeInstanceService.removeDay(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: committeeInstanceKeys.all });
    },
  });
}

export function useTransferCommitteeInstanceDayMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { cycleId: string; fromDate: string; toDate: string }) =>
      committeeInstanceService.transferDay(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: committeeInstanceKeys.all });
    },
  });
}

export function useRefreshReservedCountsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filters: CommitteeInstanceListFilters = {}) =>
      committeeInstanceService.refreshReservedCounts(filters),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: committeeInstanceKeys.all });
    },
  });
}
