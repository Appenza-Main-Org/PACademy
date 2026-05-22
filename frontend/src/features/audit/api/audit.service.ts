/**
 * Audit API.
 *
 * INTEGRATION CONTRACT:
 *   GET /api/audit
 *   GET /api/audit/:id
 *   GET /api/audit/:id/diff
 *   GET /api/audit/entity-types
 *   GET /api/audit/modules
 *   GET /api/audit/roles
 *   GET /api/audit/users
 *   GET /api/audit/export?format=csv
 */

import { apiClient } from '@/shared/lib/api-client';
import type { AuditAction, AuditDiff, AuditEntry, AuditModule } from '@/shared/types/domain';

export interface AuditFilters {
  action?: AuditAction | 'all';
  userId?: string | 'all';
  role?: string | 'all';
  module?: AuditModule | 'all';
  entity?: string | 'all';
  entityType?: string | 'all';
  entityId?: string;
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
}

export const auditService = {
  async list(filters: AuditFilters = {}): Promise<AuditEntry[]> {
    return apiClient.get('/api/audit', { query: filters });
  },

  async getById(id: string): Promise<AuditEntry | null> {
    return apiClient.get(`/api/audit/${encodeURIComponent(id)}`);
  },

  async getDiff(id: string): Promise<AuditDiff> {
    return apiClient.get(`/api/audit/${encodeURIComponent(id)}/diff`);
  },

  async getEntityTypes(): Promise<string[]> {
    return apiClient.get('/api/audit/entity-types');
  },

  async getModules(): Promise<AuditModule[]> {
    return apiClient.get('/api/audit/modules');
  },

  async getRoles(): Promise<string[]> {
    return apiClient.get('/api/audit/roles');
  },

  async getUsers(): Promise<{ id: string; name: string }[]> {
    return apiClient.get('/api/audit/users');
  },

  async exportCsv(filters: AuditFilters = {}): Promise<Blob> {
    return apiClient.blob('/api/audit/export', { query: { ...filters, format: 'csv' } });
  },
};
