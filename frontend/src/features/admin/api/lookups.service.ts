/**
 * Lookups API Contract — Gap I (admin-gaps).
 *
 * Generic CRUD over the platform-wide lookup catalogue (educationTypes,
 * universities, jobs, …). Distinct from `referenceData` which keeps
 * Sprint-1's typed Ref* shapes — Gap I lookups all share the unified
 * `LookupRow` shape so a single <LookupTab> renders any of them.
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/lookups/:key                            → LookupRow[]
 *   POST   /api/lookups/:key                            → LookupRow
 *   PATCH  /api/lookups/:key/:id                        → LookupRow
 *   POST   /api/lookups/:key/:id/activate               → LookupRow
 *   POST   /api/lookups/:key/:id/deactivate             → LookupRow
 *   POST   /api/lookups/:key/:id/soft-delete            → LookupRow
 *   POST   /api/lookups/:key/:id/restore                → LookupRow
 *   POST   /api/lookups/:key/reorder                    → LookupRow[]
 *   GET    /api/lookups/:key/:id/dependencies           → DependencyResult
 *   DELETE /api/lookups/:key/:id                        → { ok }   (only when no deps)
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import { emitAudit } from '@/shared/lib/audit';
import {
  applyRestore,
  applySoftDelete,
  DependencyBlockedError,
  filterDeleted,
  type DependencyResult,
} from '@/shared/lib/soft-delete';
import type { LookupKey, LookupRow } from '@/shared/types/domain';

/* In-memory snapshots so demo flows can mutate without persisting beyond
 * the page session (matches the reference-data pattern). */
const STATE: Record<LookupKey, LookupRow[]> = {
  educationTypes: [...MOCK.lookups.educationTypes],
  maritalStatuses: [...MOCK.lookups.maritalStatuses],
  universities: [...MOCK.lookups.universities],
  faculties: [...MOCK.lookups.faculties],
  specialties: [...MOCK.lookups.specialties],
  specialtyTypes: [...MOCK.lookups.specialtyTypes],
  degreeTypes: [...MOCK.lookups.degreeTypes],
  jobs: [...MOCK.lookups.jobs],
  examTypes: [...MOCK.lookups.examTypes],
  examGroups: [...MOCK.lookups.examGroups],
  committeeTypes: [...MOCK.lookups.committeeTypes],
  rejectionReasons: [...MOCK.lookups.rejectionReasons],
  notificationDepartments: [...MOCK.lookups.notificationDepartments],
  applicantSections: [...MOCK.lookups.applicantSections],
  nationalIdMissingReasons: [...MOCK.lookups.nationalIdMissingReasons],
};

let nextId = 1;
const newId = (key: LookupKey): string => `LK-${key.slice(0, 4).toUpperCase()}-NEW-${String(nextId++).padStart(3, '0')}`;

const LOOKUP_DEP_LABELS: Record<string, string> = {
  applicants: 'متقدم',
  categories: 'فئة',
  cycles: 'دورة',
  faculties: 'كلية',
  specialties: 'تخصص',
};

export interface LookupListOpts {
  includeDeleted?: boolean;
  /** Optional gender filter (for specialties). */
  gender?: 'male' | 'female' | 'all';
  /** Optional parent filter (for faculties under a university). */
  parentId?: string | 'all';
}

