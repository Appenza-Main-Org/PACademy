/**
 * Reference data API — wired to the 8 dedicated backend endpoints
 * (spec post-split). Each Sprint-1 typed lookup has its own table and
 * REST resource:
 *
 *   /admin/governorates       /admin/specializations  /admin/ranks
 *   /admin/colleges           /admin/qualifications   /admin/nationalities
 *   /admin/relationships      /admin/case-types
 *
 * The old single-namespace `/admin/reference-data` endpoint and JSON
 * metadata blob are gone. Each endpoint returns a typed shape directly.
 *
 * The exported `referenceDataService` interface is unchanged so the
 * queries layer and ReferenceDataPage don't need updates.
 */

import { apiClient } from '@/shared/api';
import { emitAudit } from '@/shared/lib/audit';
import { type DependencyResult } from '@/shared/lib/soft-delete';
import type { ReferenceRowMap, ReferenceTab, SoftDeleteFields } from '@/shared/types/domain';

interface ApiPaged<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/* ── Backend resource path per tab ──────────────────────────────────────── */

const TAB_TO_PATH: Record<ReferenceTab, string> = {
  governorates: '/admin/governorates',
  specializations: '/admin/specializations',
  ranks: '/admin/ranks',
  colleges: '/admin/colleges',
  qualifications: '/admin/qualifications',
  nationalities: '/admin/nationalities',
  relationships: '/admin/relationships',
  'case-types': '/admin/case-types',
};

/* ── Per-tab unpackers (backend typed row → frontend Ref* shape) ─────── */

interface CommonApiFields {
  id: string;
  archived: boolean;
  archivedAt: string | null;
}

function withSoftDelete<T extends Record<string, unknown>>(
  api: CommonApiFields, base: T,
): T & SoftDeleteFields {
  return {
    ...base,
    id: api.id,
    deletedAt: api.archived ? api.archivedAt ?? new Date().toISOString() : undefined,
  } as T & SoftDeleteFields;
}

function unpackRow<K extends ReferenceTab>(tab: K, api: Record<string, unknown>): ReferenceRowMap[K] {
  const c = api as unknown as CommonApiFields;
  switch (tab) {
    case 'governorates':
      return withSoftDelete(c, {
        nameAr: api.nameAr as string,
        nameEn: (api.nameEn as string) ?? '',
        region: ((api.region as string) ?? 'Cairo').toLowerCase(),
        active: api.isActive as boolean,
      }) as unknown as ReferenceRowMap[K];
    case 'specializations':
      return withSoftDelete(c, {
        nameAr: api.nameAr as string,
        code: api.code as string,
        facultyType: ((api.facultyType as string) ?? 'Civil').toLowerCase(),
        active: api.isActive as boolean,
      }) as unknown as ReferenceRowMap[K];
    case 'ranks':
      return withSoftDelete(c, {
        nameAr: api.nameAr as string,
        level: api.level as number,
        applicableTo: ((api.applicableTo as string) ?? 'Officer').toLowerCase(),
      }) as unknown as ReferenceRowMap[K];
    case 'colleges':
      return withSoftDelete(c, {
        nameAr: api.nameAr as string,
        governorateId: api.governorateId as string,
        type: ((api.type as string) ?? 'Public').toLowerCase(),
        active: api.isActive as boolean,
      }) as unknown as ReferenceRowMap[K];
    case 'qualifications':
      return withSoftDelete(c, {
        nameAr: api.nameAr as string,
        level: ((api.level as string) ?? 'Bachelor').toLowerCase(),
        facultyRequired: api.facultyRequired as boolean,
      }) as unknown as ReferenceRowMap[K];
    case 'nationalities':
      return withSoftDelete(c, {
        nameAr: api.nameAr as string,
        nameEn: (api.nameEn as string) ?? '',
        isoCode: api.isoCode as string,
      }) as unknown as ReferenceRowMap[K];
    case 'relationships':
      return withSoftDelete(c, {
        nameAr: api.nameAr as string,
        degree: api.degree as number,
        side: ((api.side as string) ?? 'Paternal').toLowerCase(),
      }) as unknown as ReferenceRowMap[K];
    case 'case-types':
      return withSoftDelete(c, {
        nameAr: api.nameAr as string,
        severity: ((api.severity as string) ?? 'Low').toLowerCase(),
        blocksApplication: api.blocksApplication as boolean,
      }) as unknown as ReferenceRowMap[K];
  }
  return c as unknown as ReferenceRowMap[K];
}

/* ── Per-tab packers (frontend row → backend typed body) ──────────────── */

