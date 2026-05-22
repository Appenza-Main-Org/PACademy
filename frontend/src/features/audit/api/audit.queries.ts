import { useQuery } from '@tanstack/react-query';
import { auditService, type AuditFilters } from './audit.service';

export const auditKeys = {
  all: ['audit'] as const,
  list: (filters: AuditFilters) => [...auditKeys.all, 'list', filters] as const,
  detail: (id: string) => [...auditKeys.all, 'detail', id] as const,
  diff: (id: string) => [...auditKeys.all, 'diff', id] as const,
  actions: () => [...auditKeys.all, 'actions'] as const,
  entityTypes: () => [...auditKeys.all, 'entity-types'] as const,
  modules: () => [...auditKeys.all, 'modules'] as const,
  roles: () => [...auditKeys.all, 'roles'] as const,
  users: () => [...auditKeys.all, 'users'] as const,
};

export function useAuditLog(filters: AuditFilters = {}) {
  return useQuery({
    queryKey: auditKeys.list(filters),
    queryFn: () => auditService.list(filters),
  });
}

export function useAuditEntry(id: string | null) {
  return useQuery({
    queryKey: auditKeys.detail(id ?? ''),
    queryFn: () => auditService.getById(id!),
    enabled: Boolean(id),
  });
}

export function useAuditDiff(id: string | null) {
  return useQuery({
    queryKey: auditKeys.diff(id ?? ''),
    queryFn: () => auditService.getDiff(id!),
    enabled: Boolean(id),
  });
}

export function useAuditActions() {
  return useQuery({
    queryKey: auditKeys.actions(),
    queryFn: () => auditService.getActions(),
  });
}

export function useAuditEntityTypes() {
  return useQuery({
    queryKey: auditKeys.entityTypes(),
    queryFn: () => auditService.getEntityTypes(),
  });
}

export function useAuditModules() {
  return useQuery({
    queryKey: auditKeys.modules(),
    queryFn: () => auditService.getModules(),
  });
}

export function useAuditRoles() {
  return useQuery({
    queryKey: auditKeys.roles(),
    queryFn: () => auditService.getRoles(),
  });
}

export function useAuditUsers() {
  return useQuery({
    queryKey: auditKeys.users(),
    queryFn: () => auditService.getUsers(),
  });
}
