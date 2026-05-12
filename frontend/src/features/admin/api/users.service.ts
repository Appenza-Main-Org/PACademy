/**
 * System Users API Contract — Sprint 1 (KARASA_GAPS §1.2.E) +
 * admin-create NID flow extensions (multi-role, accountStatus, NID metadata).
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/users                          → SystemUser[]
 *   GET    /api/users/:id                      → SystemUser
 *   POST   /api/users                          → SystemUser   (NID-driven creation)
 *   PATCH  /api/users/:id                      → SystemUser   (multi-role, status)
 *   POST   /api/users/:id/status               → SystemUser   (active/inactive toggle)
 *   POST   /api/users/:id/deactivate           → SystemUser   (legacy alias)
 *   POST   /api/users/:id/reset-2fa            → { ok }
 *   POST   /api/users/bulk-assign              → { updated }
 *   GET    /api/users/:id/activity             → UserActivityEntry[]
 *
 * Audit: every mutation emits via `withAudit` / `emitAudit` so `/admin/audit`
 * surfaces it on next refetch. Audit codes:
 *   user_created, user_updated, user_status_changed, user_roles_changed.
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import { emitAudit, withAudit } from '@/shared/lib/audit';
import { StatusChangeBlockedError } from '@/shared/lib/errors';
import { validateRoleSet } from '../lib/role-rules';
import type {
  AccountStatus,
  SystemUser,
  SystemUserStatus,
  UserActivityEntry,
  UserType,
} from '@/shared/types/domain';

/* Backfill from the mock seed. The seed already produces fully-shaped
 * rows (Phase 1) so the map is now identity — kept here as a single
 * conversion site for the "live state" view. */
const STATE: SystemUser[] = MOCK.users.map((u) => ({ ...u }));

let userCounter = STATE.length + 1;

/** Convenience for the shape changes we report back in audit diffs.
 *  Keep narrow — the rest of SystemUser is verbose. */
type UserAuditShape = Pick<
  SystemUser,
  'id' | 'fullArabicName' | 'roles' | 'role' | 'accountStatus' | 'status' | 'active'
>;

function snapshot(u: SystemUser): UserAuditShape {
  return {
    id: u.id,
    fullArabicName: u.fullArabicName,
    roles: [...u.roles],
    role: u.role,
    accountStatus: u.accountStatus,
    status: u.status,
    active: u.active,
  };
}

function mapAccountStatusToLegacy(next: AccountStatus): { active: boolean; status: SystemUserStatus } {
  return next === 'active'
    ? { active: true, status: 'active' }
    : { active: false, status: 'suspended' };
}

export interface CreateUserPayload {
  /** Required — NID-driven creation. The form gates submission on a
   *  successful lookup, so the four metadata fields below are populated
   *  from the directory result. */
  nationalId: string;
  fullArabicName: string;
  officerCode: string;
  mobileNumber: string;
  userType: UserType;
  /** Multi-role assignment — at least one. */
  roles: string[];
  unit?: string;
  accountStatus: AccountStatus;
  /** Optional override for the actor (defaults to the auth-store user). */
  actorId?: string;
}

export interface UpdateUserPayload {
  fullArabicName?: string;
  officerCode?: string;
  mobileNumber?: string;
  userType?: UserType;
  unit?: string;
  roles?: string[];
  accountStatus?: AccountStatus;
}

export interface SetAccountStatusInput {
  id: string;
  next: AccountStatus;
  reason?: string;
  /** Actor id — used to block self-deactivation. Defaults to auth-store. */
  actorId?: string;
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

