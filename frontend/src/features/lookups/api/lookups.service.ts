/**
 * Lookup Management Module — service layer.
 *
 * INTEGRATION CONTRACT (REST endpoints the backend will provide; the
 * mock implementation below reads/writes against an in-memory mirror of
 * MOCK.lookupItems / MOCK.lookupMappings).
 *
 *   GET    /api/lookups/types
 *   GET    /api/lookups/:typeCode/tree
 *   GET    /api/lookups/:typeCode                  ?search&page&pageSize&includeInactive&parentId
 *   POST   /api/lookups                            body: LookupItemInput
 *   PATCH  /api/lookups/:id                        body: Partial<LookupItem>
 *   DELETE /api/lookups/:id                        (soft — sets deleted_at)
 *   POST   /api/lookups/:typeCode/reorder          body: { parentId, orderedIds }
 *
 *   GET    /api/lookup-mappings/:kind
 *   POST   /api/lookup-mappings/:kind              body: LookupMappingPair
 *   DELETE /api/lookup-mappings/:kind              body: LookupMappingPair
 *
 * All mutations enforce the 7 invariants documented in
 * docs/DB_CONSTRAINTS.md §10 and surface failures as
 * ConflictError(<LookupConflictCode>, payload).
 */

import { MOCK } from '@/shared/mock-data';
import { paginate, simulateLatency } from '@/shared/lib/mock-helpers';
import { normalizeArabic } from '@/shared/lib/arabic';
import { ConflictError } from '@/shared/lib/errors';
import type { Pagination } from '@/shared/types/api';
import {
  HIERARCHICAL_TYPES,
  type LookupFilters,
  type LookupItem,
  type LookupMappingKind,
  type LookupMappingPair,
  type LookupMappings,
  type LookupTreeNode,
  type LookupType,
  type LookupTypeCode,
} from '../types';

/* ─── In-memory mirror ───────────────────────────────────────────────── */

let items: LookupItem[] = [...MOCK.lookupItems];
const mappings: LookupMappings = {
  categorySpecializations: [...MOCK.lookupMappings.categorySpecializations],
  categoryCommittees: [...MOCK.lookupMappings.categoryCommittees],
  categoryTests: [...MOCK.lookupMappings.categoryTests],
  periodCategories: [...MOCK.lookupMappings.periodCategories],
};

const ACTOR_ID = 'system';
let nextItemSerial = items.length + 1;

const now = (): string => new Date().toISOString();

const newId = (typeCode: LookupTypeCode): string => {
  nextItemSerial += 1;
  return `LK-${typeCode}-NEW-${String(nextItemSerial).padStart(4, '0')}`;
};

/* ─── Input shape (omit derived fields) ──────────────────────────────── */

export type LookupItemInput = Omit<
  LookupItem,
  'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'deletedAt'
>;

export type LookupItemPatch = Partial<
  Omit<LookupItem, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'deletedAt'>
>;

/* ─── Validation helpers ─────────────────────────────────────────────── */

function assertDateRange(start: string | null, end: string | null): void {
  if (start && end && new Date(start).getTime() > new Date(end).getTime()) {
    throw new ConflictError('INVALID_DATE_RANGE', { start, end });
  }
}

function assertCodeUnique(
  typeCode: LookupTypeCode,
  code: string,
  ignoreId: string | null = null,
): void {
  const collision = items.find(
    (i) =>
      i.lookupTypeCode === typeCode &&
      i.code === code &&
      i.deletedAt === null &&
      i.id !== ignoreId,
  );
  if (collision) {
    throw new ConflictError('DUPLICATE_CODE', { typeCode, code, conflictId: collision.id });
  }
}

/** Walk up the parent chain from `parentId`; if `candidateId` appears,
 *  the assignment would form a cycle. */
function assertNoCycle(candidateId: string, parentId: string | null): void {
  if (parentId === null) return;
  if (parentId === candidateId) {
    throw new ConflictError('SELF_PARENT', { id: candidateId });
  }
  const visited = new Set<string>([candidateId]);
  let cursor: string | null = parentId;
  while (cursor !== null) {
    if (visited.has(cursor)) {
      throw new ConflictError('CIRCULAR_HIERARCHY', { id: candidateId, ancestorId: cursor });
    }
    visited.add(cursor);
    const parent = items.find((i) => i.id === cursor);
    if (!parent) break;
    cursor = parent.parentId;
  }
}

function isReferencedByAnyMapping(itemId: string): LookupMappingKind | null {
  for (const kind of Object.keys(mappings) as LookupMappingKind[]) {
    if (mappings[kind].some((p) => p.categoryId === itemId || p.targetId === itemId)) {
      return kind;
    }
  }
  return null;
}

/* ─── Tree builder ───────────────────────────────────────────────────── */

function buildTree(typeCode: LookupTypeCode): LookupTreeNode[] {
  const pool = items.filter((i) => i.lookupTypeCode === typeCode && i.deletedAt === null);
  const byId = new Map<string, LookupTreeNode>();
  for (const i of pool) {
    byId.set(i.id, { ...i, children: [], level: 0 });
  }
  const roots: LookupTreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const assignLevel = (node: LookupTreeNode, depth: number): void => {
    node.level = depth;
    node.children.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const child of node.children) assignLevel(child, depth + 1);
  };
  roots.sort((a, b) => a.sortOrder - b.sortOrder);
  for (const r of roots) assignLevel(r, 0);
  return roots;
}

