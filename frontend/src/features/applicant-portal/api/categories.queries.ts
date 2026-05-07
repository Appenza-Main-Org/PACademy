import { useMutation, useQuery } from '@tanstack/react-query';
import { categoriesPublicService } from './categories.service';
import type { ApplicantCategoryKey } from '@/shared/types/domain';

export const categoryKeys = {
  all: ['categories'] as const,
  list: (cycleId?: string) =>
    [...categoryKeys.all, 'public-list', cycleId ?? null] as const,
  activeCycle: () => [...categoryKeys.all, 'active-cycle'] as const,
  activeCycles: () => [...categoryKeys.all, 'active-cycles'] as const,
};

export function useCategories(cycleId?: string) {
  return useQuery({
    queryKey: categoryKeys.list(cycleId),
    queryFn: () => categoriesPublicService.list(cycleId),
  });
}

/** All currently-active cycles (may be empty). */
export function useActiveCycles() {
  return useQuery({
    queryKey: categoryKeys.activeCycles(),
    queryFn: () => categoriesPublicService.getActiveCycles(),
  });
}

/** First active cycle — kept for legacy single-cycle screens. */
export function useActiveCycle() {
  return useQuery({
    queryKey: categoryKeys.activeCycle(),
    queryFn: () => categoriesPublicService.getActiveCycle(),
  });
}

export function useEligibilityMutation() {
  return useMutation({
    mutationFn: (input: {
      categoryKey: ApplicantCategoryKey;
      nid: string;
      cycleId?: string;
    }) => categoriesPublicService.checkEligibility(input),
  });
}
