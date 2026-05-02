import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { referenceDataService } from './referenceData.service';
import type { ReferenceRowMap, ReferenceTab } from '@/shared/types/domain';

export const referenceDataKeys = {
  all: ['reference-data'] as const,
  list: (tab: ReferenceTab) => [...referenceDataKeys.all, tab] as const,
};

export function useReferenceData<K extends ReferenceTab>(tab: K) {
  return useQuery({
    queryKey: referenceDataKeys.list(tab),
    queryFn: () => referenceDataService.list(tab),
  });
}

export function useReferenceCreate<K extends ReferenceTab>(tab: K) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<ReferenceRowMap[K], 'id'>) => referenceDataService.create(tab, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: referenceDataKeys.list(tab) });
    },
  });
}

export function useReferenceUpdate<K extends ReferenceTab>(tab: K) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ReferenceRowMap[K]> }) =>
      referenceDataService.update(tab, id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: referenceDataKeys.list(tab) });
    },
  });
}

export function useReferenceRemove<K extends ReferenceTab>(tab: K) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => referenceDataService.remove(tab, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: referenceDataKeys.list(tab) });
    },
  });
}
