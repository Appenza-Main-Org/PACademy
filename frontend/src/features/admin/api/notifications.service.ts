/**
 * Admin Notifications API — Gap L (admin-gaps).
 *
 * Authoring surface for system-wide and targeted notifications. Distinct
 * from the `NotificationItem` toast surface (which is in-app delivery).
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/admin/notifications?status=          → AdminNotification[]
 *   GET    /api/admin/notifications/:id              → AdminNotification
 *   POST   /api/admin/notifications                  → AdminNotification
 *   PATCH  /api/admin/notifications/:id              → AdminNotification
 *   POST   /api/admin/notifications/:id/publish      → AdminNotification
 *   POST   /api/admin/notifications/:id/unpublish    → AdminNotification
 *   POST   /api/admin/notifications/:id/soft-delete  → AdminNotification
 *   GET    /api/applicants/:id/notifications         → AdminNotification[] (only published, non-expired, audience-targeted)
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import { emitAudit } from '@/shared/lib/audit';
import {
  applyRestore,
  applySoftDelete,
  filterDeleted,
} from '@/shared/lib/soft-delete';
import type {
  AdminNotification,
  AdminNotificationStatus,
  AudienceSelector,
} from '@/shared/types/domain';

const STATE: AdminNotification[] = MOCK.adminNotifications.map((n) => ({ ...n }));
let counter = STATE.length + 1;

/**
 * Pure function — derives `draft|scheduled|published|expired` from the
 * publish/expire window. No side effects; safe to call from UI for live
 * status display.
 */
export function computeStatus(
  now: number,
  publishAt: string,
  expireAt?: string,
): AdminNotificationStatus {
  const pub = new Date(publishAt).getTime();
  if (now < pub) return now > pub - 1 ? 'scheduled' : 'scheduled';
  if (expireAt && now > new Date(expireAt).getTime()) return 'expired';
  return 'published';
}

function withComputedStatus(n: AdminNotification): AdminNotification {
  /* If the row is a draft, leave it; otherwise recompute from now. */
  if (n.status === 'draft') return n;
  return { ...n, status: computeStatus(Date.now(), n.publishAt, n.expireAt) };
}

function singleAudienceTargets(
  audience: AudienceSelector,
  applicantId: string,
  applicantNid: string,
): boolean {
  switch (audience.type) {
    case 'general':
      return true;
    case 'student':
      return audience.nationalId === applicantNid || audience.applicantId === applicantId;
    case 'category': {
      const ap = MOCK.applicants.find((a) => a.id === applicantId);
      return Boolean(ap?.department && audience.categoryKeys.includes(ap.department as never));
    }
    case 'committee': {
      const ap = MOCK.applicants.find((a) => a.id === applicantId);
      return Boolean(ap?.committee && audience.committeeIds.includes(ap.committee));
    }
    case 'department': {
      const ap = MOCK.applicants.find((a) => a.id === applicantId);
      return Boolean(ap?.department && audience.departmentIds.includes(ap.department));
    }
  }
}

function audienceTargets(
  audience: readonly AudienceSelector[],
  applicantId: string,
  applicantNid: string,
): boolean {
  /* Empty array is treated as "general" so legacy/un-migrated rows still
   * deliver. Otherwise the notification matches an applicant if ANY
   * entry in the audience array matches (OR semantics). */
  if (audience.length === 0) return true;
  return audience.some((a) => singleAudienceTargets(a, applicantId, applicantNid));
}

export interface NotificationFilters {
  status?: AdminNotificationStatus | 'all';
  type?: AdminNotification['type'] | 'all';
  includeDeleted?: boolean;
}

