/**
 * Application Settings — TanStack Query bindings.
 *
 * Reads use a shared `appSettingsKeys` factory so mutations can
 * invalidate at the right granularity without stringly-typed keys.
 *
 * Conflicts thrown by the service are mapped to Arabic toasts in the
 * `CONFLICT_MESSAGES_AR` table below; unknown errors fall back to a
 * generic Arabic message.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/shared/components';
import { ConflictError, isConflictError } from '@/shared/lib/errors';
import { noServerStateCacheOptions } from '@/shared/lib/query-options';
import type { GradingMode } from '@/features/lookups';
import { useLookup } from '@/features/lookups';
import type { SpecializationRow } from '@/features/lookups/types';
import { applicationSettingsService } from './applicationSettings.service';
import type {
  BulkSaveResult,
  BulkYearChange,
  CategoryConfigJoined,
  CategorySettingsSummary,
  CategorySpecializationJoined,
  ParentCategorySnapshot,
} from './applicationSettings.service';
import type { YearRowDraft } from '../lib/appSettingsValidation';
import type {
  ApplicantCategoryConfig,
  ApplicantCategorySpecialization,
  ApplicantSpecializationYear,
  AppSettingsConflict,
} from '../types';

/* ─── Key factory ────────────────────────────────────────────────────── */

export const appSettingsKeys = {
  all: ['admin', 'app-settings'] as const,
  configs: () => [...appSettingsKeys.all, 'configs'] as const,
  specs: (configId: string) =>
    [...appSettingsKeys.all, 'specs', configId] as const,
  eligible: (configId: string) =>
    [...appSettingsKeys.all, 'eligible', configId] as const,
  years: (categorySpecializationId: string) =>
    [...appSettingsKeys.all, 'years', categorySpecializationId] as const,
  gradingMode: (categorySpecializationId: string) =>
    [...appSettingsKeys.all, 'grading-mode', categorySpecializationId] as const,
  parentCategory: (categorySpecializationId: string) =>
    [...appSettingsKeys.all, 'parent-category', categorySpecializationId] as const,
  summary: () => [...appSettingsKeys.all, 'summary'] as const,
};

/* ─── Conflict messages ──────────────────────────────────────────────── */

const CONFLICT_MESSAGES_AR: Record<AppSettingsConflict, string> = {
  DUPLICATE_YEAR: 'سنة التخرج موجودة بالفعل لنفس النوع في هذا التخصص',
  INVALID_DATE_RANGE: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية',
  OVERLAPPING_PERIOD: 'فترة التقديم تتداخل مع سنة أخرى لنفس النوع',
  AGE_NOT_POSITIVE: 'السن يجب أن يكون رقماً موجباً',
  AGE_RANGE_INVALID: 'السن الأدنى يجب أن يكون أقل من أو يساوي السن الأقصى',
  AGE_REFERENCE_AFTER_START: 'تاريخ احتساب السن يجب أن يسبق بداية التقديم',
  PERCENTAGE_OUT_OF_RANGE: 'الدرجة المئوية يجب أن تكون بين 0 و 100',
  GRADE_MODE_MISMATCH: 'نمط التقدير لا يطابق نوع تقديم الفئة',
  GENDER_REQUIRED: 'اختر النوع (ذكور أو إناث على الأقل)',
  GRAD_YEAR_REQUIRED: 'اختر سنة تخرج واحدة على الأقل',
  SPECIALIZATION_NOT_MAPPED:
    'هذا التخصص غير مرتبط بهذه الفئة في البيانات المرجعية',
  CATEGORY_HAS_ACTIVE_YEARS:
    'لا يمكن إيقاف الفئة قبل إيقاف السنوات النشطة',
};

