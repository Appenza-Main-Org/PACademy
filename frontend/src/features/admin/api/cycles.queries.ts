import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cyclesService } from './cycles.service';
import { noServerStateCacheOptions } from '@/shared/lib/query-options';

/**
 * Cycle queries used by the admission-setup wizard get a longer stale
 * window than other "no cache" data. Multiple wizard descendants subscribe
 * to these queries; if every mount of every descendant fires a refetch
 * (which `noServerStateCacheOptions.refetchOnMount: 'always'` does), the
 * resulting cascade flips `cycle?.id` and traps the wizard in a
 * hydration loop. Cycles are mutated through dedicated mutations that
 * call `invalidateCycle` explicitly, so a short stale window is safe.
 */
const cycleQueryOptions = {
  staleTime: 30_000,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
} as const;
import type {
  AdmissionCycle,
  AdmissionCycleCategoryConfig,
  ApplicantCategoryKey,
  CategoryCondition,
  CycleStatus,
} from '@/shared/types/domain';

export const cyclesKeys = {
  all: ['cycles'] as const,
  list: (opts?: { includeDeleted?: boolean }) =>
    [...cyclesKeys.all, 'list', opts ?? null] as const,
  detail: (id: string) => [...cyclesKeys.all, 'detail', id] as const,
  active: () => [...cyclesKeys.all, 'active'] as const,
  dependencies: (id: string) => [...cyclesKeys.all, 'dependencies', id] as const,
};

/**
 * The applicant-side `useCategories()` snapshot computes `isOpen` from the
 * active cycle's openCategories map, so cycle changes must also invalidate
 * the categories prefix. Both the applicant-portal and admin `categories.queries.ts`
 * use `['categories']` as their root key — a literal prefix match here
 * keeps Clean Arch (admin doesn't import from applicant-portal).
 */
const CATEGORIES_PREFIX = ['categories'] as const;

function invalidateCycle(qc: ReturnType<typeof useQueryClient>, id: string): void {
  /* The list key includes opts so the prefix `['cycles', 'list']` matches
   * both the includeDeleted=true and =false variants. */
  qc.invalidateQueries({ queryKey: [...cyclesKeys.all, 'list'] });
  qc.invalidateQueries({ queryKey: cyclesKeys.detail(id) });
  qc.invalidateQueries({ queryKey: cyclesKeys.active() });
  qc.invalidateQueries({ queryKey: CATEGORIES_PREFIX });
}

export function useCycles(opts: { includeDeleted?: boolean } = {}) {
  return useQuery({
    queryKey: cyclesKeys.list(opts),
    queryFn: () => cyclesService.list(opts),
    ...cycleQueryOptions,
  });
}

export function useCycleDependencies(id: string | null) {
  return useQuery({
    queryKey: cyclesKeys.dependencies(id ?? ''),
    queryFn: () => cyclesService.getDependencies(id!),
    enabled: Boolean(id),
    ...noServerStateCacheOptions,
  });
}

export function useCycleSoftDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => cyclesService.softDelete(id, reason),
    onSuccess: (cycle) => invalidateCycle(qc, cycle.id),
  });
}

export function useCycleRestore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cyclesService.restore(id),
    onSuccess: (cycle) => invalidateCycle(qc, cycle.id),
  });
}

export function useCycle(id: string | null) {
  return useQuery({
    queryKey: cyclesKeys.detail(id ?? ''),
    queryFn: () => cyclesService.getById(id!),
    enabled: Boolean(id),
    ...cycleQueryOptions,
  });
}

export function useActiveCycle() {
  return useQuery({
    queryKey: cyclesKeys.active(),
    queryFn: () => cyclesService.getActive(),
    ...cycleQueryOptions,
  });
}

export function useCycleClone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cyclesService.clone(id),
    onSuccess: (cycle) => invalidateCycle(qc, cycle.id),
  });
}

export function useCycleTransition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, next }: { id: string; next: CycleStatus }) => cyclesService.transition(id, next),
    onSuccess: (cycle: AdmissionCycle) => invalidateCycle(qc, cycle.id),
  });
}

export function useCycleUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      next,
      demoteCurrentActive,
    }: {
      id: string;
      next: CycleStatus;
      demoteCurrentActive?: boolean;
    }) => cyclesService.updateStatus(id, next, { demoteCurrentActive }),
    onSuccess: (cycle: AdmissionCycle) => invalidateCycle(qc, cycle.id),
  });
}

export function useCycleUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<AdmissionCycle> }) =>
      cyclesService.update(id, patch),
    onSuccess: (cycle: AdmissionCycle) => invalidateCycle(qc, cycle.id),
  });
}

export function useCycleCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      payload,
      demoteCurrentActive,
    }: {
      payload: Omit<AdmissionCycle, 'id' | 'applicantCount'>;
      demoteCurrentActive?: boolean;
    }) => cyclesService.create(payload, { demoteCurrentActive }),
    onSuccess: (cycle) => invalidateCycle(qc, cycle.id),
  });
}

export function useCycleActivate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cyclesService.activate(id),
    onSuccess: (cycle) => invalidateCycle(qc, cycle.id),
  });
}

/**
 * Toggle the orthogonal `isActive` flag on a cycle. Atomically clears
 * the flag on every other cycle in the same call (single-active invariant)
 * — see cyclesService.setActive.
 */
export function useCycleSetActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cyclesService.setActive(id),
    onSuccess: (cycle) => invalidateCycle(qc, cycle.id),
  });
}

export function useCycleDeactivate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cyclesService.deactivate(id),
    onSuccess: (cycle) => invalidateCycle(qc, cycle.id),
  });
}

export function useCycleSwapActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetId: string) => cyclesService.swapActive(targetId),
    onSuccess: (cycle) => invalidateCycle(qc, cycle.id),
  });
}

export function useCycleClose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cyclesService.close(id),
    onSuccess: (cycle) => invalidateCycle(qc, cycle.id),
  });
}

export function useCycleArchive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cyclesService.archive(id),
    onSuccess: (cycle) => invalidateCycle(qc, cycle.id),
  });
}

export function useCycleExtend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, newCloseDate }: { id: string; newCloseDate: string }) =>
      cyclesService.extend(id, newCloseDate),
    onSuccess: (cycle) => invalidateCycle(qc, cycle.id),
  });
}

export function useCycleRemove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cyclesService.remove(id),
    onSuccess: (_result, id) => {
      qc.removeQueries({ queryKey: cyclesKeys.detail(id) });
      qc.invalidateQueries({ queryKey: [...cyclesKeys.all, 'list'] });
      qc.invalidateQueries({ queryKey: cyclesKeys.active() });
      qc.invalidateQueries({ queryKey: CATEGORIES_PREFIX });
      qc.refetchQueries({ queryKey: [...cyclesKeys.all, 'list'], type: 'active' });
    },
  });
}

export function useToggleCycleCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      cycleId,
      categoryKey,
      config,
    }: {
      cycleId: string;
      categoryKey: ApplicantCategoryKey;
      config: AdmissionCycleCategoryConfig;
    }) => cyclesService.toggleCategory(cycleId, categoryKey, config),
    onSuccess: (cycle) => invalidateCycle(qc, cycle.id),
  });
}

export function useUpdateCycleCategoryOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      cycleId,
      categoryKey,
      overrides,
    }: {
      cycleId: string;
      categoryKey: ApplicantCategoryKey;
      overrides: Partial<CategoryCondition>;
    }) => cyclesService.updateCategoryOverride(cycleId, categoryKey, overrides),
    onSuccess: (cycle) => invalidateCycle(qc, cycle.id),
  });
}