  /**
   * INTEGRATION CONTRACT
   * Real endpoint: POST /api/users
   * Body: CreateUserPayload — backend validates NID against personnel
   * directory; returns the issued SystemUser.
   * Audit: `user_created` with the new row as `after`.
   */
  async create(payload: CreateUserPayload): Promise<SystemUser> {
    const validation = validateRoleSet(payload.roles);
    if (!validation.ok) {
      throw new Error(validation.message ?? 'مجموعة الأدوار غير صالحة');
    }
    return withAudit(
      async () => {
        await simulateLatency();
        const now = new Date().toISOString();
        const legacy = mapAccountStatusToLegacy(payload.accountStatus);
        const user: SystemUser = {
          id: `U-${String(userCounter++).padStart(3, '0')}`,
          name: payload.fullArabicName,
          role: payload.roles[0], /* legacy single-role mirror */
          unit: payload.unit ?? '',
          active: legacy.active,
          status: legacy.status,
          lastLogin: 0,
          nationalId: payload.nationalId,
          fullArabicName: payload.fullArabicName,
          officerCode: payload.officerCode,
          mobileNumber: payload.mobileNumber,
          userType: payload.userType,
          roles: [...payload.roles],
          accountStatus: payload.accountStatus,
          createdAt: now,
          updatedAt: now,
        };
        STATE.unshift(user);
        return user;
      },
      {
        action: 'user_created',
        module: 'users',
        entityType: 'SystemUser',
        entityLabel: 'مستخدم',
        entityId: `pending-${userCounter}`,
        details: `إنشاء حساب: ${payload.fullArabicName} (${payload.nationalId})`,
        afterFrom: (u) => snapshot(u),
      },
    );
  },

  /**
   * INTEGRATION CONTRACT
   * Real endpoint: PATCH /api/users/:id
   * Audit: `user_updated` with before/after diff. If `roles` changed,
   * also emits `user_roles_changed`. If `accountStatus` changed, also
   * emits `user_status_changed`.
   */
  async update(id: string, patch: UpdateUserPayload): Promise<SystemUser> {
    await simulateLatency();
    const idx = STATE.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error('المستخدم غير موجود');
    const before = STATE[idx];
    const beforeShape = snapshot(before);

    const nextRoles = patch.roles ? [...patch.roles] : [...before.roles];
    if (patch.roles) {
      const validation = validateRoleSet(nextRoles);
      if (!validation.ok) {
        throw new Error(validation.message ?? 'مجموعة الأدوار غير صالحة');
      }
    }
    const nextAccountStatus = patch.accountStatus ?? before.accountStatus;
    const legacy = mapAccountStatusToLegacy(nextAccountStatus);
    const updated: SystemUser = {
      ...before,
      fullArabicName: patch.fullArabicName ?? before.fullArabicName,
      name: patch.fullArabicName ?? before.name,
      officerCode: patch.officerCode ?? before.officerCode,
      mobileNumber: patch.mobileNumber ?? before.mobileNumber,
      userType: patch.userType ?? before.userType,
      unit: patch.unit ?? before.unit,
      roles: nextRoles,
      role: nextRoles[0] ?? before.role,
      accountStatus: nextAccountStatus,
      active: legacy.active,
      status: legacy.status,
      updatedAt: new Date().toISOString(),
    };
    STATE[idx] = updated;
    const afterShape = snapshot(updated);

    emitAudit({
      action: 'user_updated',
      module: 'users',
      entityType: 'SystemUser',
      entityLabel: 'مستخدم',
      entityId: id,
      details: `تعديل ${before.fullArabicName}`,
      before: beforeShape,
      after: afterShape,
    });

    const rolesChanged =
      beforeShape.roles.length !== afterShape.roles.length ||
      beforeShape.roles.some((r, i) => r !== afterShape.roles[i]);
    if (rolesChanged) {
      emitAudit({
        action: 'user_roles_changed',
        module: 'users',
        entityType: 'SystemUser',
        entityLabel: 'مستخدم',
        entityId: id,
        details: `تعديل الأدوار: [${beforeShape.roles.join(', ')}] → [${afterShape.roles.join(', ')}]`,
        before: { roles: beforeShape.roles },
        after: { roles: afterShape.roles },
      });
    }
    if (beforeShape.accountStatus !== afterShape.accountStatus) {
      emitAudit({
        action: 'user_status_changed',
        module: 'users',
        entityType: 'SystemUser',
        entityLabel: 'مستخدم',
        entityId: id,
        details: `تغيير الحالة: ${beforeShape.accountStatus} → ${afterShape.accountStatus}`,
        before: { accountStatus: beforeShape.accountStatus },
        after: { accountStatus: afterShape.accountStatus },
      });
    }
    return updated;
  },

