/**
 * Committee Instances — TanStack Query bindings.
 *
 * The `/admin/committees-exam-config` management page consumes these
 * query keys for add/edit/delete/transfer flows.
 */

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  committeeInstanceService,
  type CommitteeInstanceAddInput,
  type CommitteeInstanceListFilters,
  type CommitteeInstancePatch,
  type TransferCapacityMode,
} from './committeeInstance.service';
import type { CommitteeInstance } from '@/shared/types/domain';

export const committeeInstanceKeys = {
  all: ['committee-instances'] as const,
  list: (filters: CommitteeInstanceListFilters) =>
    [...committeeInstanceKeys.all, 'list', filters] as const,
};

function upsertCommitteeInstancesInCache(
  qc: QueryClient,
  rows: ReadonlyArray<CommitteeInstance>,
): void {
  if (rows.length === 0) return;
  const byId = new Map(rows.map((row) => [row.id, row]));
  qc.setQueriesData<CommitteeInstance[]>(
    { queryKey: committeeInstanceKeys.all },
    (current) => {
      if (!current) return current;
      let changed = false;
      const next = current.map((row) => {
        const replacement = byId.get(row.id);
        if (!replacement) return row;
        changed = true;
        return replacement;
      });
      return changed ? next : current;
    },
  );
}

function removeCommitteeInstanceFromCache(qc: QueryClient, id: string): void {
  qc.setQueriesData<CommitteeInstance[]>(
    { queryKey: committeeInstanceKeys.all },
    (current) => current?.filter((row) => row.id !== id),
  );
}

export function useCommitteeInstances(
  filters: CommitteeInstanceListFilters = {},
) {
  return useQuery<CommitteeInstance[]>({
    queryKey: committeeInstanceKeys.list(filters),
    queryFn: () => committeeInstanceService.list(filters),
    refetchInterval: 10_000,
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
    onSuccess: (row) => {
      upsertCommitteeInstancesInCache(qc, [row]);
      qc.invalidateQueries({ queryKey: committeeInstanceKeys.all });
    },
  });
}

export function useRemoveCommitteeInstanceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => committeeInstanceService.remove(id),
    onSuccess: (_result, id) => {
      removeCommitteeInstanceFromCache(qc, id);
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
    mutationFn: (input: {
      cycleId: string;
      fromDate: string;
      toDate: string;
      mode?: TransferCapacityMode;
      /** Optional per-destination capacity bumps applied atomically with
       *  the transfer — surfaced by the UI's capacity-conflict popup. */
      capacityOverrides?: Record<string, number>;
    }) => committeeInstanceService.transferDay(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: committeeInstanceKeys.all });
    },
  });
}

export function useTransferCommitteeInstanceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      toDate: string;
      mode?: TransferCapacityMode;
      capacityOverrides?: Record<string, number>;
    }) => committeeInstanceService.transferOne(input),
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
    onSuccess: (rows) => {
      upsertCommitteeInstancesInCache(qc, rows);
      qc.invalidateQueries({ queryKey: committeeInstanceKeys.all });
    },
  });
}
