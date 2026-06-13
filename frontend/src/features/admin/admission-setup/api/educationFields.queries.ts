/**
 * TanStack Query hooks over the admin categoryEducationFieldsService —
 * see the service's INTEGRATION CONTRACT header.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CategoryEducationField } from '@/shared/types/domain';
import { categoryEducationFieldsService } from './educationFields.service';

export const adminEducationFieldKeys = {
  all: ['admin-category-education-fields'] as const,
  byCategory: (categoryKey: string) => [...adminEducationFieldKeys.all, categoryKey] as const,
};

export function useAdminCategoryEducationFields(categoryKey: string | null) {
  return useQuery({
    queryKey: adminEducationFieldKeys.byCategory(categoryKey ?? ''),
    queryFn: () => categoryEducationFieldsService.listByCategory(categoryKey ?? ''),
    enabled: Boolean(categoryKey),
  });
}

export function useSaveCategoryEducationFields() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      categoryKey,
      rows,
    }: {
      categoryKey: string;
      rows: CategoryEducationField[];
    }) => categoryEducationFieldsService.saveCategory(categoryKey, rows),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminEducationFieldKeys.all });
      // The portal-side query shares the same backend rows.
      void queryClient.invalidateQueries({ queryKey: ['category-education-fields'] });
    },
  });
}
