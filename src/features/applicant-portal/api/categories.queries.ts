import { useMutation, useQuery } from '@tanstack/react-query';
import { categoriesPublicService } from './categories.service';
import type { ApplicantCategoryKey } from '@/shared/types/domain';

export const categoryKeys = {
  all: ['categories'] as const,
  list: () => [...categoryKeys.all, 'public-list'] as const,
  activeCycle: () => [...categoryKeys.all, 'active-cycle'] as const,
};

export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.list(),
    queryFn: () => categoriesPublicService.list(),
  });
}

export function useActiveCycle() {
  return useQuery({
    queryKey: categoryKeys.activeCycle(),
    queryFn: () => categoriesPublicService.getActiveCycle(),
  });
}

export function useEligibilityMutation() {
  return useMutation({
    mutationFn: (input: { categoryKey: ApplicantCategoryKey; nid: string }) =>
      categoriesPublicService.checkEligibility(input),
  });
}
