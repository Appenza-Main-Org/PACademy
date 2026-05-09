/**
 * Reference data — real API integration (spec 004 US1).
 *
 * INTEGRATION CONTRACT (backend: AdminReferenceDataController + ReferenceDataController):
 *   GET    /admin/reference-data?category=…             → PagedResult<ReferenceDataListItemDto>
 *   GET    /admin/reference-data/:id                    → ReferenceDataDetailDto
 *   POST   /admin/reference-data                        → ReferenceDataDetailDto (201)
 *   PATCH  /admin/reference-data/:id                    → ReferenceDataDetailDto
 *   POST   /admin/reference-data/:id/archive            → 204
 *   GET    /reference-data?category=…                   → PagedResult<ReferenceDataListItemDto> (active only)
 *
 * The backend stores all 8 lookup categories in a single table with
 * `(category, key, nameAr, nameEn?, metadata, sortOrder, isActive, archived)`.
 * Per-tab extras (region, code, level, isoCode, …) round-trip through the
 * `metadata` JSON column so the typed frontend rows stay intact.
 */

import { apiClient } from '@/shared/api/client';
import type { PagedResult } from '@/shared/types/api';
import type {
  RefCaseType,
  RefCollege,
  RefGovernorate,
  RefNationality,
  RefQualification,
  RefRank,
  RefRelationship,
  RefSpecialization,
  ReferenceRowMap,
  ReferenceTab,
} from '@/shared/types/domain';

// ── Backend DTO shapes ────────────────────────────────────────────────────────

interface ReferenceDataDetailDto {
  id: string;
  category: string;
  key: string;
  nameAr: string;
  nameEn: string | null;
  metadata: string | null;
  sortOrder: number;
  isActive: boolean;
  archived: boolean;
  createdAt: string;
  archivedAt: string | null;
  demoOrigin: boolean;
}

interface ReferenceDataListItemDto {
  id: string;
  category: string;
  key: string;
  nameAr: string;
  nameEn: string | null;
  sortOrder: number;
  isActive: boolean;
  archived: boolean;
}

// ── Tab ↔ category mapping ───────────────────────────────────────────────────

const TAB_TO_CATEGORY: Record<ReferenceTab, string> = {
  governorates: 'governorate',
  specializations: 'specialization',
  ranks: 'rank',
  colleges: 'college',
  qualifications: 'qualification',
  nationalities: 'nationality',
  relationships: 'relationship',
  'case-types': 'case-type',
};

// ── Mapping helpers ───────────────────────────────────────────────────────────

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function backendToRow<K extends ReferenceTab>(
  tab: K,
  dto: ReferenceDataListItemDto | ReferenceDataDetailDto,
): ReferenceRowMap[K] {
  const meta = 'metadata' in dto ? parseMetadata(dto.metadata) : {};

  switch (tab) {
    case 'governorates': {
      const row: RefGovernorate = {
        id: dto.id,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn ?? '',
        region: (meta.region as RefGovernorate['region']) ?? 'cairo',
        active: dto.isActive,
      };
      return row as ReferenceRowMap[K];
    }
    case 'specializations': {
      const row: RefSpecialization = {
        id: dto.id,
        nameAr: dto.nameAr,
        code: (meta.code as string) ?? dto.key,
        facultyType: (meta.facultyType as RefSpecialization['facultyType']) ?? 'civil',
        active: dto.isActive,
      };
      return row as ReferenceRowMap[K];
    }
    case 'ranks': {
      const row: RefRank = {
        id: dto.id,
        nameAr: dto.nameAr,
        level: typeof meta.level === 'number' ? meta.level : Number(meta.level ?? 1),
        applicableTo: (meta.applicableTo as RefRank['applicableTo']) ?? 'officer',
      };
      return row as ReferenceRowMap[K];
    }
    case 'colleges': {
      const row: RefCollege = {
        id: dto.id,
        nameAr: dto.nameAr,
        governorateId: (meta.governorateId as string) ?? '',
        type: (meta.type as RefCollege['type']) ?? 'public',
        active: dto.isActive,
      };
      return row as ReferenceRowMap[K];
    }
    case 'qualifications': {
      const row: RefQualification = {
        id: dto.id,
        nameAr: dto.nameAr,
        level: (meta.level as RefQualification['level']) ?? 'diploma',
        facultyRequired: Boolean(meta.facultyRequired),
      };
      return row as ReferenceRowMap[K];
    }
    case 'nationalities': {
      const row: RefNationality = {
        id: dto.id,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn ?? '',
        isoCode: (meta.isoCode as string) ?? dto.key.toUpperCase(),
      };
      return row as ReferenceRowMap[K];
    }
    case 'relationships': {
      const row: RefRelationship = {
        id: dto.id,
        nameAr: dto.nameAr,
        degree: (Number(meta.degree ?? 1) as RefRelationship['degree']),
        side: (meta.side as RefRelationship['side']) ?? 'paternal',
      };
      return row as ReferenceRowMap[K];
    }
    case 'case-types':
    default: {
      const row: RefCaseType = {
        id: dto.id,
        nameAr: dto.nameAr,
        severity: (meta.severity as RefCaseType['severity']) ?? 'low',
        blocksApplication: Boolean(meta.blocksApplication),
      };
      return row as ReferenceRowMap[K];
    }
  }
}

interface RowExtract {
  nameAr: string;
  nameEn: string | undefined;
  isActive: boolean;
  metadata: Record<string, unknown>;
}

