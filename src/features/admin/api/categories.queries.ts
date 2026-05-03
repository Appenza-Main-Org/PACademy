import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { categoriesAdminService } from './categories.service';
import type { ApplicantCategory, ApplicantCategoryKey } from '@/shared/types/domain';

export const adminCategoriesKeys = {
  all: ['categories'] as const,
  list: () => [...adminCategoriesKeys.all, 'admin-list'] as const,
  detail: (key: string) => [...adminCategoriesKeys.all, 'detail', key] as const,
};

export function useCategoriesAdmin() {
  return useQuery({
    queryKey: adminCategoriesKeys.list(),
    queryFn: () => categoriesAdminService.list(),
  });
}

export function useCategoryAdmin(key: ApplicantCategoryKey | null) {
  return useQuery({
    queryKey: adminCategoriesKeys.detail(key ?? ''),
    queryFn: () => categoriesAdminService.getByKey(key!),
    enabled: Boolean(key),
  });
}

export function useUpdateCategoryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, patch }: { key: ApplicantCategoryKey; patch: Partial<ApplicantCategory> }) =>
      categoriesAdminService.update(key, patch),
    onSuccess: (cat) => {
      qc.invalidateQueries({ queryKey: adminCategoriesKeys.all });
      qc.invalidateQueries({ queryKey: adminCategoriesKeys.detail(cat.key) });
    },
  });
}

export function useCreateCategoryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ApplicantCategory) => categoriesAdminService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminCategoriesKeys.all }),
  });
}

export function useRemoveCategoryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: ApplicantCategoryKey) => categoriesAdminService.remove(key),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminCategoriesKeys.all }),
  });
}
