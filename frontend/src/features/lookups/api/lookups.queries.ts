/**
 * Lookup Management Module — React Query bindings.
 *
 * The hooks here wrap `lookupsService` so consumers can refetch and
 * invalidate without touching the service directly. Mutations surface
 * `ConflictError` from the service in their `error` field; component
 * code maps the conflict code to an Arabic toast (see
 * `LookupFormDrawer`).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/shared/components';
import { ConflictError, isConflictError } from '@/shared/lib/errors';
import {
  lookupsService,
  type LookupItemInput,
  type LookupItemPatch,
} from './lookups.service';
import type {
  LookupFilters,
  LookupItem,
  LookupMappingKind,
  LookupMappingPair,
  LookupTreeNode,
  LookupType,
  LookupTypeCode,
} from '../types';

export const lookupKeys = {
  all: ['lookups'] as const,
  types: () => [...lookupKeys.all, 'types'] as const,
  lists: () => [...lookupKeys.all, 'list'] as const,
  list: (filters: LookupFilters) => [...lookupKeys.lists(), filters] as const,
  trees: () => [...lookupKeys.all, 'tree'] as const,
  tree: (typeCode: LookupTypeCode) => [...lookupKeys.trees(), typeCode] as const,
  mappings: (kind: LookupMappingKind) => [...lookupKeys.all, 'mappings', kind] as const,
};

const CONFLICT_MESSAGES: Record<string, string> = {
  CIRCULAR_HIERARCHY: 'لا يمكن تعيين هذا العنصر كأبٍ لأنه ينتمي إلى سلسلته العلوية.',
  PARENT_HAS_CHILDREN: 'تعذّر الحذف — يوجد عناصر فرعية مرتبطة. احذف الفروع أولاً.',
  SELF_PARENT: 'لا يمكن تعيين عنصر كأبٍ لنفسه.',
  DUPLICATE_CODE: 'هذا الكود مستخدم بالفعل ضمن هذا النوع.',
  DUPLICATE_MAPPING: 'هذا الارتباط موجود بالفعل.',
  INVALID_DATE_RANGE: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية.',
  IN_USE: 'تعذّر الحذف — العنصر مستخدم في إحدى جداول الارتباطات.',
};

function surfaceConflict(err: unknown, fallback = 'فشل تنفيذ العملية'): void {
  if (isConflictError(err)) {
    toast(CONFLICT_MESSAGES[err.conflictCode] ?? `خطأ: ${err.conflictCode}`, 'danger');
    return;
  }
  toast(fallback, 'danger');
}

/* ─── Queries ────────────────────────────────────────────────────────── */

export function useLookupTypes() {
  return useQuery<LookupType[]>({
    queryKey: lookupKeys.types(),
    queryFn: () => lookupsService.listTypes(),
  });
}

export function useLookupList(filters: LookupFilters) {
  return useQuery({
    queryKey: lookupKeys.list(filters),
    queryFn: () => lookupsService.listItems(filters),
  });
}

export function useLookupTree(typeCode: LookupTypeCode | null) {
  return useQuery<LookupTreeNode[]>({
    queryKey: lookupKeys.tree((typeCode ?? 'TESTS') as LookupTypeCode),
    queryFn: () => lookupsService.getTree(typeCode as LookupTypeCode),
    enabled: Boolean(typeCode),
  });
}

export function useLookupMappings(kind: LookupMappingKind) {
  return useQuery<LookupMappingPair[]>({
    queryKey: lookupKeys.mappings(kind),
    queryFn: () => lookupsService.listMappings(kind),
  });
}

/* ─── Mutations ──────────────────────────────────────────────────────── */

function invalidateForType(
  qc: ReturnType<typeof useQueryClient>,
  typeCode: LookupTypeCode | undefined,
): void {
  qc.invalidateQueries({ queryKey: lookupKeys.lists() });
  if (typeCode) qc.invalidateQueries({ queryKey: lookupKeys.tree(typeCode) });
}

export function useCreateLookup() {
  const qc = useQueryClient();
  return useMutation<LookupItem, ConflictError | Error, LookupItemInput>({
    mutationFn: (input) => lookupsService.create(input),
    onSuccess: (row) => invalidateForType(qc, row.lookupTypeCode),
    onError: (err) => surfaceConflict(err, 'فشل إنشاء العنصر'),
  });
}

export function useUpdateLookup() {
  const qc = useQueryClient();
  return useMutation<
    LookupItem,
    ConflictError | Error,
    { id: string; patch: LookupItemPatch }
  >({
    mutationFn: ({ id, patch }) => lookupsService.update(id, patch),
    onSuccess: (row) => invalidateForType(qc, row.lookupTypeCode),
    onError: (err) => surfaceConflict(err, 'فشل تحديث العنصر'),
  });
}

export function useDeleteLookup() {
  const qc = useQueryClient();
  return useMutation<void, ConflictError | Error, { id: string; typeCode: LookupTypeCode }>({
    mutationFn: ({ id }) => lookupsService.softDelete(id),
    onSuccess: (_void, { typeCode }) => invalidateForType(qc, typeCode),
    onError: (err) => surfaceConflict(err, 'فشل حذف العنصر'),
  });
}

export function useReorderLookups() {
  const qc = useQueryClient();
  return useMutation<
    void,
    Error,
    { typeCode: LookupTypeCode; parentId: string | null; orderedIds: string[] }
  >({
    mutationFn: ({ typeCode, parentId, orderedIds }) =>
      lookupsService.reorder(typeCode, parentId, orderedIds),
    onSuccess: (_void, { typeCode }) => invalidateForType(qc, typeCode),
    onError: () => toast('فشل تحديث الترتيب', 'danger'),
  });
}

export function useAddMapping() {
  const qc = useQueryClient();
  return useMutation<void, ConflictError | Error, { kind: LookupMappingKind; pair: LookupMappingPair }>({
    mutationFn: ({ kind, pair }) => lookupsService.addMapping(kind, pair),
    onSuccess: (_void, { kind }) =>
      qc.invalidateQueries({ queryKey: lookupKeys.mappings(kind) }),
    onError: (err) => surfaceConflict(err, 'فشل إضافة الارتباط'),
  });
}

export function useRemoveMapping() {
  const qc = useQueryClient();
  return useMutation<void, Error, { kind: LookupMappingKind; pair: LookupMappingPair }>({
    mutationFn: ({ kind, pair }) => lookupsService.removeMapping(kind, pair),
    onSuccess: (_void, { kind }) =>
      qc.invalidateQueries({ queryKey: lookupKeys.mappings(kind) }),
    onError: () => toast('فشل حذف الارتباط', 'danger'),
  });
}
