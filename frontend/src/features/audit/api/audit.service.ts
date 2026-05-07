/**
 * Audit API Contract — Sprint 1 (KARASA_GAPS §1.2.G).
 *
 * INTEGRATION CONTRACT (replace these methods to wire to real backend):
 *   GET /api/audit?action=&entity=&user=&since=&until=&limit=
 *   GET /api/audit/:id              → AuditEntry + diff
 *   GET /api/audit/:id/diff         → AuditDiff (before/after JSON)
 *   GET /api/audit/export?format=csv → file
 *   GET /api/audit/entity-types      → string[] of distinct entity types
 *   GET /api/audit/users             → distinct user IDs
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import type { AuditAction, AuditDiff, AuditEntry } from '@/shared/types/domain';

export interface AuditFilters {
  action?: AuditAction | 'all';
  userId?: string | 'all';
  entity?: string | 'all';
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
      since = null,
      until = null,
      limit = 200,
    } = filters;
    let items = MOCK.audit;
    if (action !== 'all') items = items.filter((e) => e.action === action);
    if (userId !== 'all') items = items.filter((e) => e.userId === userId);
    if (entity !== 'all') items = items.filter((e) => e.entity === entity);
    if (since !== null) items = items.filter((e) => e.timestamp >= since);
    if (until !== null) items = items.filter((e) => e.timestamp <= until);
    return items.slice(0, limit);
  },

  async getById(id: string): Promise<AuditEntry | null> {
    await simulateLatency();
    return MOCK.audit.find((e) => e.id === id) ?? null;
  },

  async getDiff(id: string): Promise<AuditDiff> {
    await simulateLatency();
    return MOCK.auditDiffs[id] ?? { before: null, after: null };
  },

  async getEntityTypes(): Promise<string[]> {
    await simulateLatency(80, 160);
    return Array.from(new Set(MOCK.audit.map((e) => e.entity)));
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
