import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { categoriesAdminService } from './categories.service';
import { noServerStateCacheOptions } from '@/shared/lib/query-options';
import type {
  ApplicantCategory,
  ApplicantCategoryKey,
  CategoryConditions,
} from '@/shared/types/domain';

export const adminCategoriesKeys = {
  all: ['categories'] as const,
  list: (opts?: { includeDeleted?: boolean }) =>
    [...adminCategoriesKeys.all, 'admin-list', opts ?? null] as const,
  detail: (key: string) => [...adminCategoriesKeys.all, 'detail', key] as const,
  dependencies: (key: string) => [...adminCategoriesKeys.all, 'dependencies', key] as const,
};

export function useCategoriesAdmin(opts: { includeDeleted?: boolean } = {}) {
  return useQuery({
    queryKey: adminCategoriesKeys.list(opts),
    queryFn: () => categoriesAdminService.list(opts),
    ...noServerStateCacheOptions,
  });
}

export function useCategoryDependencies(key: ApplicantCategoryKey | null) {
  return useQuery({
    queryKey: adminCategoriesKeys.dependencies(key ?? ''),
    queryFn: () => categoriesAdminService.getDependencies(key!),
    enabled: Boolean(key),
    ...noServerStateCacheOptions,
  });
}

export function useCategoryAdmin(key: ApplicantCategoryKey | null) {
  return useQuery({
    queryKey: adminCategoriesKeys.detail(key ?? ''),
    queryFn: () => categoriesAdminService.getByKey(key!),
    enabled: Boolean(key),
    ...noServerStateCacheOptions,
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

export function useCategorySoftDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, reason }: { key: ApplicantCategoryKey; reason: string }) =>
      categoriesAdminService.softDelete(key, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminCategoriesKeys.all }),
  });
}

export function useCategoryRestore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: ApplicantCategoryKey) => categoriesAdminService.restore(key),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminCategoriesKeys.all }),
  });
}

export function usePreviewCategoryRuleChange() {
  return useMutation({
    mutationFn: ({ key, conditions }: { key: ApplicantCategoryKey; conditions: CategoryConditions }) =>
      categoriesAdminService.previewRuleChangeImpact(key, conditions),
  });
}

export function useUpdateExpandedConditions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      key,
      conditions,
      override,
      impactedApplicantIds,
    }: {
      key: ApplicantCategoryKey;
      conditions: CategoryConditions;
      override?: boolean;
      impactedApplicantIds?: string[];
    }) =>
      categoriesAdminService.updateExpandedConditions(key, conditions, {
        override,
        impactedApplicantIds,
      }),
    onSuccess: (cat) => {
      qc.invalidateQueries({ queryKey: adminCategoriesKeys.all });
      qc.invalidateQueries({ queryKey: adminCategoriesKeys.detail(cat.key) });
    },
  });
}
