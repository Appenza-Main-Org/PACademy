import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cyclesService } from './cycles.service';
import type { AdmissionCycle, CycleStatus } from '@/shared/types/domain';

export const cyclesKeys = {
  all: ['cycles'] as const,
  list: () => [...cyclesKeys.all, 'list'] as const,
  detail: (id: string) => [...cyclesKeys.all, 'detail', id] as const,
};

export function useCycles() {
  return useQuery({ queryKey: cyclesKeys.list(), queryFn: () => cyclesService.list() });
}

export function useCycle(id: string | null) {
  return useQuery({
    queryKey: cyclesKeys.detail(id ?? ''),
    queryFn: () => cyclesService.getById(id!),
    enabled: Boolean(id),
  });
}

export function useCycleClone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cyclesService.clone(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: cyclesKeys.list() }),
  });
}

export function useCycleTransition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, next }: { id: string; next: CycleStatus }) => cyclesService.transition(id, next),
    onSuccess: (cycle: AdmissionCycle) => {
      qc.invalidateQueries({ queryKey: cyclesKeys.list() });
      qc.invalidateQueries({ queryKey: cyclesKeys.detail(cycle.id) });
    },
  });
}

export function useCycleUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<AdmissionCycle> }) =>
      cyclesService.update(id, patch),
    onSuccess: (cycle: AdmissionCycle) => {
      qc.invalidateQueries({ queryKey: cyclesKeys.list() });
      qc.invalidateQueries({ queryKey: cyclesKeys.detail(cycle.id) });
    },
  });
}
