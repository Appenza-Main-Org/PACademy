/**
 * Dynamic Roles API — Gap C (admin-gaps).
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/roles                  → RoleDefinitionRow[]
 *   GET    /api/roles/:id              → RoleDefinitionRow
 *   POST   /api/roles                  → RoleDefinitionRow
 *   PATCH  /api/roles/:id              → RoleDefinitionRow  (system rows: scope only)
 *   POST   /api/roles/:id/soft-delete  → RoleDefinitionRow  (non-system only)
 *   POST   /api/roles/:id/restore      → RoleDefinitionRow
 *
 * The 11 seed roles are `isSystem: true`; their label/permissions/apps
 * are read-only. Custom roles created via this service can carry any
 * combination of permissions and AppKeys.
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import { emitAudit } from '@/shared/lib/audit';
import {
  applyRestore,
  applySoftDelete,
  filterDeleted,
  type DependencyResult,
} from '@/shared/lib/soft-delete';
import type { RoleDefinitionRow } from '@/shared/types/domain';

const STATE: RoleDefinitionRow[] = MOCK.roleDefinitions.map((r) => ({ ...r }));
let counter = 1;

export const rolesService = {
  async list(opts: { includeDeleted?: boolean } = {}): Promise<RoleDefinitionRow[]> {
    await simulateLatency();
    return [...filterDeleted(STATE, opts.includeDeleted)];
  },

  async getById(id: string): Promise<RoleDefinitionRow | null> {
    await simulateLatency();
    return STATE.find((r) => r.id === id) ?? null;
  },

  async create(payload: Omit<RoleDefinitionRow, 'id' | 'isSystem' | 'createdAt' | 'updatedAt'>): Promise<RoleDefinitionRow> {
    await simulateLatency();
    if (STATE.some((r) => r.key === payload.key)) {
      throw new Error('مفتاح الدور موجود بالفعل');
    }
    const now = new Date().toISOString();
    const row: RoleDefinitionRow = {
      ...payload,
      id: `ROLE-CUSTOM-${counter++}`,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    };
    STATE.unshift(row);
    emitAudit({
      action: 'create',
      module: 'roles',
      entityType: 'Role',
      entityLabel: 'دور',
      entityId: row.id,
      details: `إنشاء دور "${row.labelAr}"`,
      after: row,
    });
    return row;
  },

  async update(id: string, patch: Partial<RoleDefinitionRow>): Promise<RoleDefinitionRow> {
    await simulateLatency();
    const idx = STATE.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('الدور غير موجود');
    const before = { ...STATE[idx]! };
    /* System rows: only `scope` is editable. */
    const next: RoleDefinitionRow = before.isSystem
      ? { ...before, scope: patch.scope ?? before.scope, updatedAt: new Date().toISOString() }
      : {
          ...before,
          ...patch,
          id: before.id,
          isSystem: false,
          createdAt: before.createdAt,
          updatedAt: new Date().toISOString(),
        };
    STATE[idx] = next;
    emitAudit({
      action: 'update',
      module: 'roles',
      entityType: 'Role',
      entityLabel: 'دور',
      entityId: id,
      details: `تعديل دور "${next.labelAr}"`,
      before,
      after: next,
    });
    return next;
  },

  /**
   * Dependency check — Gap D pattern. Counts users assigned to this role
   * (by `key`); non-zero blocks soft-delete.
   */
  async getDependencies(id: string): Promise<DependencyResult> {
    await simulateLatency(60, 120);
    const role = STATE.find((r) => r.id === id);
    if (!role) throw new Error('الدور غير موجود');
    const users = MOCK.users.filter((u) => u.role === role.key).length;
    return { counts: { users }, blocking: users > 0 };
  },

  async softDelete(id: string, reason: string): Promise<RoleDefinitionRow> {
    await simulateLatency();
    const idx = STATE.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('الدور غير موجود');
    if (STATE[idx]!.isSystem) throw new Error('لا يمكن حذف دور نظام');
    const before = { ...STATE[idx]! };
    const next = applySoftDelete(STATE[idx]!, { reason });
    STATE[idx] = next;
    emitAudit({
      action: 'soft_delete',
      module: 'roles',
      entityType: 'Role',
      entityLabel: 'دور',
      entityId: id,
      details: `حذف دور "${before.labelAr}" — السبب: ${reason}`,
      before,
      after: next,
    });
    return next;
  },

  async restore(id: string): Promise<RoleDefinitionRow> {
    await simulateLatency();
    const idx = STATE.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('الدور غير موجود');
    const before = { ...STATE[idx]! };
    const next = applyRestore(STATE[idx]!);
    STATE[idx] = next;
    emitAudit({
      action: 'restore',
      module: 'roles',
      entityType: 'Role',
      entityLabel: 'دور',
      entityId: id,
      details: `استعادة دور "${next.labelAr}"`,
      before,
      after: next,
    });
    return next;
  },
};
