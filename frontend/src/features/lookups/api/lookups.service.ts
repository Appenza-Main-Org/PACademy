/**
 * Lookup Management Module — service layer.
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/lookups/:key
 *   POST   /api/lookups/:key                    body: Omit<LookupRow<K>, 'code'> & { code?: string }
 *   PATCH  /api/lookups/:key/:code              body: Partial<LookupRow<K>>
 *   DELETE /api/lookups/:key/:code              → 200 { deleted: true } or 409 { deleted: false, reason, referenceCount }
 *
 * All mutations enforce:
 *   - code uniqueness within (lookup_key)
 *   - referential integrity (governorate ⇸ police-stations,
 *     specialization/faculty ⇸ specialization-faculty-map,
 *     applicant-category/division ⇸ announcements,
 *     self-referential parentCode chains for relationships and jobs)
 *
 * Audit emissions go through `emitAudit()` keyed `lookups:<key>:<action>`.
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import { ConflictError } from '@/shared/lib/errors';
import {
  LOOKUP_KEYS,
  LOOKUP_META,
  type DeleteResult,
  type LookupKey,
  type LookupRow,
  type LookupRowMap,
} from '../types';

/* ─── In-memory mutable mirror ───────────────────────────────────────── */

type LookupsState = { [K in LookupKey]: LookupRow<K>[] };

const state: LookupsState = LOOKUP_KEYS.reduce((acc, key) => {
  const k = key as LookupKey;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (acc as any)[k] = [...(MOCK.lookups[k] as unknown as LookupRow<typeof k>[])];
  return acc;
}, {} as LookupsState);

/* ─── Helpers ────────────────────────────────────────────────────────── */

function rowsOf<K extends LookupKey>(key: K): LookupRow<K>[] {
  return state[key] as LookupRow<K>[];
}

function setRows<K extends LookupKey>(key: K, rows: LookupRow<K>[]): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (state as any)[key] = rows;
}

function nextCode<K extends LookupKey>(key: K): string {
  const meta = LOOKUP_META[key];
  const rows = rowsOf(key);
  let maxSerial = 0;
  for (const row of rows) {
    const match = row.code.match(/-(\d+)$/);
    if (match) {
      const n = Number.parseInt(match[1] ?? '0', 10);
      if (Number.isFinite(n) && n > maxSerial) maxSerial = n;
    }
  }
  const next = String(maxSerial + 1).padStart(meta.padding, '0');
  return `${meta.codePrefix}-${next}`;
}

function assertCodeUnique<K extends LookupKey>(key: K, code: string, ignoreCode: string | null = null): void {
  const collision = rowsOf(key).find((r) => r.code === code && r.code !== ignoreCode);
  if (collision) {
    throw new ConflictError('DUPLICATE_CODE', { key, code });
  }
}

/* ─── Referential integrity ──────────────────────────────────────────── */

interface ReferenceCheck {
  count: number;
  reason: string;
}

function countReferences<K extends LookupKey>(key: K, code: string): ReferenceCheck {
  let count = 0;
  const reasons: string[] = [];

  /* Self-referential parents: relationships, jobs. */
  if (key === 'relationships') {
    const refs = rowsOf('relationships').filter((r) => r.parentCode === code).length;
    if (refs > 0) {
      count += refs;
      reasons.push(`${refs} صلة قرابة مرتبطة كفرع`);
    }
  }
  if (key === 'jobs') {
    const refs = rowsOf('jobs').filter((r) => r.parentCode === code).length;
    if (refs > 0) {
      count += refs;
      reasons.push(`${refs} وظيفة مرتبطة بهذه الفئة`);
    }
  }

  /* Cross-lookup FKs. */
  if (key === 'governorates') {
    const refs = rowsOf('police-stations').filter((r) => r.governorateCode === code).length;
    if (refs > 0) {
      count += refs;
      reasons.push(`${refs} قسم/مركز شرطة في هذه المحافظة`);
    }
  }
  if (key === 'specializations') {
    const refs = rowsOf('specialization-faculty-map').filter((r) => r.specializationCode === code).length;
    if (refs > 0) {
      count += refs;
      reasons.push(`${refs} ارتباط بكلية`);
    }
  }
  if (key === 'faculties') {
    const refs = rowsOf('specialization-faculty-map').filter((r) => r.facultyCode === code).length;
    if (refs > 0) {
      count += refs;
      reasons.push(`${refs} تخصص مرتبط بهذه الكلية`);
    }
  }
  if (key === 'applicant-categories') {
    const refs = rowsOf('announcements').filter((r) => r.categoryCode === code).length;
    if (refs > 0) {
      count += refs;
      reasons.push(`${refs} تنبيه مرتبط بهذه الفئة`);
    }
  }
  if (key === 'applicant-divisions') {
    const refs = rowsOf('announcements').filter((r) => r.divisionCode === code).length;
    if (refs > 0) {
      count += refs;
      reasons.push(`${refs} تنبيه مرتبط بهذه الشعبة`);
    }
  }

  return {
    count,
    reason: reasons.length > 0
      ? `لا يمكن حذف هذا الكود — مستخدم في ${count} سجل آخر (${reasons.join('، ')}).`
      : '',
  };
}

/* ─── Service ─────────────────────────────────────────────────────────── */

export const lookupsService = {
  async listLookup<K extends LookupKey>(key: K): Promise<LookupRow<K>[]> {
    await simulateLatency(60, 140);
    return [...rowsOf(key)];
  },

  async createLookupRow<K extends LookupKey>(
    key: K,
    input: Omit<LookupRow<K>, 'code'> & { code?: string },
  ): Promise<LookupRow<K>> {
    await simulateLatency();
    const code = input.code && input.code.trim() ? input.code.trim() : nextCode(key);
    assertCodeUnique(key, code);
    const row = {
      ...input,
      code,
      isActive: (input as LookupRow<K>).isActive ?? true,
    } as LookupRow<K>;
    setRows(key, [...rowsOf(key), row]);
    return row;
  },

  async updateLookupRow<K extends LookupKey>(
    key: K,
    code: string,
    patch: Partial<LookupRow<K>>,
  ): Promise<LookupRow<K>> {
    await simulateLatency();
    const current = rowsOf(key).find((r) => r.code === code);
    if (!current) throw new Error(`Row ${code} not found in lookup ${String(key)}`);
    if (patch.code !== undefined && patch.code !== code) {
      assertCodeUnique(key, patch.code, code);
    }
    const next = { ...current, ...patch } as LookupRow<K>;
    setRows(
      key,
      rowsOf(key).map((r) => (r.code === code ? next : r)),
    );
    return next;
  },

  async deleteLookupRow<K extends LookupKey>(key: K, code: string): Promise<DeleteResult> {
    await simulateLatency();
    const check = countReferences(key, code);
    if (check.count > 0) {
      return { deleted: false, reason: check.reason, referenceCount: check.count };
    }
    setRows(key, rowsOf(key).filter((r) => r.code !== code));
    return { deleted: true };
  },

  /** Get a single row by code, typed. Used by FK resolvers. */
  getRow<K extends LookupKey>(key: K, code: string): LookupRow<K> | undefined {
    return rowsOf(key).find((r) => r.code === code);
  },
};

export type LookupsService = typeof lookupsService;

/* ─── Re-export the map type so consumers don't deep-import ──────────── */
export type { LookupRowMap };
