/**
 * Lookup Management Module — service layer.
 *
 * Wired to the real backend (spec 010 — `/admin/lookups/{typeCode}` unified
 * single-table catalogue). The frontend keeps its 22 kebab-case keys + typed
 * per-row shape; the service translates to/from the backend's UPPER_SNAKE
 * typeCode + `LookupItemDto { extrasJson }` wire shape.
 *
 * Adapters per key handle the field split:
 *   • top-level backend columns: nameAr (→ name), nameEn, code, isActive,
 *     sortOrder, parentId (resolved from parentCode), facultyCode
 *   • everything else → extrasJson (per-type POCO)
 *
 * INTEGRATION CONTRACT:
 *   GET    /admin/lookups/{typeCode}                 ?includeInactive&includeDeleted
 *   GET    /admin/lookups/{typeCode}/{code}
 *   POST   /admin/lookups/{typeCode}                 CreateLookupItemRequest
 *   PATCH  /admin/lookups/{typeCode}/{code}          UpdateLookupItemRequest (+ rowVersion)
 *   DELETE /admin/lookups/{typeCode}/{code}          SoftDeleteLookupItemRequest body (+ rowVersion)
 *
 * Backend conflict codes mapped → ConflictError:
 *   DUPLICATE_CODE · ROW_VERSION_MISMATCH · IN_USE · PARENT_HAS_CHILDREN
 */

import { apiClient, ApiError } from '@/shared/api';
import { ConflictError, type ConflictCode } from '@/shared/lib/errors';
import {
  LOOKUP_KEYS,
  LOOKUP_META,
  type DeleteResult,
  type LookupKey,
  type LookupRow,
  type LookupRowMap,
} from '../types';

/* ─── Key → backend typeCode ─────────────────────────────────────────── */

const TYPE_CODE: Record<LookupKey, string> = {
  'relationships':                'RELATIONSHIPS',
  'relationship-degree-tiers':    'RELATIONSHIP_DEGREE_TIERS',
  'tests':                        'TESTS',
  'test-results':                 'TEST_RESULTS',
  'committees':                   'COMMITTEES',
  'specializations':              'SPECIALIZATIONS',
  'faculties':                    'FACULTIES',
  'submission-types':             'SUBMISSION_TYPES',
  'applicant-categories':         'APPLICANT_CATEGORIES',
  'nationalities-countries':      'NATIONALITIES_COUNTRIES',
  'governorates':                 'GOVERNORATES',
  'police-stations':              'POLICE_STATIONS',
  'jobs':                         'JOBS',
  'qualifications':               'QUALIFICATIONS',
  'announcements':                'ANNOUNCEMENTS',
  'applicant-divisions':          'APPLICANT_DIVISIONS',
  'school-categories':            'SCHOOL_CATEGORIES',
  'nid-missing-reasons':          'NID_MISSING_REASONS',
  'universities':                 'UNIVERSITIES',
  'marital-statuses':             'MARITAL_STATUSES',
  'academic-grades':              'ACADEMIC_GRADES',
  'academic-degrees':             'ACADEMIC_DEGREES',
  'exam-rounds':                  'EXAM_ROUNDS',
  'graduation-years':             'GRADUATION_YEARS',
};

/** Hierarchical keys — `parentCode` ↔ `parentId` resolved via cache. */
const HIERARCHICAL: ReadonlySet<LookupKey> = new Set(['relationships', 'jobs']);

/* ─── Wire shape ─────────────────────────────────────────────────────── */

interface LookupItemDto {
  id: string;
  lookupTypeCode: string;
  code: string;
  nameAr: string;
  nameEn: string | null;
  isActive: boolean;
  sortOrder: number;
  parentId: string | null;
  startDate: string | null;
  endDate: string | null;
  extrasJson: string;
  facultyCode: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  rowVersion: string;
}

interface BackendCreateRequest {
  code: string;
  nameAr: string;
  nameEn?: string | null;
  sortOrder: number;
  parentId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  extrasJson?: string | null;
  facultyCode?: string | null;
}

interface BackendUpdateRequest {
  nameAr?: string | null;
  nameEn?: string | null;
  sortOrder?: number | null;
  parentId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  extrasJson?: string | null;
  facultyCode?: string | null;
  isActive?: boolean | null;
  rowVersion: string;
}

/* ─── Per-(typeCode) cache populated on listLookup ───────────────────── */