export const notificationsService = {
  computeStatus,

  async list(filters: NotificationFilters = {}): Promise<AdminNotification[]> {
    await simulateLatency();
    let rows = filterDeleted(STATE, filters.includeDeleted).map(withComputedStatus);
    if (filters.status && filters.status !== 'all') rows = rows.filter((r) => r.status === filters.status);
    if (filters.type && filters.type !== 'all') rows = rows.filter((r) => r.type === filters.type);
    return [...rows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getById(id: string): Promise<AdminNotification | null> {
    await simulateLatency();
    const row = STATE.find((n) => n.id === id);
    return row ? withComputedStatus(row) : null;
  },

  async create(payload: Omit<AdminNotification, 'id' | 'status' | 'createdAt'>): Promise<AdminNotification> {
    await simulateLatency();
    const now = new Date().toISOString();
    const row: AdminNotification = {
      ...payload,
      id: `AN-${String(counter++).padStart(4, '0')}`,
      status: 'draft',
      createdAt: now,
    };
    STATE.unshift(row);
    emitAudit({
      action: 'create',
      module: 'notifications',
      entityType: 'AdminNotification',
      entityLabel: 'إشعار',
      entityId: row.id,
      details: `إنشاء إشعار "${row.titleAr}"`,
      after: row,
    });
    return row;
  },

  async update(id: string, patch: Partial<AdminNotification>): Promise<AdminNotification> {
    await simulateLatency();
    const idx = STATE.findIndex((n) => n.id === id);
    if (idx === -1) throw new Error('الإشعار غير موجود');
    const before = { ...STATE[idx] };
    const next: AdminNotification = { ...before, ...patch, id: before.id };
    STATE[idx] = next;
    emitAudit({
      action: 'update',
      module: 'notifications',
      entityType: 'AdminNotification',
      entityLabel: 'إشعار',
      entityId: id,
      details: `تعديل إشعار "${next.titleAr}"`,
      before,
      after: next,
    });
    return next;
  },

  async publish(id: string): Promise<AdminNotification> {
    await simulateLatency();
    const idx = STATE.findIndex((n) => n.id === id);
    if (idx === -1) throw new Error('الإشعار غير موجود');
    const before = { ...STATE[idx] };
    const status = computeStatus(Date.now(), before.publishAt, before.expireAt);
    STATE[idx] = { ...before, status };
    emitAudit({
      action: 'notification_published',
      module: 'notifications',
      entityType: 'AdminNotification',
      entityLabel: 'إشعار',
      entityId: id,
      details: `نشر إشعار "${before.titleAr}"`,
      before: { status: before.status },
      after: { status },
    });
    return STATE[idx];
  },

  async unpublish(id: string): Promise<AdminNotification> {
    await simulateLatency();
    const idx = STATE.findIndex((n) => n.id === id);
    if (idx === -1) throw new Error('الإشعار غير موجود');
    const before = { ...STATE[idx] };
    STATE[idx] = { ...before, status: 'draft' };
    emitAudit({
      action: 'notification_unpublished',
      module: 'notifications',
      entityType: 'AdminNotification',
      entityLabel: 'إشعار',
      entityId: id,
      details: `سحب إشعار "${before.titleAr}"`,
      before: { status: before.status },
      after: { status: 'draft' },
    });
    return STATE[idx];
  },

  async softDelete(id: string, reason: string): Promise<AdminNotification> {
    await simulateLatency();
    const idx = STATE.findIndex((n) => n.id === id);
    if (idx === -1) throw new Error('الإشعار غير موجود');
    const before = { ...STATE[idx] };
    const next = applySoftDelete(STATE[idx], { reason });
    STATE[idx] = next;
    emitAudit({
      action: 'soft_delete',
      module: 'notifications',
      entityType: 'AdminNotification',
      entityLabel: 'إشعار',
      entityId: id,
      details: `حذف إشعار "${before.titleAr}" — السبب: ${reason}`,
      before,
      after: next,
    });
    return next;
  },

  async restore(id: string): Promise<AdminNotification> {
    await simulateLatency();
    const idx = STATE.findIndex((n) => n.id === id);
    if (idx === -1) throw new Error('الإشعار غير موجود');
    const before = { ...STATE[idx] };
    const next = applyRestore(STATE[idx]);
    STATE[idx] = next;
    emitAudit({
      action: 'restore',
      module: 'notifications',
      entityType: 'AdminNotification',
      entityLabel: 'إشعار',
      entityId: id,
      details: `استعادة إشعار "${next.titleAr}"`,
      before,
      after: next,
    });
    return next;
  },

  /**
   * Returns published, non-expired notifications targeted at the given
   * applicant — surfaced on /applicant landing. Falls through to general
   * broadcasts only when the applicant id is unknown so the demo flow
   * always has something to render.
   */
  async listForApplicant(applicantId: string): Promise<AdminNotification[]> {
    await simulateLatency(80, 200);
    const ap = MOCK.applicants.find((a) => a.id === applicantId);
    const now = Date.now();
    return STATE
      .filter((n) => !n.deletedAt)
      .map(withComputedStatus)
      .filter((n) => n.status === 'published')
      .filter((n) => {
        if (!ap) {
          return n.audience.length === 0 || n.audience.some((a) => a.type === 'general');
        }
        return audienceTargets(n.audience, ap.id, ap.nationalId);
      })
      .filter((n) => !n.expireAt || new Date(n.expireAt).getTime() > now)
      .sort((a, b) => new Date(b.publishAt).getTime() - new Date(a.publishAt).getTime());
  },
};
