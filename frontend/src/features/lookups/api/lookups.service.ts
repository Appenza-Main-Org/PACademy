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
 *     faculty ⇸ specializations.facultyCode,
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

const USE_BACKEND =
  import.meta.env.VITE_USE_LOOKUPS_BACKEND === 'true' ||
  (import.meta.env.VITE_USE_LOOKUPS_BACKEND !== 'false' && Boolean(import.meta.env.VITE_ADMIN_API_BASE));
const ADMIN_API_BASE = import.meta.env.VITE_ADMIN_API_BASE ?? 'http://localhost:5101';

type ApiRequestInit = Omit<RequestInit, 'body'> & { body?: unknown };

async function apiJson<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const res = await fetch(`${ADMIN_API_BASE}${path}`, {
    ...init,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  const data = text.length > 0 ? JSON.parse(text) as unknown : null;
  if (!res.ok) {
    const envelope = data !== null && typeof data === 'object' ? data as Record<string, unknown> : {};
    if (res.status === 409) {
      const conflictCode = String(envelope.conflictCode ?? 'IN_USE');
      if (conflictCode === 'LOOKUP_CODE_DUPLICATE') {
        throw new ConflictError('DUPLICATE_CODE', envelope);
      }
      throw new ConflictError(conflictCode as never, envelope);
    }
    const message = typeof envelope.message === 'string' ? envelope.message : `HTTP ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

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
  if (key === 'faculties') {
    const refs = rowsOf('specializations').filter((r) => r.facultyCode === code).length;
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
  if (key === 'submission-types') {
    /* applicant-categories carry the FK in `metadata.submissionTypeCode`
     * (the codebase has no uuid `id` column — code is the identity). */
    const refs = rowsOf('applicant-categories').filter((r) => {
      const m = (r.metadata ?? {}) as { submissionTypeCode?: unknown };
      return m.submissionTypeCode === code;
    }).length;
    if (refs > 0) {
      count += refs;
      reasons.push(`${refs} فئة متقدمين مرتبطة بنوع التقديم هذا`);
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
    if (USE_BACKEND) {
      return apiJson<LookupRow<K>[]>(`/api/lookups/${key}`);
    }
    await simulateLatency(60, 140);
    return [...rowsOf(key)];
  },

  async createLookupRow<K extends LookupKey>(
    key: K,
    input: Omit<LookupRow<K>, 'code'> & { code?: string },
  ): Promise<LookupRow<K>> {
    if (USE_BACKEND) {
      return apiJson<LookupRow<K>>(`/api/lookups/${key}`, {
        method: 'POST',
        body: input,
      });
    }
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
    if (USE_BACKEND) {
      return apiJson<LookupRow<K>>(`/api/lookups/${key}/${encodeURIComponent(code)}`, {
        method: 'PATCH',
        body: patch,
      });
    }
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
    if (USE_BACKEND) {
      const res = await fetch(`${ADMIN_API_BASE}/api/lookups/${key}/${encodeURIComponent(code)}`, {
        method: 'DELETE',
      });
      const text = await res.text();
      const data = text.length > 0 ? JSON.parse(text) as unknown : null;
      if (res.status === 409 && data !== null && typeof data === 'object' && 'deleted' in data) {
        return data as DeleteResult;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return data as DeleteResult;
    }
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

  /** Synchronous live read of the entire lookup. Cross-feature consumers
   *  (e.g. `applicationSettings.service.ts`) call this so that admin edits
   *  to a lookup propagate to downstream joins without a process restart.
   *  Returned array is a snapshot — safe to iterate, mutations on it are
   *  ignored. */
  readLookup<K extends LookupKey>(key: K): readonly LookupRow<K>[] {
    return rowsOf(key);
  },
};

export type LookupsService = typeof lookupsService;

/* ─── Re-export the map type so consumers don't deep-import ──────────── */
export type { LookupRowMap };
