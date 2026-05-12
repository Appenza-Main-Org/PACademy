/**
 * Lookup Management Module — React Query bindings.
 *
 * Hooks are generic over the lookup key so consumers get strongly-typed
 * rows (`useLookup('governorates')` → `UseQueryResult<GovernorateRow[]>`).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/shared/components';
import { ConflictError, isConflictError } from '@/shared/lib/errors';
import { lookupsService } from './lookups.service';
import type { DeleteResult, LookupKey, LookupRow } from '../types';

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
  return useMutation<DeleteResult, Error, string>({
    mutationFn: (code) => lookupsService.deleteLookupRow(key, code),
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
