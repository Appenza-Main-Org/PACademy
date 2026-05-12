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

import { apiClient } from '@/shared/api';
import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import type { AuditAction, AuditDiff, AuditEntry, AuditModule } from '@/shared/types/domain';

export interface AuditFilters {
  action?: AuditAction | 'all';
  userId?: string;
  /** Arabic entity label (existing). */
  entity?: string;
  /** Typed entity name — Gap E. */
  entityType?: string;
  /** Typed module taxonomy — Gap E. */
  module?: AuditModule | 'all';
  /** Actor role — Gap E. */
  role?: string;
  /** epoch ms lower bound */
  since?: number | null;
  /** epoch ms upper bound */
  until?: number | null;
  limit?: number;
}

/** Backend AuditEntryDto → frontend AuditEntry. Backend serializes Before/After
 *  as JSON strings; we parse them defensively. */
interface BackendAuditEntryDto {
  id: string;
  userId: string;
  userName: string;
  action: string;
  actionLabel: string;
  actionColor: string;
  entity: string;
  entityType: string;
  entityId: string;
  details: string;
  before: string | null;
  after: string | null;
  timestamp: number;
  at: string;
  ip: string;
}

function backendToFrontendAuditEntry(dto: BackendAuditEntryDto): AuditEntry {
  let before: unknown = null;
  let after: unknown = null;
  try { if (dto.before) before = JSON.parse(dto.before); } catch { before = dto.before; }
  try { if (dto.after) after = JSON.parse(dto.after); } catch { after = dto.after; }
  return {
    id: dto.id,
    userId: dto.userId,
    userName: dto.userName,
    action: dto.action as AuditAction,
    actionLabel: dto.actionLabel,
    actionColor: dto.actionColor as AuditEntry['actionColor'],
    entity: dto.entity,
    entityType: dto.entityType,
    entityId: dto.entityId,
    details: dto.details,
    before: before ?? undefined,
    after: after ?? undefined,
    timestamp: dto.timestamp,
    at: dto.at,
    ip: dto.ip,
  };
}

export const auditService = {
  async list(filters: AuditFilters = {}): Promise<AuditEntry[]> {
    const params: Record<string, string | number> = {};
    if (filters.action && filters.action !== 'all') params.action = filters.action;
    if (filters.entityType && filters.entityType !== 'all') params.entityType = filters.entityType;
    if (filters.userId && filters.userId !== 'all') params.userId = filters.userId;
    if (filters.since !== null && filters.since !== undefined) params.since = filters.since;
    if (filters.until !== null && filters.until !== undefined) params.until = filters.until;
    if (filters.limit) params.limit = filters.limit;
    const r = await apiClient.get<BackendAuditEntryDto[]>('/admin/audit', { params });
    return r.data.map(backendToFrontendAuditEntry);
  },

  async getById(id: string): Promise<AuditEntry | null> {
    try {
      const r = await apiClient.get<BackendAuditEntryDto>(`/admin/audit/${id}`);
      return backendToFrontendAuditEntry(r.data);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 404) return null;
      throw err;
    }
  },

  /**
   * Returns the diff for an audit entry. Backend embeds before/after as JSON
   * strings on the entry itself (no separate /diff endpoint needed); this
   * method now just re-uses getById and returns the parsed snapshots.
   */
  async getDiff(id: string): Promise<AuditDiff> {
    const entry = await this.getById(id);
    if (entry) {
      return {
        before: (entry.before ?? null) as AuditDiff['before'],
        after: (entry.after ?? null) as AuditDiff['after'],
      };
    }
    return { before: null, after: null };
  },

  async getEntityTypes(): Promise<string[]> {
    const r = await apiClient.get<string[]>('/admin/audit/entity-types');
    return r.data;
  },

  /** Distinct typed `module` values — backend returns the static module taxonomy. */
  async getModules(): Promise<AuditModule[]> {
    const r = await apiClient.get<string[]>('/admin/audit/modules');
    return r.data as AuditModule[];
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
