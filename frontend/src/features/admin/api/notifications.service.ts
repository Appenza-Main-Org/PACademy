/**
 * Admin Notifications API — Gap L (admin-gaps).
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/admin/notifications?status=&type=      → AdminNotification[]
 *   GET    /api/admin/notifications/:id                → AdminNotification | null
 *   POST   /api/admin/notifications                    → AdminNotification
 *   PATCH  /api/admin/notifications/:id                → AdminNotification
 *   POST   /api/admin/notifications/:id/publish        → AdminNotification
 *   POST   /api/admin/notifications/:id/unpublish      → AdminNotification
 *   POST   /api/admin/notifications/:id/soft-delete    → AdminNotification
 *   POST   /api/admin/notifications/:id/restore        → AdminNotification
 *   GET    /api/applicants/:id/notifications           → AdminNotification[]
 */

import { apiClient } from '@/shared/lib/api-client';
import type { AdminNotification, AdminNotificationStatus } from '@/shared/types/domain';

export interface NotificationFilters {
  status?: AdminNotificationStatus | 'all';
  type?: AdminNotification['type'] | 'all';
  includeDeleted?: boolean;
}

export function computeStatus(
  now: number,
  publishAt: string,
  expireAt?: string,
): AdminNotificationStatus {
  const pub = new Date(publishAt).getTime();
  if (now < pub) return 'scheduled';
  if (expireAt && now > new Date(expireAt).getTime()) return 'expired';
  return 'published';
}

export const notificationsService = {
  computeStatus,

  async list(filters: NotificationFilters = {}): Promise<AdminNotification[]> {
    return apiClient.get('/api/admin/notifications', { query: filters });
  },

  async getById(id: string): Promise<AdminNotification | null> {
    return apiClient.get(`/api/admin/notifications/${encodeURIComponent(id)}`);
  },

  async create(payload: Omit<AdminNotification, 'id' | 'status' | 'createdAt'>): Promise<AdminNotification> {
    return apiClient.post('/api/admin/notifications', payload);
  },

  async update(id: string, patch: Partial<AdminNotification>): Promise<AdminNotification> {
    return apiClient.patch(`/api/admin/notifications/${encodeURIComponent(id)}`, patch);
  },

  async publish(id: string): Promise<AdminNotification> {
    return apiClient.post(`/api/admin/notifications/${encodeURIComponent(id)}/publish`);
  },

  async unpublish(id: string): Promise<AdminNotification> {
    return apiClient.post(`/api/admin/notifications/${encodeURIComponent(id)}/unpublish`);
  },

  async softDelete(id: string, reason: string): Promise<AdminNotification> {
    return apiClient.post(`/api/admin/notifications/${encodeURIComponent(id)}/soft-delete`, { reason });
  },

  async restore(id: string): Promise<AdminNotification> {
    return apiClient.post(`/api/admin/notifications/${encodeURIComponent(id)}/restore`);
  },

  async listForApplicant(applicantId: string): Promise<AdminNotification[]> {
    return apiClient.get(`/api/applicants/${encodeURIComponent(applicantId)}/notifications`);
  },
};
