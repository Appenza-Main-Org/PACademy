import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { referenceDataService } from './referenceData.service';
import type { ReferenceRowMap, ReferenceTab } from '@/shared/types/domain';

export const referenceDataKeys = {
  all: ['reference-data'] as const,
  list: (tab: ReferenceTab, opts?: { includeDeleted?: boolean }) =>
    [...referenceDataKeys.all, tab, opts ?? null] as const,
};

export function useReferenceData<K extends ReferenceTab>(
  tab: K,
  opts: { includeDeleted?: boolean } = {},
) {
  return useQuery({
    queryKey: referenceDataKeys.list(tab, opts),
    queryFn: () => referenceDataService.list(tab, opts),
  });
}

export function useReferenceCreate<K extends ReferenceTab>(tab: K) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<ReferenceRowMap[K], 'id'>) => referenceDataService.create(tab, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: referenceDataKeys.list(tab) });
    },
  });
}

export function useReferenceUpdate<K extends ReferenceTab>(tab: K) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ReferenceRowMap[K]> }) =>
      referenceDataService.update(tab, id, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: referenceDataKeys.list(tab) });
    },
  });
}

export function useReferenceRemove<K extends ReferenceTab>(tab: K) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => referenceDataService.remove(tab, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...referenceDataKeys.all, tab] });
    },
  });
}

export function useReferenceSoftDelete<K extends ReferenceTab>(tab: K) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      referenceDataService.softDelete(tab, id, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...referenceDataKeys.all, tab] });
    },
  });
}

export function useReferenceRestore<K extends ReferenceTab>(tab: K) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => referenceDataService.restore(tab, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...referenceDataKeys.all, tab] });
    },
  });
}