function surfaceConflict(err: unknown, fallback: string): void {
  if (isConflictError(err)) {
    const msg =
      CONFLICT_MESSAGES_AR[err.conflictCode as AppSettingsConflict] ??
      `خطأ: ${err.conflictCode}`;
    toast(msg, 'danger');
    return;
  }
  toast(fallback, 'danger');
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export function useCategoryConfigs() {
  /* Tie the configs query to the applicant-categories lookup's data
   * identity. When an admin edits a lookup row (e.g. changes the
   * excellence criterion), the lookup query's `dataUpdatedAt` advances
   * on next read, which rotates this query's key and forces a refetch
   * of the join. Without this seam the wizard would render stale
   * lookup values until a full reload. */
  const lookupQuery = useLookup('applicant-categories');
  return useQuery<CategoryConfigJoined[]>({
    queryKey: [
      ...appSettingsKeys.configs(),
      lookupQuery.dataUpdatedAt ?? 0,
    ],
    queryFn: () => applicationSettingsService.listCategoryConfigs(),
    ...noServerStateCacheOptions,
  });
}

export function useSpecializationsForConfig(
  configId: string | null,
  enabled = true,
) {
  return useQuery<CategorySpecializationJoined[]>({
    queryKey: appSettingsKeys.specs(configId ?? '__none'),
    queryFn: () => {
      if (!configId) return Promise.resolve([]);
      return applicationSettingsService.listSpecializationsForConfig(configId);
    },
    enabled: enabled && Boolean(configId),
    ...noServerStateCacheOptions,
  });
}

export function useEligibleSpecializations(
  configId: string | null,
  enabled = true,
) {
  return useQuery<SpecializationRow[]>({
    queryKey: appSettingsKeys.eligible(configId ?? '__none'),
    queryFn: () => {
      if (!configId) return Promise.resolve([]);
      return applicationSettingsService.getEligibleSpecializations(configId);
    },
    enabled: enabled && Boolean(configId),
    ...noServerStateCacheOptions,
  });
}

export function useYears(
  categorySpecializationId: string | null,
  enabled = true,
) {
  return useQuery<ApplicantSpecializationYear[]>({
    queryKey: appSettingsKeys.years(categorySpecializationId ?? '__none'),
    queryFn: () => {
      if (!categorySpecializationId) return Promise.resolve([]);
      return applicationSettingsService.listYears(categorySpecializationId);
    },
    enabled: enabled && Boolean(categorySpecializationId),
    ...noServerStateCacheOptions,
  });
}

/**
 * Walks the chain `spec → config → category → submissionType` and
 * returns the resolved `gradingMode`. Returns `null` when any step
 * breaks. Used by `YearTable` to pick the right branch for the
 * grade-gate column.
 */
export function useResolvedGradingModeForSpec(
  categorySpecializationId: string | null,
  enabled = true,
) {
  return useQuery<GradingMode | null>({
    queryKey: appSettingsKeys.gradingMode(categorySpecializationId ?? '__none'),
    queryFn: () => {
      if (!categorySpecializationId) return Promise.resolve(null);
      return applicationSettingsService.getGradingModeForSpec(categorySpecializationId);
    },
    enabled: enabled && Boolean(categorySpecializationId),
    ...noServerStateCacheOptions,
  });
}

/**
 * One-shot joined snapshot of the entire application-settings tree.
 * Powers the read-only review surfaces (pre-review wizard step + final
 * review step). Cache invalidates on any app-settings mutation via the
 * shared `appSettingsKeys.all` prefix.
 */
export function useApplicationSettingsSummary() {
  return useQuery<CategorySettingsSummary[]>({
    queryKey: appSettingsKeys.summary(),
    queryFn: () => applicationSettingsService.getApplicationSettingsSummary(),
    ...noServerStateCacheOptions,
  });
}

/**
 * Snapshot of the parent applicant-category for a junction id. Drives
 * the gender-scope lock and the per-category extra picker (school
 * categories on `officers_general`).
 */
export function useParentCategoryForSpec(
  categorySpecializationId: string | null,
  enabled = true,
) {
  return useQuery<ParentCategorySnapshot | null>({
    queryKey: appSettingsKeys.parentCategory(categorySpecializationId ?? '__none'),
    queryFn: () => {
      if (!categorySpecializationId) return Promise.resolve(null);
      return applicationSettingsService.getParentCategoryForSpec(categorySpecializationId);
    },
    enabled: enabled && Boolean(categorySpecializationId),
    ...noServerStateCacheOptions,
  });
}

/* ─── Mutations ──────────────────────────────────────────────────────── */

export function useAttachSpecialization() {
  const qc = useQueryClient();
  return useMutation<
    ApplicantCategorySpecialization,
    ConflictError | Error,
    { configId: string; specializationId: string }
  >({
    mutationFn: ({ configId, specializationId }) =>
      applicationSettingsService.attachSpecialization(configId, specializationId),
    onSuccess: (_row, vars) => {
      qc.invalidateQueries({ queryKey: appSettingsKeys.specs(vars.configId) });
      qc.invalidateQueries({ queryKey: appSettingsKeys.eligible(vars.configId) });
      qc.invalidateQueries({ queryKey: appSettingsKeys.configs() });
      toast('تم إضافة التخصص', 'success');
    },
    onError: (err) => surfaceConflict(err, 'تعذر إضافة التخصص'),
  });
}

export function useDetachSpecialization(configId: string | null) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (categorySpecializationId) =>
      applicationSettingsService.detachSpecialization(categorySpecializationId),
    onSuccess: () => {
      if (configId) {
        qc.invalidateQueries({ queryKey: appSettingsKeys.specs(configId) });
        qc.invalidateQueries({ queryKey: appSettingsKeys.eligible(configId) });
      }
      qc.invalidateQueries({ queryKey: appSettingsKeys.configs() });
      toast('تم حذف التخصص وكل السنوات المرتبطة', 'success');
    },
    onError: () => toast('تعذر حذف التخصص', 'danger'),
  });
}

