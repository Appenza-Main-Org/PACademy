/**
 * System Users API Service — wired to real backend (spec 003, T174).
 *
 * INTEGRATION CONTRACT:
 *   GET    /admin/users                     → PagedResult<SystemUserListItemDto>
 *   GET    /admin/users/:id                 → SystemUserDetailDto
 *   POST   /admin/users                     → SystemUserDetailDto (201)
 *   PATCH  /admin/users/:id                 → SystemUserDetailDto
 *   POST   /admin/users/:id/deactivate      → 204  (implemented in US3)
 */

import { apiClient } from '@/shared/api/client';
import type {
  CreateSystemUserRequest,
  SystemUserDetailDto,
  SystemUserListFilters,
  SystemUserListItemDto,
  UpdateSystemUserRequest,
} from '@/shared/types/domain';
import type { PagedResult } from '@/shared/types/api';

export const usersService = {
  async list(filters?: SystemUserListFilters): Promise<PagedResult<SystemUserListItemDto>> {
    const { data } = await apiClient.get<PagedResult<SystemUserListItemDto>>('/admin/users', {
      params: filters,
    });
    return data;
  },

  async getById(id: string): Promise<SystemUserDetailDto | null> {
    try {
      const { data } = await apiClient.get<SystemUserDetailDto>(`/admin/users/${id}`);
      return data;
    } catch {
      return null;
    }
  },

  async create(request: CreateSystemUserRequest): Promise<SystemUserDetailDto> {
    const { data } = await apiClient.post<SystemUserDetailDto>('/admin/users', request);
    return data;
  },

  async update(id: string, request: UpdateSystemUserRequest): Promise<SystemUserDetailDto> {
    const { data } = await apiClient.patch<SystemUserDetailDto>(`/admin/users/${id}`, request);
    return data;
  },

  async deactivate(id: string): Promise<void> {
    await apiClient.post(`/admin/users/${id}/deactivate`);
  },
};
