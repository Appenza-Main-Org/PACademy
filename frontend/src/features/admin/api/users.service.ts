/**
 * System Users API Contract — Sprint 1 (KARASA_GAPS §1.2.E).
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/users                          → SystemUser[]
 *   POST   /api/users                          → SystemUser (MOIPASS-backed creation)
 *   PATCH  /api/users/:id                      → SystemUser
 *   POST   /api/users/:id/deactivate           → SystemUser
 *   POST   /api/users/:id/reset-2fa            → { ok }
 *   POST   /api/users/bulk-assign              → { updated }
 *   GET    /api/users/:id/activity             → UserActivityEntry[]
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import { emitAudit } from '@/shared/lib/audit';
import type { SystemUser, SystemUserStatus, UserActivityEntry } from '@/shared/types/domain';

/* Backfill `status` from the legacy `active` flag so existing seed rows
 * carry the Gap C field without a migration. */
const STATE: SystemUser[] = MOCK.users.map((u) => ({
  ...u,
  status: u.status ?? (u.active ? 'active' : 'suspended'),
}));

let userCounter = STATE.length + 1;

export interface CreateUserPayload {
  name: string;
  role: string;
  unit: string;
  active?: boolean;
}

export const usersService = {
  async list(): Promise<SystemUser[]> {
    await simulateLatency();
    return [...STATE];
  },

  async getById(id: string): Promise<SystemUser | null> {
    await simulateLatency();
    return STATE.find((u) => u.id === id) ?? null;
  },

  async create(payload: CreateUserPayload): Promise<SystemUser> {
    await simulateLatency();
    const now = new Date().toISOString();
    const active = payload.active ?? true;
    const user: SystemUser = {
      id: `U-${String(userCounter++).padStart(3, '0')}`,
      name: payload.name,
      role: payload.role,
      unit: payload.unit,
      active,
      status: active ? 'active' : 'suspended',
      lastLogin: 0,
      nationalId: '',
      fullArabicName: payload.name,
      officerCode: '',
      mobileNumber: '',
      userType: 'civilian',
      roles: [payload.role],
      accountStatus: active ? 'active' : 'inactive',
      createdAt: now,
      updatedAt: now,
    };
    STATE.unshift(user);
    return user;
  },

  async update(id: string, patch: Partial<SystemUser>): Promise<SystemUser> {
    await simulateLatency();
    const idx = STATE.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error('المستخدم غير موجود');
    STATE[idx] = { ...STATE[idx], ...patch } as SystemUser;
    return STATE[idx]!;
  },

  async deactivate(id: string): Promise<SystemUser> {
    return usersService.update(id, { active: false });
  },

  async reset2fa(_id: string): Promise<{ ok: true }> {
    await simulateLatency();
    /* In real backend this invalidates TOTP seed and triggers SMS to user. */
    return { ok: true };
  },

  async bulkAssign(ids: ReadonlyArray<string>, role: string): Promise<{ updated: number }> {
    await simulateLatency(400, 800);
    let updated = 0;
    ids.forEach((id) => {
      const idx = STATE.findIndex((u) => u.id === id);
      if (idx !== -1) {
        STATE[idx] = { ...STATE[idx], role } as SystemUser;
        updated += 1;
      }
    });
    return { updated };
  },

  async getActivity(id: string): Promise<UserActivityEntry[]> {
    await simulateLatency();
    return MOCK.userActivity.filter((e) => e.userId === id).sort((a, b) => b.ts - a.ts);
  },

  /**
   * Set the typed status — `active` / `suspended` / `locked`. Emits audit
   * with before/after; back-fills `active` for existing consumers.
   */
  async setStatus(id: string, status: SystemUserStatus, reason?: string): Promise<SystemUser> {
    await simulateLatency();
    const idx = STATE.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error('المستخدم غير موجود');
    const before = { ...STATE[idx]! };
    STATE[idx] = {
      ...before,
      status,
      active: status === 'active',
    };
    emitAudit({
      action: 'update',
      module: 'users',
      entityType: 'SystemUser',
      entityLabel: 'مستخدم',
      entityId: id,
      details: reason ? `تغيير الحالة → ${status} (${reason})` : `تغيير الحالة → ${status}`,
      before: { status: before.status, active: before.active },
      after: { status, active: status === 'active' },
    });
    return STATE[idx]!;
  },
};