export function useCreateYear() {
  const qc = useQueryClient();
  return useMutation<
    ApplicantSpecializationYear,
    ConflictError | Error,
    YearRowDraft
  >({
    mutationFn: (input) => applicationSettingsService.createYear(input),
    onSuccess: (row) => {
      qc.invalidateQueries({
        queryKey: appSettingsKeys.years(row.categorySpecializationId),
      });
      qc.invalidateQueries({ queryKey: appSettingsKeys.configs() });
    },
    onError: (err) => surfaceConflict(err, 'تعذر إنشاء السنة'),
  });
}

export function useUpdateYear() {
  const qc = useQueryClient();
  return useMutation<
    ApplicantSpecializationYear,
    ConflictError | Error,
    { id: string; patch: Partial<ApplicantSpecializationYear> }
  >({
    mutationFn: ({ id, patch }) =>
      applicationSettingsService.updateYear(id, patch),
    onSuccess: (row) => {
      qc.invalidateQueries({
        queryKey: appSettingsKeys.years(row.categorySpecializationId),
      });
    },
    onError: (err) => surfaceConflict(err, 'تعذر تحديث السنة'),
  });
}

export function useDeleteYear() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; categorySpecializationId: string }>({
    mutationFn: ({ id }) => applicationSettingsService.deleteYear(id),
    onSuccess: (_v, vars) => {
      qc.invalidateQueries({
        queryKey: appSettingsKeys.years(vars.categorySpecializationId),
      });
      qc.invalidateQueries({ queryKey: appSettingsKeys.configs() });
    },
    onError: () => toast('تعذر حذف السنة', 'danger'),
  });
}

export function useToggleYearActive() {
  const qc = useQueryClient();
  return useMutation<ApplicantSpecializationYear, Error, string>({
    mutationFn: (id) => applicationSettingsService.toggleYearActive(id),
    onSuccess: (row) => {
      qc.invalidateQueries({
        queryKey: appSettingsKeys.years(row.categorySpecializationId),
      });
    },
    onError: () => toast('تعذر تحديث حالة السنة', 'danger'),
  });
}

export function useToggleCategoryActive() {
  const qc = useQueryClient();
  return useMutation<ApplicantCategoryConfig, ConflictError | Error, string>({
    mutationFn: (configId) =>
      applicationSettingsService.toggleCategoryActive(configId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: appSettingsKeys.configs() });
    },
    onError: (err) => surfaceConflict(err, 'تعذر تغيير حالة الفئة'),
  });
}

export function useBulkSave() {
  const qc = useQueryClient();
  return useMutation<BulkSaveResult, ConflictError | Error, BulkYearChange[]>({
    mutationFn: (changes) => applicationSettingsService.bulkSave(changes),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: appSettingsKeys.all });
      const parts: string[] = [];
      if (result.created) parts.push(`إضافة ${result.created}`);
      if (result.updated) parts.push(`تعديل ${result.updated}`);
      if (result.deleted) parts.push(`حذف ${result.deleted}`);
      const msg = parts.length > 0
        ? `تم الحفظ — ${parts.join(' · ')}`
        : 'تم الحفظ';
      toast(msg, 'success');
    },
    onError: (err) => surfaceConflict(err, 'تعذر حفظ التغييرات'),
  });
}
