/**
 * System Users API Contract — Sprint 1 (KARASA_GAPS §1.2.E).
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/users
 *   GET    /api/users/:id
 *   POST   /api/users
 *   PATCH  /api/users/:id
 *   POST   /api/users/:id/status
 *   POST   /api/users/:id/deactivate
 *   POST   /api/users/:id/reset-2fa
 *   POST   /api/users/bulk-assign
 *   POST   /api/users/bulk-import
 *   POST   /api/users/from-template
 *   GET    /api/users/:id/activity
 */

import { apiClient } from '@/shared/lib/api-client';
import type {
  AccountStatus,
  SystemUser,
  SystemUserStatus,
  UserActivityEntry,
  UserType,
} from '@/shared/types/domain';

export interface CreateUserPayload {
  nationalId: string;
  fullArabicName: string;
  officerCode: string;
  mobileNumber: string;
  userType: UserType;
  roles: string[];
  accountStatus: AccountStatus;
  actorId?: string;
}

export interface UpdateUserPayload {
  fullArabicName?: string;
  officerCode?: string;
  mobileNumber?: string;
  userType?: UserType;
  roles?: string[];
  accountStatus?: AccountStatus;
}

export interface SetAccountStatusInput {
  id: string;
  next: AccountStatus;
  reason?: string;
  actorId?: string;
}

export interface BulkImportUserRow {
  nationalId: string;
  fullArabicName: string;
  officerCode: string;
  mobileNumber: string;
  userType: UserType;
  roles: string[];
  accountStatus: AccountStatus;
}

export const usersService = {
  async list(): Promise<SystemUser[]> {
    return apiClient.get('/api/users');
  },

  async getById(id: string): Promise<SystemUser | null> {
    return apiClient.get(`/api/users/${encodeURIComponent(id)}`);
  },

  async create(payload: CreateUserPayload): Promise<SystemUser> {
    return apiClient.post('/api/users', payload);
  },

  async update(id: string, patch: UpdateUserPayload): Promise<SystemUser> {
    return apiClient.patch(`/api/users/${encodeURIComponent(id)}`, patch);
  },

  async setAccountStatus(input: SetAccountStatusInput): Promise<SystemUser> {
    return apiClient.post(`/api/users/${encodeURIComponent(input.id)}/status`, {
      status: input.next,
      reason: input.reason,
      actorId: input.actorId,
    });
  },

  async deactivate(id: string): Promise<SystemUser> {
    return apiClient.post(`/api/users/${encodeURIComponent(id)}/deactivate`);
  },

  async reset2fa(id: string): Promise<{ ok: true }> {
    return apiClient.post(`/api/users/${encodeURIComponent(id)}/reset-2fa`);
  },

  async bulkAssign(ids: ReadonlyArray<string>, role: string): Promise<{ updated: number }> {
    return apiClient.post('/api/users/bulk-assign', { ids, role });
  },

  async getActivity(id: string): Promise<UserActivityEntry[]> {
    return apiClient.get(`/api/users/${encodeURIComponent(id)}/activity`);
  },

  async setStatus(id: string, status: SystemUserStatus, reason?: string): Promise<SystemUser> {
    return apiClient.post(`/api/users/${encodeURIComponent(id)}/status`, { status, reason });
  },

  async bulkImport(rows: ReadonlyArray<BulkImportUserRow>): Promise<{
    attemptedCount: number;
    successCount: number;
    failedRows: ReadonlyArray<{ rowIndex: number; errors: ReadonlyArray<string> }>;
  }> {
    return apiClient.post('/api/users/bulk-import', rows);
  },

  async createFromTemplate(
    sourceId: string,
    overrides: { nationalId: string; fullArabicName: string; officerCode: string; mobileNumber: string },
  ): Promise<SystemUser> {
    return apiClient.post('/api/users/from-template', { sourceId, overrides });
  },
};
