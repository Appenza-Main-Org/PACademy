import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lookupsService, type LookupListOpts } from './lookups.service';
import type { LookupKey, LookupRow } from '@/shared/types/domain';

export const lookupsKeys = {
  all: ['lookups'] as const,
  list: (key: LookupKey, opts?: LookupListOpts) => [...lookupsKeys.all, key, opts ?? null] as const,
  dependencies: (key: LookupKey, id: string) =>
    [...lookupsKeys.all, key, 'dep', id] as const,
};

export function useLookupList(key: LookupKey, opts: LookupListOpts = {}) {
  return useQuery({
    queryKey: lookupsKeys.list(key, opts),
    queryFn: () => lookupsService.list(key, opts),
  });
}

export function useLookupDependencies(key: LookupKey, id: string | null) {
  return useQuery({
    queryKey: lookupsKeys.dependencies(key, id ?? ''),
    queryFn: () => lookupsService.getDependencies(key, id!),
    enabled: Boolean(id),
  });
}

export function useLookupCreate(key: LookupKey) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<LookupRow, 'id' | 'isSystem'>) => lookupsService.create(key, payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...lookupsKeys.all, key] }),
  });
}

export function useLookupUpdate(key: LookupKey) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Omit<LookupRow, 'id' | 'isSystem'>> }) =>
      lookupsService.update(key, id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...lookupsKeys.all, key] }),
  });
}

export function useLookupSetActive(key: LookupKey) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      lookupsService.setActive(key, id, isActive),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...lookupsKeys.all, key] }),
  });
}

export function useLookupReorder(key: LookupKey) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => lookupsService.reorder(key, orderedIds),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...lookupsKeys.all, key] }),
  });
}

export function useLookupSoftDelete(key: LookupKey) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => lookupsService.softDelete(key, id, reason),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...lookupsKeys.all, key] }),
  });
}

export function useLookupRestore(key: LookupKey) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => lookupsService.restore(key, id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...lookupsKeys.all, key] }),
  });
}