interface CacheEntry { id: string; code: string; nameAr: string; rowVersion: string }
const cache: Record<string, CacheEntry[]> = {};

function refreshCache(typeCode: string, rows: LookupItemDto[]): void {
  cache[typeCode] = rows.map((r) => ({
    id: r.id, code: r.code, nameAr: r.nameAr, rowVersion: r.rowVersion,
  }));
}

function refreshCacheOne(typeCode: string, dto: LookupItemDto): void {
  const list = cache[typeCode] ?? [];
  const idx = list.findIndex((r) => r.id === dto.id);
  const entry: CacheEntry = {
    id: dto.id, code: dto.code, nameAr: dto.nameAr, rowVersion: dto.rowVersion,
  };
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  cache[typeCode] = list;
}

/**
 * Resolve a code to its Arabic label using the live backend cache.
 * Returns `null` if the cache hasn't been populated for this typeCode yet
 * (caller should fall back to MOCK or render '—'). Synchronous — safe to
 * call from column render lambdas.
 */
export function lookupLabelByCode(key: LookupKey, code: string | null | undefined): string | null {
  if (!code) return null;
  const typeCode = TYPE_CODE[key];
  return cache[typeCode]?.find((r) => r.code === code)?.nameAr ?? null;
}

function findInCache(typeCode: string, code: string): CacheEntry | undefined {
  return cache[typeCode]?.find((r) => r.code === code);
}

function idFromCode(typeCode: string, code: string | null | undefined): string | null {
  if (!code) return null;
  return cache[typeCode]?.find((r) => r.code === code)?.id ?? null;
}

function codeFromId(typeCode: string, id: string | null | undefined): string | null {
  if (!id) return null;
  return cache[typeCode]?.find((r) => r.id === id)?.code ?? null;
}

async function fetchSingle(typeCode: string, code: string): Promise<CacheEntry> {
  const r = await apiClient.get<LookupItemDto>(`/admin/lookups/${typeCode}/${code}`);
  const entry: CacheEntry = {
    id: r.data.id, code: r.data.code, nameAr: r.data.nameAr, rowVersion: r.data.rowVersion,
  };
  refreshCacheOne(typeCode, r.data);
  return entry;
}