function rowToBackend<K extends ReferenceTab>(
  tab: K,
  row: Record<string, unknown>,
): RowExtract {
  const nameAr = (row.nameAr as string) ?? '';
  const isActive = 'active' in row ? Boolean(row.active) : true;

  switch (tab) {
    case 'governorates': {
      const r = row as Partial<RefGovernorate>;
      return {
        nameAr,
        nameEn: r.nameEn,
        isActive,
        metadata: { region: r.region ?? 'cairo' },
      };
    }
    case 'specializations': {
      const r = row as Partial<RefSpecialization>;
      return {
        nameAr,
        nameEn: undefined,
        isActive,
        metadata: { code: r.code ?? '', facultyType: r.facultyType ?? 'civil' },
      };
    }
    case 'ranks': {
      const r = row as Partial<RefRank>;
      return {
        nameAr,
        nameEn: undefined,
        isActive: true,
        metadata: { level: Number(r.level ?? 1), applicableTo: r.applicableTo ?? 'officer' },
      };
    }
    case 'colleges': {
      const r = row as Partial<RefCollege>;
      return {
        nameAr,
        nameEn: undefined,
        isActive,
        metadata: { governorateId: r.governorateId ?? '', type: r.type ?? 'public' },
      };
    }
    case 'qualifications': {
      const r = row as Partial<RefQualification>;
      return {
        nameAr,
        nameEn: undefined,
        isActive: true,
        metadata: { level: r.level ?? 'diploma', facultyRequired: Boolean(r.facultyRequired) },
      };
    }
    case 'nationalities': {
      const r = row as Partial<RefNationality>;
      return {
        nameAr,
        nameEn: r.nameEn,
        isActive: true,
        metadata: { isoCode: r.isoCode ?? '' },
      };
    }
    case 'relationships': {
      const r = row as Partial<RefRelationship>;
      return {
        nameAr,
        nameEn: undefined,
        isActive: true,
        metadata: { degree: Number(r.degree ?? 1), side: r.side ?? 'paternal' },
      };
    }
    case 'case-types':
    default: {
      const r = row as Partial<RefCaseType>;
      return {
        nameAr,
        nameEn: undefined,
        isActive: true,
        metadata: {
          severity: r.severity ?? 'low',
          blocksApplication: Boolean(r.blocksApplication),
        },
      };
    }
  }
}

/** Stable per-row create key. The backend enforces `[a-z0-9_-]+`; we slug
 *  off the Arabic name and append a short timestamp suffix so duplicate
 *  rows don't collide. */
function generateBackendKey(nameAr: string): string {
  const base = nameAr
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const suffix = Date.now().toString(36).slice(-6);
  return base ? `${base}-${suffix}` : `row-${suffix}`;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const referenceDataService = {
  async list<K extends ReferenceTab>(tab: K): Promise<ReferenceRowMap[K][]> {
    const category = TAB_TO_CATEGORY[tab];
    const { data } = await apiClient.get<PagedResult<ReferenceDataListItemDto>>(
      '/admin/reference-data',
      { params: { category, pageSize: 200, includeArchived: false, sortBy: 'sortOrder' } },
    );
    return data.items.map((item) => backendToRow(tab, item));
  },

  async create<K extends ReferenceTab>(
    tab: K,
    payload: Omit<ReferenceRowMap[K], 'id'>,
  ): Promise<ReferenceRowMap[K]> {
    const extract = rowToBackend(tab, payload as Record<string, unknown>);
    const { data } = await apiClient.post<ReferenceDataDetailDto>('/admin/reference-data', {
      category: TAB_TO_CATEGORY[tab],
      key: generateBackendKey(extract.nameAr),
      nameAr: extract.nameAr,
      nameEn: extract.nameEn ?? null,
      metadata: JSON.stringify(extract.metadata),
      sortOrder: null,
    });
    return backendToRow(tab, data);
  },

  async update<K extends ReferenceTab>(
    tab: K,
    id: string,
    patch: Partial<ReferenceRowMap[K]>,
  ): Promise<ReferenceRowMap[K]> {
    const extract = rowToBackend(tab, patch as Record<string, unknown>);
    const { data } = await apiClient.patch<ReferenceDataDetailDto>(
      `/admin/reference-data/${id}`,
      {
        nameAr: extract.nameAr || null,
        nameEn: extract.nameEn ?? null,
        metadata: JSON.stringify(extract.metadata),
        sortOrder: null,
        isActive: extract.isActive,
      },
    );
    return backendToRow(tab, data);
  },

  async remove<K extends ReferenceTab>(_tab: K, id: string): Promise<{ ok: true }> {
    await apiClient.post(`/admin/reference-data/${id}/archive`);
    return { ok: true };
  },

  async bulkImport<K extends ReferenceTab>(
    tab: K,
    rows: ReadonlyArray<Omit<ReferenceRowMap[K], 'id'>>,
  ): Promise<{ imported: number; errors: { row: number; message: string }[] }> {
    const errors: { row: number; message: string }[] = [];
    let imported = 0;
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i] as { nameAr?: string };
      if (!r.nameAr || r.nameAr.trim().length === 0) {
        errors.push({ row: i + 1, message: 'اسم عربي مطلوب' });
        continue;
      }
      const row = rows[i];
      if (!row) continue;
      try {
        await referenceDataService.create(tab, row);
        imported += 1;
      } catch (err) {
        errors.push({ row: i + 1, message: (err as Error).message ?? 'فشل الإدراج' });
      }
    }
    return { imported, errors };
  },
};