  /**
   * INTEGRATION CONTRACT
   * Real endpoint: POST /api/users/:id/status
   * Body: { status: 'active' | 'inactive', reason?: string }
   * Errors: StatusChangeBlockedError (self-deactivation, last super_admin).
   * Audit: `user_status_changed` with before/after.
   */
  async setAccountStatus(input: SetAccountStatusInput): Promise<SystemUser> {
    await simulateLatency();
    const idx = STATE.findIndex((u) => u.id === input.id);
    if (idx === -1) throw new Error('المستخدم غير موجود');
    const before = STATE[idx];

    if (input.next === 'inactive') {
      /* Self-deactivation guard. */
      if (input.actorId && input.actorId === before.id) {
        throw new StatusChangeBlockedError(
          'self_deactivation',
          'لا يمكن تعطيل حسابك الخاص',
        );
      }
      /* Last-super-admin guard. */
      const isSuperAdmin = before.roles.includes('super_admin') || before.role === 'super_admin';
      if (isSuperAdmin) {
        const otherActiveSupers = STATE.filter(
          (u) =>
            u.id !== before.id &&
            u.accountStatus === 'active' &&
            (u.roles.includes('super_admin') || u.role === 'super_admin'),
        );
        if (otherActiveSupers.length === 0) {
          throw new StatusChangeBlockedError(
            'last_super_admin',
            'يجب وجود مدير نظام نشط واحد على الأقل',
          );
        }
      }
    }

    if (before.accountStatus === input.next) {
      /* No-op; do not emit audit for no-change. */
      return before;
    }

    const legacy = mapAccountStatusToLegacy(input.next);
    const updated: SystemUser = {
      ...before,
      accountStatus: input.next,
      active: legacy.active,
      status: legacy.status,
      updatedAt: new Date().toISOString(),
    };
    STATE[idx] = updated;

    emitAudit({
      action: 'user_status_changed',
      module: 'users',
      entityType: 'SystemUser',
      entityLabel: 'مستخدم',
      entityId: input.id,
      details: input.reason
        ? `تغيير الحالة: ${before.accountStatus} → ${input.next} — ${input.reason}`
        : `تغيير الحالة: ${before.accountStatus} → ${input.next}`,
      before: { accountStatus: before.accountStatus },
      after: { accountStatus: input.next },
    });
    return updated;
  },