/* ─── Service ─────────────────────────────────────────────────────────── */

export const lookupsService = {
  async listTypes(): Promise<LookupType[]> {
    await simulateLatency(60, 140);
    return [...MOCK.lookupTypes];
  },

  async listItems(filters: LookupFilters): Promise<Pagination<LookupItem>> {
    await simulateLatency();
    const q = filters.search ? normalizeArabic(filters.search) : '';
    let rows = items.filter((i) => i.lookupTypeCode === filters.typeCode);
    if (!filters.includeInactive) rows = rows.filter((i) => i.deletedAt === null);
    if (filters.parentId !== undefined) {
      rows = rows.filter((i) => i.parentId === filters.parentId);
    }
    if (q) {
      rows = rows.filter(
        (i) =>
          normalizeArabic(i.nameAr).includes(q) ||
          normalizeArabic(i.code).includes(q) ||
          (i.nameEn && normalizeArabic(i.nameEn).includes(q)),
      );
    }
    rows = rows.slice().sort((a, b) => a.sortOrder - b.sortOrder);
    return paginate(rows, filters.page ?? 1, filters.pageSize ?? 50);
  },

  async getTree(typeCode: LookupTypeCode): Promise<LookupTreeNode[]> {
    await simulateLatency();
    if (!HIERARCHICAL_TYPES.has(typeCode)) {
      throw new Error(`Type ${typeCode} is not hierarchical — call listItems instead.`);
    }
    return buildTree(typeCode);
  },

  async create(input: LookupItemInput): Promise<LookupItem> {
    await simulateLatency();
    assertDateRange(input.startDate, input.endDate);
    assertCodeUnique(input.lookupTypeCode, input.code);
    if (input.parentId === input.code) {
      throw new ConflictError('SELF_PARENT', { code: input.code });
    }
    const row: LookupItem = {
      ...input,
      id: newId(input.lookupTypeCode),
      createdAt: now(),
      createdBy: ACTOR_ID,
      updatedAt: now(),
      updatedBy: ACTOR_ID,
      deletedAt: null,
    };
    if (row.parentId) assertNoCycle(row.id, row.parentId);
    items = [...items, row];
    return row;
  },

  async update(id: string, patch: LookupItemPatch): Promise<LookupItem> {
    await simulateLatency();
    const current = items.find((i) => i.id === id);
    if (!current) throw new Error(`Lookup item ${id} not found`);
    const next: LookupItem = { ...current, ...patch, updatedAt: now(), updatedBy: ACTOR_ID };
    assertDateRange(next.startDate, next.endDate);
    if (patch.code !== undefined && patch.code !== current.code) {
      assertCodeUnique(next.lookupTypeCode, next.code, id);
    }
    if (patch.parentId !== undefined && patch.parentId !== current.parentId) {
      assertNoCycle(id, patch.parentId);
    }
    items = items.map((i) => (i.id === id ? next : i));
    return next;
  },

  async softDelete(id: string): Promise<void> {
    await simulateLatency();
    const current = items.find((i) => i.id === id);
    if (!current) throw new Error(`Lookup item ${id} not found`);
    const hasLiveChild = items.some(
      (i) => i.parentId === id && i.deletedAt === null,
    );
    if (hasLiveChild) {
      throw new ConflictError('PARENT_HAS_CHILDREN', { id });
    }
    const referencingKind = isReferencedByAnyMapping(id);
    if (referencingKind) {
      throw new ConflictError('IN_USE', { id, kind: referencingKind });
    }
    items = items.map((i) =>
      i.id === id
        ? { ...i, deletedAt: now(), isActive: false, updatedAt: now(), updatedBy: ACTOR_ID }
        : i,
    );
  },

  async reorder(
    typeCode: LookupTypeCode,
    parentId: string | null,
    orderedIds: string[],
  ): Promise<void> {
    await simulateLatency();
    const order = new Map(orderedIds.map((id, idx) => [id, (idx + 1) * 10]));
    items = items.map((i) => {
      if (i.lookupTypeCode !== typeCode) return i;
      if (i.parentId !== parentId) return i;
      const next = order.get(i.id);
      if (next === undefined) return i;
      return { ...i, sortOrder: next, updatedAt: now(), updatedBy: ACTOR_ID };
    });
  },

  async listMappings(kind: LookupMappingKind): Promise<LookupMappingPair[]> {
    await simulateLatency(60, 140);
    return [...mappings[kind]];
  },

  async addMapping(kind: LookupMappingKind, pair: LookupMappingPair): Promise<void> {
    await simulateLatency();
    const exists = mappings[kind].some(
      (p) => p.categoryId === pair.categoryId && p.targetId === pair.targetId,
    );
    if (exists) {
      throw new ConflictError('DUPLICATE_MAPPING', { kind, ...pair });
    }
    mappings[kind] = [...mappings[kind], pair];
  },

  async removeMapping(kind: LookupMappingKind, pair: LookupMappingPair): Promise<void> {
    await simulateLatency();
    mappings[kind] = mappings[kind].filter(
      (p) => !(p.categoryId === pair.categoryId && p.targetId === pair.targetId),
    );
  },
};
