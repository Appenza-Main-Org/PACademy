/**
 * Reference data API Contract — Sprint 1 (KARASA_GAPS §1.2.B).
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/reference-data/:tab                  → row[]
 *   POST   /api/reference-data/:tab                  → row
 *   PATCH  /api/reference-data/:tab/:id              → row
 *   DELETE /api/reference-data/:tab/:id              → { ok }
 *   POST   /api/reference-data/:tab/bulk-import      → { imported, errors }
 *
 * Mock CRUD writes to an in-memory snapshot of the deterministic seed so
 * demo flows can mutate without persisting beyond the page session.
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
import type { ReferenceRowMap, ReferenceTab, SoftDeleteFields } from '@/shared/types/domain';

/**
 * Internally we erase the generic to a record of `unknown[]` to avoid the
 * TypeScript variance pitfalls when assigning back to a polymorphic key.
 * External methods cast on the boundary so consumers still get full typing.
 */
type LooseState = Record<ReferenceTab, unknown[]>;

const STATE: LooseState = {
  governorates:    [...MOCK.referenceData.governorates],
  specializations: [...MOCK.referenceData.specializations],
  ranks:           [...MOCK.referenceData.ranks],
  nationalities:   [...MOCK.referenceData.nationalities],
  relationships:   [...MOCK.referenceData.relationships],
  'case-types':    [...MOCK.referenceData['case-types']],
};

let nextId = 1;
const newId = (tab: ReferenceTab): string =>
  `${tab.slice(0, 3).toUpperCase()}-NEW-${String(nextId++).padStart(3, '0')}`;

export const referenceDataService = {
  async list<K extends ReferenceTab>(
    tab: K,
    opts: { includeDeleted?: boolean } = {},
  ): Promise<ReferenceRowMap[K][]> {
    await simulateLatency();
    const all = STATE[tab] as ReferenceRowMap[K][];
    return [...filterDeleted(all as (ReferenceRowMap[K] & SoftDeleteFields)[], opts.includeDeleted)];
  },

  async create<K extends ReferenceTab>(
    tab: K,
    payload: Omit<ReferenceRowMap[K], 'id'>,
  ): Promise<ReferenceRowMap[K]> {
    await simulateLatency();
    const row = { ...payload, id: newId(tab) } as ReferenceRowMap[K];
    STATE[tab] = [row, ...(STATE[tab] as ReferenceRowMap[K][])];
    return row;
  },

  async update<K extends ReferenceTab>(
    tab: K,
    id: string,
    patch: Partial<ReferenceRowMap[K]>,
  ): Promise<ReferenceRowMap[K]> {
    await simulateLatency();
    const list = STATE[tab] as ReferenceRowMap[K][];
    const idx = list.findIndex((r) => (r as { id: string }).id === id);
    if (idx === -1) throw new Error('السجل غير موجود');
    const merged = { ...list[idx], ...patch } as ReferenceRowMap[K];
    list[idx] = merged;
    return merged;
  },

  async remove<K extends ReferenceTab>(tab: K, id: string): Promise<{ ok: true }> {
    await simulateLatency();
    STATE[tab] = (STATE[tab] as ReferenceRowMap[K][]).filter(
      (r) => (r as { id: string }).id !== id,
    );
    return { ok: true };
  },

  /**
   * Reference rows are leaf data — no child entities can reference them
   * yet (the typed dependency graph is only modelled for cycles/categories
   * in this gap). Returns an always-non-blocking result so the dialog
   * still surfaces the audit reason input. Gap I will tighten this when
   * the lookup matrix lands.
   */
  async getDependencies(): Promise<DependencyResult> {
    await simulateLatency(60, 120);
    return { counts: {}, blocking: false };
  },

  async softDelete<K extends ReferenceTab>(
    tab: K,
    id: string,
    reason: string,
  ): Promise<ReferenceRowMap[K]> {
    await simulateLatency();
    const list = STATE[tab] as (ReferenceRowMap[K] & SoftDeleteFields)[];
    const idx = list.findIndex((r) => (r as { id: string }).id === id);
    if (idx === -1) throw new Error('السجل غير موجود');
    const before = { ...list[idx]! };
    const next = applySoftDelete(list[idx]!, { reason }) as ReferenceRowMap[K] & SoftDeleteFields;
    list[idx] = next;
    emitAudit({
      action: 'soft_delete',
      module: 'lookups',
      entityType: tab,
      entityLabel: 'بيانات مرجعية',
      entityId: id,
      details: `تم حذف سجل من ${tab} — السبب: ${reason}`,
      before,
      after: next,
    });
    return next;
  },

  async restore<K extends ReferenceTab>(tab: K, id: string): Promise<ReferenceRowMap[K]> {
    await simulateLatency();
    const list = STATE[tab] as (ReferenceRowMap[K] & SoftDeleteFields)[];
    const idx = list.findIndex((r) => (r as { id: string }).id === id);
    if (idx === -1) throw new Error('السجل غير موجود');
    const before = { ...list[idx]! };
    const next = applyRestore(list[idx]!) as ReferenceRowMap[K] & SoftDeleteFields;
    list[idx] = next;
    emitAudit({
      action: 'restore',
      module: 'lookups',
      entityType: tab,
      entityLabel: 'بيانات مرجعية',
      entityId: id,
      details: `تم استعادة سجل من ${tab}`,
      before,
      after: next,
    });
    return next;
  },

  async bulkImport<K extends ReferenceTab>(
    tab: K,
    rows: ReadonlyArray<Omit<ReferenceRowMap[K], 'id'>>,
  ): Promise<{ imported: number; errors: { row: number; message: string }[] }> {
    await simulateLatency(400, 800);
    const errors: { row: number; message: string }[] = [];
    let imported = 0;
    rows.forEach((row, i) => {
      const r = row as { nameAr?: string };
      if (!r.nameAr || r.nameAr.trim().length === 0) {
        errors.push({ row: i + 1, message: 'اسم عربي مطلوب' });
        return;
      }
      STATE[tab] = [
        { ...(row as ReferenceRowMap[K]), id: newId(tab) } as ReferenceRowMap[K],
        ...(STATE[tab] as ReferenceRowMap[K][]),
      ];
      imported += 1;
    });
    return { imported, errors };
  },
};
