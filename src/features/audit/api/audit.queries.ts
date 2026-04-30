import { useQuery } from '@tanstack/react-query';
import { auditService, type AuditFilters } from './audit.service';

export const auditKeys = {
  all: ['audit'] as const,
  list: (filters: AuditFilters) => [...auditKeys.all, 'list', filters] as const,
};

export function useAuditLog(filters: AuditFilters = {}) {
  return useQuery({
    queryKey: auditKeys.list(filters),
    queryFn: () => auditService.list(filters),
  });
}