function capitalize(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

function packRow<K extends ReferenceTab>(tab: K, row: Partial<ReferenceRowMap[K]>): Record<string, unknown> {
  const r = row as Record<string, unknown>;
  switch (tab) {
    case 'governorates':
      return {
        nameAr: r.nameAr, nameEn: r.nameEn,
        region: r.region ? capitalize(r.region as string) : undefined,
        isActive: r.active,
      };
    case 'specializations':
      return {
        nameAr: r.nameAr, code: r.code,
        facultyType: r.facultyType ? capitalize(r.facultyType as string) : undefined,
        isActive: r.active,
      };
    case 'ranks':
      return {
        nameAr: r.nameAr, level: r.level,
        applicableTo: r.applicableTo ? capitalize(r.applicableTo as string) : undefined,
      };
    case 'colleges':
      return {
        nameAr: r.nameAr, governorateId: r.governorateId,
        type: r.type ? capitalize(r.type as string) : undefined,
        isActive: r.active,
      };
    case 'qualifications':
      return {
        nameAr: r.nameAr,
        level: r.level ? capitalize(r.level as string) : undefined,
        facultyRequired: r.facultyRequired,
      };
    case 'nationalities':
      return { nameAr: r.nameAr, nameEn: r.nameEn, isoCode: r.isoCode };
    case 'relationships':
      return {
        nameAr: r.nameAr, degree: r.degree,
        side: r.side ? capitalize(r.side as string) : undefined,
      };
    case 'case-types':
      return {
        nameAr: r.nameAr,
        severity: r.severity ? capitalize(r.severity as string) : undefined,
        blocksApplication: r.blocksApplication,
      };
  }
  return r;
}

function autoKey(seed: string): string {
  const slug = seed.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '').slice(0, 24);
  const stamp = Date.now().toString(36);
  return slug ? `auto-${slug}-${stamp}` : `auto-${stamp}`;
}

/* ── Service ────────────────────────────────────────────────────────────── */

export const referenceDataService = {
  async list<K extends ReferenceTab>(
    tab: K,
    opts: { includeDeleted?: boolean } = {},
  ): Promise<ReferenceRowMap[K][]> {
    const { data } = await apiClient.get<ApiPaged<Record<string, unknown>>>(TAB_TO_PATH[tab], {
      params: { includeArchived: opts.includeDeleted ?? false, pageSize: 200 },
    });
    return data.items.map((r) => unpackRow(tab, r));
  },

  async create<K extends ReferenceTab>(
    tab: K,
    payload: Omit<ReferenceRowMap[K], 'id'>,
  ): Promise<ReferenceRowMap[K]> {
    const r = payload as Record<string, unknown>;
    const seed = (r.nameEn as string) || (r.nameAr as string) || tab;
    const body = {
      key: autoKey(seed),
      ...packRow(tab, payload as Partial<ReferenceRowMap[K]>),
    };
    const { data } = await apiClient.post<Record<string, unknown>>(TAB_TO_PATH[tab], body);
    return unpackRow(tab, data);
  },

  async update<K extends ReferenceTab>(
    tab: K,
    id: string,
    patch: Partial<ReferenceRowMap[K]>,
  ): Promise<ReferenceRowMap[K]> {
    const { data } = await apiClient.patch<Record<string, unknown>>(
      `${TAB_TO_PATH[tab]}/${id}`,
      packRow(tab, patch),
    );
    return unpackRow(tab, data);
  },

  async remove<K extends ReferenceTab>(tab: K, id: string): Promise<{ ok: true }> {
    // No hard-delete on backend; archive is the path.
    await apiClient.post(`${TAB_TO_PATH[tab]}/${id}/archive`);
    return { ok: true };
  },

  getDependencies(): Promise<DependencyResult> {
    // Backend ArchiveCollege/Specialization/etc. enforces FK guards inline
    // (REFERENCE_IN_USE error code). Frontend pre-check is best-effort.
    return Promise.resolve({ counts: {}, blocking: false });
  },

  async softDelete<K extends ReferenceTab>(
    tab: K,
    id: string,
    reason: string,
  ): Promise<ReferenceRowMap[K]> {
    await apiClient.post(`${TAB_TO_PATH[tab]}/${id}/archive`);
    const { data } = await apiClient.get<Record<string, unknown>>(`${TAB_TO_PATH[tab]}/${id}`);
    const after = unpackRow(tab, data);
    emitAudit({
      action: 'soft_delete', module: 'lookups', entityType: tab,
      entityLabel: 'بيانات مرجعية', entityId: id,
      details: `تم حذف سجل من ${tab} — السبب: ${reason}`,
      after,
    });
    return after;
  },

  async restore<K extends ReferenceTab>(tab: K, id: string): Promise<ReferenceRowMap[K]> {
    await apiClient.post(`${TAB_TO_PATH[tab]}/${id}/restore`);
    const { data } = await apiClient.get<Record<string, unknown>>(`${TAB_TO_PATH[tab]}/${id}`);
    const after = unpackRow(tab, data);
    emitAudit({
      action: 'restore', module: 'lookups', entityType: tab,
      entityLabel: 'بيانات مرجعية', entityId: id,
      details: `تم استعادة سجل من ${tab}`,
      after,
    });
    return after;
  },

  async bulkImport<K extends ReferenceTab>(
    tab: K,
    rows: ReadonlyArray<Omit<ReferenceRowMap[K], 'id'>>,
  ): Promise<{ imported: number; errors: { row: number; message: string }[] }> {
    const errors: { row: number; message: string }[] = [];
    let imported = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] as Record<string, unknown>;
      if (!r.nameAr || String(r.nameAr).trim().length === 0) {
        errors.push({ row: i + 1, message: 'اسم عربي مطلوب' });
        continue;
      }
      try {
        await this.create(tab, rows[i]);
        imported += 1;
      } catch (err) {
        errors.push({ row: i + 1, message: err instanceof Error ? err.message : 'فشل الاستيراد' });
      }
    }
    return { imported, errors };
  },
};
