/**
 * Audit API Contract — Sprint 1 (KARASA_GAPS §1.2.G), extended Gap E
 * (admin-gaps) with role/module/entityType filters and inline diff support.
 *
 * Append-only — real backend rejects update/delete on audit rows; the
 * service intentionally exposes no mutation/removal methods.
 *
 * INTEGRATION CONTRACT (replace these methods to wire to real backend):
 *   GET /api/audit?action=&entity=&entityType=&user=&role=&module=&since=&until=&limit=
 *   GET /api/audit/:id              → AuditEntry + diff
 *   GET /api/audit/:id/diff         → AuditDiff (before/after JSON)
 *   GET /api/audit/export?format=csv → file
 *   GET /api/audit/entity-types      → string[] of distinct entity types
 *   GET /api/audit/modules           → string[] of distinct modules
 *   GET /api/audit/roles             → string[] of distinct roles
 *   GET /api/audit/users             → distinct user IDs
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import type { AuditAction, AuditDiff, AuditEntry, AuditModule } from '@/shared/types/domain';

export interface AuditFilters {
  action?: AuditAction | 'all';
  userId?: string | 'all';
  /** Arabic entity label (existing). */
  entity?: string | 'all';
  /** Typed entity name — Gap E. */
  entityType?: string | 'all';
  /** Typed module taxonomy — Gap E. */
  module?: AuditModule | 'all';
  /** Actor role — Gap E. */
  role?: string | 'all';
  /** epoch ms lower bound */
  since?: number | null;
  /** epoch ms upper bound */
  until?: number | null;
  limit?: number;
}

export const auditService = {
  async list(filters: AuditFilters = {}): Promise<AuditEntry[]> {
    await simulateLatency();
    const {
      action = 'all',
      userId = 'all',
      entity = 'all',
      entityType = 'all',
      module = 'all',
      role = 'all',
      since = null,
      until = null,
      limit = 200,
    } = filters;
    let items = MOCK.audit;
    if (action !== 'all') items = items.filter((e) => e.action === action);
    if (userId !== 'all') items = items.filter((e) => e.userId === userId);
    if (entity !== 'all') items = items.filter((e) => e.entity === entity);
    if (entityType !== 'all') items = items.filter((e) => e.entityType === entityType);
    if (module !== 'all') items = items.filter((e) => e.module === module);
    if (role !== 'all') items = items.filter((e) => e.role === role);
    if (since !== null) items = items.filter((e) => e.timestamp >= since);
    if (until !== null) items = items.filter((e) => e.timestamp <= until);
    return items.slice(0, limit);
  },

  async getById(id: string): Promise<AuditEntry | null> {
    await simulateLatency();
    return MOCK.audit.find((e) => e.id === id) ?? null;
  },

  /**
   * Returns the diff for an audit entry. New (Gap E) entries carry inline
   * `before` / `after` snapshots; legacy seeded entries fall back to the
   * MOCK.auditDiffs side-table.
   */
  async getDiff(id: string): Promise<AuditDiff> {
    await simulateLatency();
    const entry = MOCK.audit.find((e) => e.id === id);
    if (entry && (entry.before !== undefined || entry.after !== undefined)) {
      return {
        before: (entry.before ?? null) as AuditDiff['before'],
        after: (entry.after ?? null) as AuditDiff['after'],
      };
    }
    return MOCK.auditDiffs[id] ?? { before: null, after: null };
  },

  async getEntityTypes(): Promise<string[]> {
    await simulateLatency(80, 160);
    return Array.from(new Set(MOCK.audit.map((e) => e.entity)));
  },

  /** Distinct typed `module` values present in MOCK.audit (Gap E). */
  async getModules(): Promise<AuditModule[]> {
    await simulateLatency(80, 160);
    const set = new Set<AuditModule>();
    for (const e of MOCK.audit) if (e.module) set.add(e.module);
    return Array.from(set);
  },

  /** Distinct actor roles present in MOCK.audit (Gap E). */
  async getRoles(): Promise<string[]> {
    await simulateLatency(80, 160);
    const set = new Set<string>();
    for (const e of MOCK.audit) if (e.role) set.add(e.role);
    return Array.from(set);
  },

  async getUsers(): Promise<{ id: string; name: string }[]> {
    await simulateLatency(80, 160);
    const seen = new Map<string, string>();
    for (const e of MOCK.audit) if (!seen.has(e.userId)) seen.set(e.userId, e.userName);
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  },

  /**
   * CSV export. Real backend streams a signed-URL file; the shape stays
   * the same — consumers receive a Blob ready for download.
   */
  async exportCsv(filters: AuditFilters = {}): Promise<Blob> {
    const items = await auditService.list({ ...filters, limit: 10_000 });
    const header = ['id', 'timestamp', 'user', 'action', 'entity', 'entityId', 'details', 'ip'];
    const rows = items.map((e) => [
      e.id,
      new Date(e.timestamp).toISOString(),
      escapeCell(e.userName),
      escapeCell(e.actionLabel),
      escapeCell(e.entity),
      e.entityId,
      escapeCell(e.details),
      e.ip,
    ]);
    /* UTF-8 BOM so Excel renders Arabic correctly. */
    const body = '﻿' + [header.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    return new Blob([body], { type: 'text/csv;charset=utf-8' });
  },
};

function escapeCell(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}
