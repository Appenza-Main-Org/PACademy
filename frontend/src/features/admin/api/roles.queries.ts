import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rolesService } from './roles.service';
import type { RoleDefinitionRow } from '@/shared/types/domain';

export const rolesKeys = {
  all: ['roles-admin'] as const,
  list: (opts?: { includeDeleted?: boolean }) => [...rolesKeys.all, 'list', opts ?? null] as const,
  detail: (id: string) => [...rolesKeys.all, 'detail', id] as const,
};

export function useRolesAdmin(opts: { includeDeleted?: boolean } = {}) {
  return useQuery({ queryKey: rolesKeys.list(opts), queryFn: () => rolesService.list(opts) });
}

export function useRoleAdmin(id: string | null) {
  return useQuery({
    queryKey: rolesKeys.detail(id ?? ''),
    queryFn: () => rolesService.getById(id!),
    enabled: Boolean(id),
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<RoleDefinitionRow, 'id' | 'isSystem' | 'createdAt' | 'updatedAt'>) =>
      rolesService.create(payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: rolesKeys.all }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<RoleDefinitionRow> }) =>
      rolesService.update(id, patch),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: rolesKeys.all });
      void qc.invalidateQueries({ queryKey: rolesKeys.detail(row.id) });
    },
  });
}

export function useRoleSoftDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rolesService.softDelete(id, reason),
    onSuccess: () => void qc.invalidateQueries({ queryKey: rolesKeys.all }),
  });
}

export function useRoleRestore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rolesService.restore(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: rolesKeys.all }),
  });
}