  /** Legacy alias retained for callsites that pre-date `setAccountStatus`. */
  async deactivate(id: string): Promise<SystemUser> {
    return usersService.setAccountStatus({ id, next: 'inactive' });
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
        const before = STATE[idx];
        const nextRoles = before.roles.includes(role) ? before.roles : [role, ...before.roles.filter((r) => r !== role)];
        const updatedUser: SystemUser = {
          ...before,
          role,
          roles: nextRoles,
          updatedAt: new Date().toISOString(),
        };
        STATE[idx] = updatedUser;
        emitAudit({
          action: 'user_roles_changed',
          module: 'users',
          entityType: 'SystemUser',
          entityLabel: 'مستخدم',
          entityId: id,
          details: `تعيين الدور (إجراء جماعي): ${role}`,
          before: { roles: before.roles },
          after: { roles: nextRoles },
        });
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
   * Legacy typed-status setter — `active` / `suspended` / `locked`. Kept
   * for the lockout flow (Gap A) which uses the three-state union. The
   * Active/Inactive admin toggle uses `setAccountStatus`.
   */
  async setStatus(id: string, status: SystemUserStatus, reason?: string): Promise<SystemUser> {
    await simulateLatency();
    const idx = STATE.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error('المستخدم غير موجود');
    const before = { ...STATE[idx] };
    const accountStatus: AccountStatus = status === 'active' ? 'active' : 'inactive';
    STATE[idx] = {
      ...before,
      status,
      active: status === 'active',
      accountStatus,
      updatedAt: new Date().toISOString(),
    };
    emitAudit({
      action: 'user_status_changed',
      module: 'users',
      entityType: 'SystemUser',
      entityLabel: 'مستخدم',
      entityId: id,
      details: reason ? `تغيير الحالة → ${status} (${reason})` : `تغيير الحالة → ${status}`,
      before: { status: before.status, active: before.active, accountStatus: before.accountStatus },
      after: { status, active: status === 'active', accountStatus },
    });
    return STATE[idx];
  },

  /**
   * INTEGRATION CONTRACT
   * Real endpoint: POST /api/users/bulk-import
   * Body: BulkImportUserRow[] — backend re-validates each NID via the
   * officer-directory and returns per-row outcomes. The frontend mirror
   * commits valid rows individually so the audit chain is preserved
   * (one `user_created` per row, identical to manual creation).
   * NID-cycle uniqueness and self-deactivation guards do not apply
   * here — admin-created accounts are always new.
   */
  async bulkImport(rows: ReadonlyArray<BulkImportUserRow>): Promise<{
    attemptedCount: number;
    successCount: number;
    failedRows: ReadonlyArray<{ rowIndex: number; errors: ReadonlyArray<string> }>;
  }> {
    await simulateLatency(400, 800);
    let successCount = 0;
    const failedRows: { rowIndex: number; errors: string[] }[] = [];
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      try {
        const duplicate = STATE.find((u) => u.nationalId === row.nationalId);
        if (duplicate) {
          failedRows.push({ rowIndex: i, errors: [`الرقم القومي مستخدم بالفعل (${duplicate.id})`] });
          continue;
        }
        const validation = validateRoleSet(row.roles);
        if (!validation.ok) {
          failedRows.push({ rowIndex: i, errors: [validation.message ?? 'مجموعة الأدوار غير صالحة'] });
          continue;
        }
        await usersService.create({
          nationalId: row.nationalId,
          fullArabicName: row.fullArabicName,
          officerCode: row.officerCode,
          mobileNumber: row.mobileNumber,
          userType: row.userType,
          roles: row.roles,
          unit: row.unit,
          accountStatus: row.accountStatus,
        });
        successCount += 1;
      } catch (err) {
        failedRows.push({
          rowIndex: i,
          errors: [err instanceof Error ? err.message : 'تعذّر إنشاء المستخدم'],
        });
      }
    }
    return { attemptedCount: rows.length, successCount, failedRows };
  },

  /**
   * INTEGRATION CONTRACT
   * Real endpoint: POST /api/users/from-template
   * Body: { sourceId, overrides } — clones role-set + scope from the
   * source user; the new NID + mobile must be supplied by the caller
   * since NID is the source of identity (Gap B). Account lands inactive
   * so the admin explicitly activates it after review.
   * Audit: `user_created` plus a `user_roles_changed` mirror entry.
   */
  async createFromTemplate(
    sourceId: string,
    overrides: { nationalId: string; fullArabicName: string; officerCode: string; mobileNumber: string },
  ): Promise<SystemUser> {
    await simulateLatency();
    const source = STATE.find((u) => u.id === sourceId);
    if (!source) throw new Error('المستخدم المصدر غير موجود');
    return usersService.create({
      nationalId: overrides.nationalId,
      fullArabicName: overrides.fullArabicName,
      officerCode: overrides.officerCode,
      mobileNumber: overrides.mobileNumber,
      userType: source.userType,
      roles: [...source.roles],
      unit: source.unit,
      accountStatus: 'inactive',
    });
  },
};

export interface BulkImportUserRow {
  nationalId: string;
  fullArabicName: string;
  officerCode: string;
  mobileNumber: string;
  userType: UserType;
  roles: string[];
  unit?: string;
  accountStatus: AccountStatus;
}
