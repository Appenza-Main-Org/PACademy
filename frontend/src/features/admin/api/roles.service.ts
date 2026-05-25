/**
 * Dynamic Roles API — Gap C (admin-gaps).
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/roles                  → RoleDefinitionRow[]
 *   GET    /api/roles/:id              → RoleDefinitionRow
 *   POST   /api/roles                  → RoleDefinitionRow
 *   PATCH  /api/roles/:id              → RoleDefinitionRow
 *   GET    /api/roles/:id/dependencies → DependencyResult
 *   POST   /api/roles/:id/soft-delete  → RoleDefinitionRow
 *   POST   /api/roles/:id/restore      → RoleDefinitionRow
 */

import { apiClient } from '@/shared/lib/api-client';
import type { DependencyResult } from '@/shared/lib/soft-delete';
import type { RoleDefinitionRow } from '@/shared/types/domain';

export const rolesService = {
  async list(opts: { includeDeleted?: boolean } = {}): Promise<RoleDefinitionRow[]> {
    return apiClient.get('/api/roles', { query: opts });
  },

  async getById(id: string): Promise<RoleDefinitionRow | null> {
    return apiClient.get(`/api/roles/${encodeURIComponent(id)}`);
  },

  async create(payload: Omit<RoleDefinitionRow, 'id' | 'isSystem' | 'createdAt' | 'updatedAt'>): Promise<RoleDefinitionRow> {
    return apiClient.post('/api/roles', payload);
  },

  async update(id: string, patch: Partial<RoleDefinitionRow>): Promise<RoleDefinitionRow> {
    return apiClient.patch(`/api/roles/${encodeURIComponent(id)}`, patch);
  },

  async getDependencies(id: string): Promise<DependencyResult> {
    return apiClient.get(`/api/roles/${encodeURIComponent(id)}/dependencies`);
  },

  async softDelete(id: string, reason: string): Promise<RoleDefinitionRow> {
    return apiClient.post(`/api/roles/${encodeURIComponent(id)}/soft-delete`, { reason });
  },

  async restore(id: string): Promise<RoleDefinitionRow> {
    return apiClient.post(`/api/roles/${encodeURIComponent(id)}/restore`);
  },
};