function parseExtras(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/* ─── DTO → typed row (per-key field split) ──────────────────────────── */

/* eslint-disable @typescript-eslint/no-explicit-any */
function fromBackend<K extends LookupKey>(key: K, dto: LookupItemDto): LookupRow<K> {
  const extras = parseExtras(dto.extrasJson);
  const base = {
    code: dto.code,
    name: dto.nameAr,
    isActive: dto.isActive,
    metadata: extras,
  };
  const typeCode = TYPE_CODE[key];

  switch (key) {
    case 'relationships':
      return {
        ...base,
        parentCode: codeFromId(typeCode, dto.parentId),
        branch: String(extras.branch ?? 'none'),
        gender: String(extras.gender ?? 'any'),
        degree: Number(extras.degree ?? 1),
      } as any;
    case 'relationship-degree-tiers':
      return {
        ...base,
        degreeRange: String(extras.degreeRange ?? ''),
        maxDegree: Number(extras.maxDegree ?? 1),
      } as any;
    case 'tests':
      return {
        ...base,
        kind: String(extras.kind ?? 'written'),
        order: Number(extras.order ?? 0),
        required: Boolean(extras.required ?? true),
      } as any;
    case 'test-results':
      return {
        ...base,
        outcome: String(extras.outcome ?? 'pass'),
        tone: String(extras.tone ?? 'neutral'),
      } as any;
    case 'committees':
      /* CommitteeRow shape (types.ts): applicantCategoryId (FK, required) +
       * optional description. Older backend seed rows carry kind/chairTitle
       * in extras instead — for those, applicantCategoryId comes back empty
       * and the grid shows '—' until the row is edited. */
      return {
        ...base,
        applicantCategoryId: String(extras.applicantCategoryId ?? ''),
        description: extras.description ? String(extras.description) : undefined,
      } as any;
    case 'specializations':
      return { ...base, facultyCode: dto.facultyCode ?? '' } as any;
    case 'faculties':
      return base as any;
    case 'submission-types':
      return {
        ...base,
        nameEn: dto.nameEn ?? '',
        sortOrder: dto.sortOrder,
      } as any;
    case 'applicant-categories': {
      /* Backend stores `genderScope` in extrasJson as either a single
       * string ('male' | 'female' | 'any') or an array — normalise to
       * the frontend's ApplicantCategoryGenderScope[] (`['male']`,
       * `['female']`, or `['male','female']` for "any"). */
      const rawScope = extras.genderScope;
      const genderScope: ('male' | 'female')[] = Array.isArray(rawScope)
        ? (rawScope.filter((g): g is 'male' | 'female' => g === 'male' || g === 'female'))
        : rawScope === 'male'
          ? ['male']
          : rawScope === 'female'
            ? ['female']
            : ['male', 'female']; // 'any' / null / undefined → both
      /* facultyCodes + specializationCodes: backend may store as arrays
       * inside extrasJson; default to [] if missing. */
      const facultyCodes = Array.isArray(extras.facultyCodes)
        ? (extras.facultyCodes as string[])
        : [];
      const specializationCodes = Array.isArray(extras.specializationCodes)
        ? (extras.specializationCodes as string[])
        : [];
      return {
        ...base,
        nameEn: dto.nameEn ?? '',
        genderScope,
        facultyCodes,
        specializationCodes,
        applicationMode: String(extras.applicationMode ?? 'general'),
        type: String(extras.type ?? 'university'),
        facultySelectionType: (extras.facultySelectionType ?? null) as any,
        description: String(extras.description ?? ''),
        isOpen: Boolean(extras.isOpen ?? false),
        conditions: (extras.conditions ?? {}) as any,
        expandedConditions: extras.expandedConditions as any,
        requiredTests: (extras.requiredTests ?? []) as any,
        procedures: (extras.procedures ?? []) as any,
      } as any;
    }
    case 'nationalities-countries':
      return {
        ...base,
        iso2: String(extras.iso2 ?? ''),
        isArab: Boolean(extras.isArab ?? false),
      } as any;
    case 'governorates':
      return { ...base, region: String(extras.region ?? 'الوجه البحري') } as any;
    case 'police-stations':
      return {
        ...base,
        governorateCode: String(extras.governorateCode ?? ''),
        kind: String(extras.kind ?? 'قسم'),
      } as any;
    case 'jobs':
      return { ...base, parentCode: codeFromId(typeCode, dto.parentId) } as any;
    case 'qualifications':
      return {
        ...base,
        level: String(extras.level ?? 'بكالوريوس'),
        track: String(extras.track ?? 'عام'),
      } as any;
    case 'announcements':
      return {
        ...base,
        categoryCode: extras.categoryCode != null ? String(extras.categoryCode) : null,
        gender: String(extras.gender ?? 'any'),
        divisionCode: extras.divisionCode != null ? String(extras.divisionCode) : null,
        publishAt: String(extras.publishAt ?? new Date().toISOString()),
        expireAt: extras.expireAt != null ? String(extras.expireAt) : null,
        body: String(extras.body ?? ''),
      } as any;
    case 'applicant-divisions':
    case 'school-categories':
    case 'universities':
    case 'academic-degrees':
      return base as any;
    case 'nid-missing-reasons':
      return { ...base, requiresUpload: Boolean(extras.requiresUpload ?? false) } as any;
    case 'marital-statuses':
    case 'academic-grades':
      return { ...base, nameEn: dto.nameEn ?? '' } as any;
    default:
      return base as any;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ─── Typed row → backend payload (extracts top-level + extras) ──────── */

type TopLevelSplit = {
  parentCode?: string | null;
  facultyCode?: string | null;
  nameEn?: string | null;
  sortOrder?: number;
  extras: Record<string, unknown>;
};

function splitFields<K extends LookupKey>(key: K, row: Partial<LookupRow<K>>): TopLevelSplit {
  const r = row as Record<string, unknown>;
  const extras: Record<string, unknown> = {};
  let parentCode: string | null | undefined;
  let facultyCode: string | null | undefined;
  let nameEn: string | null | undefined;
  let sortOrder: number | undefined;

  switch (key) {
    case 'relationships':
      parentCode = r.parentCode as string | null | undefined;
      if ('branch' in r) extras.branch = r.branch;
      if ('gender' in r) extras.gender = r.gender;
      if ('degree' in r) extras.degree = r.degree;
      break;
    case 'relationship-degree-tiers':
      if ('degreeRange' in r) extras.degreeRange = r.degreeRange;
      if ('maxDegree' in r) extras.maxDegree = r.maxDegree;
      break;
    case 'tests':
      if ('kind' in r) extras.kind = r.kind;
      if ('order' in r) extras.order = r.order;
      if ('required' in r) extras.required = r.required;
      break;
    case 'test-results':
      if ('outcome' in r) extras.outcome = r.outcome;
      if ('tone' in r) extras.tone = r.tone;
      break;
    case 'committees':
      /* Persist the FK + optional description into extras so the row
       * round-trips. Drop description from extras when blank to avoid
       * storing empty strings. */
      if ('applicantCategoryId' in r) extras.applicantCategoryId = r.applicantCategoryId;
      if ('description' in r) {
        const desc = typeof r.description === 'string' ? r.description.trim() : '';
        if (desc) extras.description = desc;
      }
      break;
    case 'specializations':
      facultyCode = (r.facultyCode as string | null | undefined) ?? null;
      break;
    case 'submission-types':
      if ('nameEn' in r) nameEn = r.nameEn as string;
      if ('sortOrder' in r) sortOrder = r.sortOrder as number;
      break;
    case 'applicant-categories':
      if ('nameEn' in r) nameEn = r.nameEn as string;
      if ('genderScope' in r) extras.genderScope = r.genderScope;
      if ('applicationMode' in r) extras.applicationMode = r.applicationMode;
      if ('type' in r) extras.type = r.type;
      if ('facultySelectionType' in r) extras.facultySelectionType = r.facultySelectionType;
      if ('description' in r) extras.description = r.description;
      if ('isOpen' in r) extras.isOpen = r.isOpen;
      if ('conditions' in r) extras.conditions = r.conditions;
      if ('expandedConditions' in r) extras.expandedConditions = r.expandedConditions;
      if ('requiredTests' in r) extras.requiredTests = r.requiredTests;
      if ('procedures' in r) extras.procedures = r.procedures;
      break;
    case 'nationalities-countries':
      if ('iso2' in r) extras.iso2 = r.iso2;
      if ('isArab' in r) extras.isArab = r.isArab;
      break;
    case 'governorates':
      if ('region' in r) extras.region = r.region;
      break;
    case 'police-stations':
      if ('governorateCode' in r) extras.governorateCode = r.governorateCode;
      if ('kind' in r) extras.kind = r.kind;
      break;
    case 'jobs':
      parentCode = r.parentCode as string | null | undefined;
      break;
    case 'qualifications':
      if ('level' in r) extras.level = r.level;
      if ('track' in r) extras.track = r.track;
      break;
    case 'announcements':
      if ('categoryCode' in r) extras.categoryCode = r.categoryCode;
      if ('gender' in r) extras.gender = r.gender;
      if ('divisionCode' in r) extras.divisionCode = r.divisionCode;
      if ('publishAt' in r) extras.publishAt = r.publishAt;
      if ('expireAt' in r) extras.expireAt = r.expireAt;
      if ('body' in r) extras.body = r.body;
      break;
    case 'nid-missing-reasons':
      if ('requiresUpload' in r) extras.requiresUpload = r.requiresUpload;
      break;
    case 'marital-statuses':
    case 'academic-grades':
      if ('nameEn' in r) nameEn = r.nameEn as string;
      break;
    /* faculties, applicant-divisions, school-categories, universities,
     * academic-degrees — no extras / no parent */
    default:
      break;
  }

  return { parentCode, facultyCode, nameEn, sortOrder, extras };
}

/* ─── ApiError → ConflictError translation ───────────────────────────── */

const CONFLICT_CODES = new Set<string>([
  'DUPLICATE_CODE', 'INVALID_DATE_RANGE', 'SELF_PARENT',
  'CIRCULAR_HIERARCHY', 'PARENT_HAS_CHILDREN', 'IN_USE',
  'DUPLICATE_MAPPING',
]);

function rethrowAsConflict(err: unknown, key: LookupKey, code?: string): never {
  if (err instanceof ApiError && CONFLICT_CODES.has(err.code)) {
    throw new ConflictError(err.code as ConflictCode, { key, code });
  }
  throw err;
}

function generateCode(key: LookupKey): string {
  const meta = LOOKUP_META[key];
  const typeCode = TYPE_CODE[key];
  const n = (cache[typeCode]?.length ?? 0) + 1;
  return `${meta.codePrefix}-${String(n).padStart(meta.padding, '0')}`;
}

/* ─── Service ─────────────────────────────────────────────────────────── */

export const lookupsService = {
  async listLookup<K extends LookupKey>(key: K): Promise<LookupRow<K>[]> {
    const typeCode = TYPE_CODE[key];
    const r = await apiClient.get<LookupItemDto[]>(`/admin/lookups/${typeCode}`, {
      params: { includeInactive: true },
    });
    refreshCache(typeCode, r.data);
    return r.data.map((dto) => fromBackend(key, dto));
  },

  async createLookupRow<K extends LookupKey>(
    key: K,
    input: Omit<LookupRow<K>, 'code'> & { code?: string },
  ): Promise<LookupRow<K>> {
    const typeCode = TYPE_CODE[key];
    const split = splitFields(key, input as Partial<LookupRow<K>>);
    const row = input as Record<string, unknown>;
    const code = (typeof row.code === 'string' && row.code.trim()) || generateCode(key);

    const payload: BackendCreateRequest = {
      code,
      nameAr: String(row.name ?? ''),
      nameEn: split.nameEn ?? null,
      sortOrder: split.sortOrder ?? (typeof row.sortOrder === 'number' ? row.sortOrder : 0),
      extrasJson: JSON.stringify(split.extras),
      parentId: HIERARCHICAL.has(key) ? idFromCode(typeCode, split.parentCode ?? null) : null,
      facultyCode: split.facultyCode ?? null,
    };

    try {
      const r = await apiClient.post<LookupItemDto>(`/admin/lookups/${typeCode}`, payload);
      refreshCacheOne(typeCode, r.data);
      return fromBackend(key, r.data);
    } catch (err) {
      rethrowAsConflict(err, key, code);
    }
  },

  async updateLookupRow<K extends LookupKey>(
    key: K,
    code: string,
    patch: Partial<LookupRow<K>>,
  ): Promise<LookupRow<K>> {
    const typeCode = TYPE_CODE[key];
    const cached = findInCache(typeCode, code) ?? await fetchSingle(typeCode, code);
    const split = splitFields(key, patch);
    const p = patch as Record<string, unknown>;

    const payload: BackendUpdateRequest = {
      rowVersion: cached.rowVersion,
      nameAr: typeof p.name === 'string' ? p.name : null,
      nameEn: split.nameEn ?? null,
      sortOrder: split.sortOrder ?? (typeof p.sortOrder === 'number' ? p.sortOrder : null),
      isActive: typeof p.isActive === 'boolean' ? p.isActive : null,
      extrasJson: JSON.stringify(split.extras),
      parentId: HIERARCHICAL.has(key) ? idFromCode(typeCode, split.parentCode ?? null) : null,
      facultyCode: split.facultyCode ?? null,
    };

    try {
      const r = await apiClient.patch<LookupItemDto>(`/admin/lookups/${typeCode}/${code}`, payload);
      refreshCacheOne(typeCode, r.data);
      return fromBackend(key, r.data);
    } catch (err) {
      rethrowAsConflict(err, key, code);
    }
  },

  async deleteLookupRow<K extends LookupKey>(key: K, code: string): Promise<DeleteResult> {
    const typeCode = TYPE_CODE[key];
    const cached = findInCache(typeCode, code) ?? await fetchSingle(typeCode, code);

    try {
      await apiClient.delete(`/admin/lookups/${typeCode}/${code}`, {
        data: { rowVersion: cached.rowVersion, reason: null },
      });
      cache[typeCode] = (cache[typeCode] ?? []).filter((r) => r.code !== code);
      return { deleted: true };
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'IN_USE' || err.code === 'PARENT_HAS_CHILDREN')) {
        return {
          deleted: false,
          reason: err.message || 'لا يمكن حذف السجل — مستخدم في سجلات أخرى',
          referenceCount: 1,
        };
      }
      throw err;
    }
  },

  /** Get a single row by code, typed. Used by FK resolvers. */
  async getRow<K extends LookupKey>(key: K, code: string): Promise<LookupRow<K> | undefined> {
    const typeCode = TYPE_CODE[key];
    try {
      const r = await apiClient.get<LookupItemDto>(`/admin/lookups/${typeCode}/${code}`);
      refreshCacheOne(typeCode, r.data);
      return fromBackend(key, r.data);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NOT_FOUND') return undefined;
      throw err;
    }
  },
};

export type LookupsService = typeof lookupsService;

/* ─── Re-export the map type so consumers don't deep-import ──────────── */
export type { LookupRowMap };

/* Silence unused-import lint — kept exported for parity with prior API. */
void LOOKUP_KEYS;
