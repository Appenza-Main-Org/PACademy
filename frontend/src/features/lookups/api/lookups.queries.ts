/**
 * Lookup Management Module — React Query bindings.
 *
 * Hooks are generic over the lookup key so consumers get strongly-typed
 * rows (`useLookup('governorates')` → `UseQueryResult<GovernorateRow[]>`).
 */

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/shared/components';
import { ConflictError, isConflictError } from '@/shared/lib/errors';
import { lookupsService } from './lookups.service';
import type {
  ApplicantCategoryRow,
  ApplicantCategoryType,
  DeleteResult,
  LookupKey,
  LookupRow,
} from '../types';

export const lookupKeys = {
  all: ['lookups'] as const,
  list: <K extends LookupKey>(key: K) => [...lookupKeys.all, key] as const,
};

export function useLookup<K extends LookupKey>(key: K) {
  return useQuery<LookupRow<K>[]>({
    queryKey: lookupKeys.list(key),
    queryFn: () => lookupsService.listLookup(key),
  });
}

/**
 * Convenience selector over `useLookup('applicant-categories')` — returns
 * the rows pre-narrowed by entry stage (`pre_university` = ثانوي,
 * `university` = جامعي). Used by the applicant-portal eligibility gate
 * (RFP §المرحلة 3-4): the ثانوي category auto-resolves when grades are
 * found by NID, otherwise the user picks from the non-ثانوي rows.
 *
 * Returns the same `UseQueryResult` shape as `useLookup` but with a
 * `data` array narrowed to active rows of the requested type. When
 * `type` is omitted, all active rows are returned.
 */
export function useApplicantCategories(opts: { type?: ApplicantCategoryType } = {}) {
  const query = useLookup('applicant-categories');
  const filtered = useMemo<ApplicantCategoryRow[] | undefined>(() => {
    if (!query.data) return undefined;
    const active = query.data.filter((r) => r.isActive);
    if (!opts.type) return active;
    return active.filter((r) => r.type === opts.type);
  }, [query.data, opts.type]);
  return { ...query, data: filtered };
}

const CONFLICT_MESSAGES: Record<string, string> = {
  DUPLICATE_CODE: 'هذا الكود مستخدم بالفعل ضمن هذا الجدول.',
  INVALID_DATE_RANGE: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية.',
};

function surfaceConflict(err: unknown, fallback: string): void {
  if (isConflictError(err)) {
    toast(CONFLICT_MESSAGES[err.conflictCode] ?? `خطأ: ${err.conflictCode}`, 'danger');
    return;
  }
  toast(fallback, 'danger');
}

export function useCreateLookupRow<K extends LookupKey>(key: K) {
  const qc = useQueryClient();
  return useMutation<
    LookupRow<K>,
    ConflictError | Error,
    Omit<LookupRow<K>, 'code'> & { code?: string }
  >({
    mutationFn: (input) => lookupsService.createLookupRow(key, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: lookupKeys.list(key) }),
    onError: (err) => surfaceConflict(err, 'فشل إنشاء السجل'),
  });
}

export function useUpdateLookupRow<K extends LookupKey>(key: K) {
  const qc = useQueryClient();
  return useMutation<
    LookupRow<K>,
    ConflictError | Error,
    { code: string; patch: Partial<LookupRow<K>> }
  >({
    mutationFn: ({ code, patch }) => lookupsService.updateLookupRow(key, code, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: lookupKeys.list(key) }),
    onError: (err) => surfaceConflict(err, 'فشل تحديث السجل'),
  });
}

export function useDeleteLookupRow<K extends LookupKey>(key: K) {
  const qc = useQueryClient();
  return useMutation<DeleteResult, Error, { code: string; force?: boolean }>({
    mutationFn: ({ code, force }) => lookupsService.deleteLookupRow(key, code, { force }),
    onSuccess: (result) => {
      if (result.deleted) {
        qc.invalidateQueries({ queryKey: lookupKeys.list(key) });
      } else {
        toast(result.reason, 'warning');
      }
    },
    onError: () => toast('فشل حذف السجل', 'danger'),
  });
}