export const lookupsService = {
  async list(key: LookupKey, opts: LookupListOpts = {}): Promise<LookupRow[]> {
    await simulateLatency(80, 200);
    let rows = filterDeleted(STATE[key], opts.includeDeleted);
    if (opts.gender && opts.gender !== 'all') {
      rows = rows.filter((r) => !r.gender || r.gender === opts.gender);
    }
    if (opts.parentId && opts.parentId !== 'all') {
      rows = rows.filter((r) => r.parentId === opts.parentId);
    }
    return [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async create(key: LookupKey, payload: Omit<LookupRow, 'id' | 'isSystem'>): Promise<LookupRow> {
    await simulateLatency();
    const row: LookupRow = {
      ...payload,
      id: newId(key),
      isSystem: false,
    };
    STATE[key] = [row, ...STATE[key]];
    emitAudit({
      action: 'create',
      module: 'lookups',
      entityType: key,
      entityLabel: 'بيانات مرجعية',
      entityId: row.id,
      details: `تم إنشاء "${row.labelAr}" في ${key}`,
      after: row,
    });
    return row;
  },

  async update(
    key: LookupKey,
    id: string,
    patch: Partial<Omit<LookupRow, 'id' | 'isSystem'>>,
  ): Promise<LookupRow> {
    await simulateLatency();
    const idx = STATE[key].findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('السجل غير موجود');
    const before = { ...STATE[key][idx]! };
    /* System rows can be deactivated and reordered, but key/labels stay
     * editable to allow translation tweaks. */
    const next: LookupRow = { ...before, ...patch, id: before.id, isSystem: before.isSystem };
    STATE[key][idx] = next;
    emitAudit({
      action: 'update',
      module: 'lookups',
      entityType: key,
      entityLabel: 'بيانات مرجعية',
      entityId: id,
      details: `تم تعديل "${next.labelAr}" في ${key}`,
      before,
      after: next,
    });
    return next;
  },

  async setActive(key: LookupKey, id: string, isActive: boolean): Promise<LookupRow> {
    return lookupsService.update(key, id, { isActive });
  },

  /**
   * Reorder by passing an ordered list of ids. Rows not in the list keep
   * their existing sortOrder. Audit emits a single `update` with before/after
   * id-order arrays for the affected slice.
   */
  async reorder(key: LookupKey, orderedIds: string[]): Promise<LookupRow[]> {
    await simulateLatency();
    const beforeOrder = STATE[key].map((r) => r.id);
    let nextOrder = 10;
    const idToOrder = new Map<string, number>();
    for (const id of orderedIds) {
      idToOrder.set(id, nextOrder);
      nextOrder += 10;
    }
    STATE[key] = STATE[key].map((r) =>
      idToOrder.has(r.id) ? { ...r, sortOrder: idToOrder.get(r.id)! } : r,
    );
    emitAudit({
      action: 'update',
      module: 'lookups',
      entityType: key,
      entityLabel: 'بيانات مرجعية',
      entityId: key,
      details: `إعادة ترتيب ${key}`,
      before: { order: beforeOrder },
      after: { order: STATE[key].map((r) => r.id) },
    });
    return [...STATE[key]];
  },

  /**
   * Lookup dependency check — counts child rows that point at this id via
   * the typed parent map. Tightens over time as more entities reference
   * lookups (categories' education-type list, applicants' specialty, etc.).
   */
  async getDependencies(key: LookupKey, id: string): Promise<DependencyResult> {
    await simulateLatency(60, 120);
    const counts: Record<string, number> = {};
    /* Universities → faculties */
    if (key === 'universities') {
      counts.faculties = STATE.faculties.filter((r) => r.parentId === id && !r.deletedAt).length;
    }
    /* Specialty types → specialties */
    if (key === 'specialtyTypes') {
      counts.specialties = STATE.specialties.filter((r) => r.parentId === id && !r.deletedAt).length;
    }
    const blocking = Object.values(counts).some((n) => n > 0);
    return { counts, blocking };
  },

  async softDelete(key: LookupKey, id: string, reason: string): Promise<LookupRow> {
    await simulateLatency();
    const idx = STATE[key].findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('السجل غير موجود');
    const target = STATE[key][idx]!;
    if (target.isSystem) throw new Error('لا يمكن حذف سجل نظام (يمكن تعطيله بدلاً من ذلك)');
    const dep = await lookupsService.getDependencies(key, id);
    if (dep.blocking) throw new DependencyBlockedError(dep, 'هذا السجل', LOOKUP_DEP_LABELS);
    const before = { ...target };
    const next = applySoftDelete(target, { reason });
    STATE[key][idx] = next;
    emitAudit({
      action: 'soft_delete',
      module: 'lookups',
      entityType: key,
      entityLabel: 'بيانات مرجعية',
      entityId: id,
      details: `حذف "${target.labelAr}" — السبب: ${reason}`,
      before,
      after: next,
    });
    return next;
  },

  /**
   * INTEGRATION CONTRACT
   * Real endpoint: POST /api/lookups/:key/bulk-import
   * Body: BulkImportLookupRow[] — backend re-validates each `key` (snake/
   * kebab ASCII), and rejects duplicates within the lookup. Per-row outcome
   * is returned so partial commits are observable.
   * Audit: one `create` per imported row, identical to manual creation,
   * keeps the audit chain unbroken.
   */
  async bulkImport(
    lookupKey: LookupKey,
    rows: ReadonlyArray<Omit<LookupRow, 'id' | 'isSystem'>>,
  ): Promise<{
    attemptedCount: number;
    successCount: number;
    failedRows: ReadonlyArray<{ rowIndex: number; errors: ReadonlyArray<string> }>;
  }> {
    await simulateLatency(400, 800);
    let successCount = 0;
    const failedRows: { rowIndex: number; errors: string[] }[] = [];
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]!;
      try {
        if (STATE[lookupKey].some((r) => r.key === row.key && !r.deletedAt)) {
          failedRows.push({ rowIndex: i, errors: [`المفتاح "${row.key}" مستخدم بالفعل`] });
          continue;
        }
        await lookupsService.create(lookupKey, row);
        successCount += 1;
      } catch (err) {
        failedRows.push({
          rowIndex: i,
          errors: [err instanceof Error ? err.message : 'تعذّر إنشاء السجل'],
        });
      }
    }
    return { attemptedCount: rows.length, successCount, failedRows };
  },

  async restore(key: LookupKey, id: string): Promise<LookupRow> {
    await simulateLatency();
    const idx = STATE[key].findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('السجل غير موجود');
    const before = { ...STATE[key][idx]! };
    const next = applyRestore(STATE[key][idx]!);
    STATE[key][idx] = next;
    emitAudit({
      action: 'restore',
      module: 'lookups',
      entityType: key,
      entityLabel: 'بيانات مرجعية',
      entityId: id,
      details: `استعادة "${next.labelAr}"`,
      before,
      after: next,
    });
    return next;
  },
};
