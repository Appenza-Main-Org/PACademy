/**
 * Lookups API — wired to the 13 dedicated backend endpoints
 * (spec post-split). Each Gap-I lookup has its own table and route:
 *
 *   /admin/education-types        /admin/marital-statuses
 *   /admin/universities           /admin/faculties
 *   /admin/specialty-types        /admin/specialties
 *   /admin/degree-types           /admin/jobs
 *   /admin/exam-types             /admin/exam-groups
 *   /admin/committee-types        /admin/rejection-reasons
 *   /admin/notification-departments
 *
 * The exported `lookupsService` interface is unchanged; pages and
 * <LookupTab> don't need updates.
 */

import { apiClient } from '@/shared/api';
import { emitAudit } from '@/shared/lib/audit';
import {
  DependencyBlockedError,
  type DependencyResult,
} from '@/shared/lib/soft-delete';
import type { LookupKey, LookupRow } from '@/shared/types/domain';

interface ApiRow {
  id: string;
  key: string;
  labelAr: string;
  labelEn: string | null;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
  archived: boolean;
  archivedAt: string | null;
  // Optional hierarchy/gender fields (only present on Faculty / Specialty)
  universityId?: string;
  specialtyTypeId?: string;
  gender?: string | null;
}

interface ApiPaged<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

const KEY_TO_PATH: Record<LookupKey, string> = {
  educationTypes: '/admin/education-types',
  maritalStatuses: '/admin/marital-statuses',
  universities: '/admin/universities',
  faculties: '/admin/faculties',
  specialties: '/admin/specialties',
  specialtyTypes: '/admin/specialty-types',
  degreeTypes: '/admin/degree-types',
  jobs: '/admin/jobs',
  examTypes: '/admin/exam-types',
  examGroups: '/admin/exam-groups',
  committeeTypes: '/admin/committee-types',
  rejectionReasons: '/admin/rejection-reasons',
  notificationDepartments: '/admin/notification-departments',
};

const LOOKUP_DEP_LABELS: Record<string, string> = {
  applicants: 'متقدم', categories: 'فئة', cycles: 'دورة',
  faculties: 'كلية', specialties: 'تخصص',
};

function unpack(api: ApiRow): LookupRow {
  const result: LookupRow = {
    id: api.id, key: api.key, labelAr: api.labelAr,
    sortOrder: api.sortOrder, isActive: api.isActive, isSystem: api.isSystem,
  };
  if (api.labelEn) result.labelEn = api.labelEn;
  // Hierarchical: faculties carry universityId, specialties carry specialtyTypeId
  if (api.universityId) result.parentId = api.universityId;
  if (api.specialtyTypeId) result.parentId = api.specialtyTypeId;
  if (api.gender === 'Male') result.gender = 'male';
  if (api.gender === 'Female') result.gender = 'female';
  if (api.archived) result.deletedAt = api.archivedAt ?? new Date().toISOString();
  return result;
}

function packCreate(key: LookupKey, payload: Partial<LookupRow>): Record<string, unknown> {
  const body: Record<string, unknown> = {
    key: payload.key,
    labelAr: payload.labelAr,
    labelEn: payload.labelEn ?? null,
    sortOrder: payload.sortOrder,
  };
  if (key === 'faculties') body.universityId = payload.parentId;
  if (key === 'specialties') {
    body.specialtyTypeId = payload.parentId;
    body.gender = payload.gender ? payload.gender.charAt(0).toUpperCase() + payload.gender.slice(1) : null;
  }
  return body;
}

function packUpdate(key: LookupKey, patch: Partial<LookupRow>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (patch.labelAr !== undefined) body.labelAr = patch.labelAr;
  if (patch.labelEn !== undefined) body.labelEn = patch.labelEn;
  if (patch.sortOrder !== undefined) body.sortOrder = patch.sortOrder;
  if (patch.isActive !== undefined) body.isActive = patch.isActive;
  if (key === 'faculties' && patch.parentId !== undefined) body.universityId = patch.parentId;
  if (key === 'specialties') {
    if (patch.parentId !== undefined) body.specialtyTypeId = patch.parentId;
    if (patch.gender !== undefined) {
      body.gender = patch.gender ? patch.gender.charAt(0).toUpperCase() + patch.gender.slice(1) : null;
      body.clearGender = patch.gender === undefined || patch.gender === null;
    }
  }
  return body;
}

export interface LookupListOpts {
  includeDeleted?: boolean;
  gender?: 'male' | 'female' | 'all';
  parentId?: string;
}

export const lookupsService = {
  async list(key: LookupKey, opts: LookupListOpts = {}): Promise<LookupRow[]> {
    const params: Record<string, unknown> = {
      includeArchived: opts.includeDeleted ?? false,
      pageSize: 500,
    };
    // Server-side filtering for hierarchical/gender — saves client-side filtering.
    if (key === 'faculties' && opts.parentId && opts.parentId !== 'all') {
      params.universityId = opts.parentId;
    }
    if (key === 'specialties') {
      if (opts.parentId && opts.parentId !== 'all') params.specialtyTypeId = opts.parentId;
      if (opts.gender && opts.gender !== 'all') {
        params.gender = opts.gender.charAt(0).toUpperCase() + opts.gender.slice(1);
      }
    }
    const { data } = await apiClient.get<ApiPaged<ApiRow>>(KEY_TO_PATH[key], { params });
    return data.items.map(unpack).sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async create(key: LookupKey, payload: Omit<LookupRow, 'id' | 'isSystem'>): Promise<LookupRow> {
    const { data } = await apiClient.post<ApiRow>(KEY_TO_PATH[key], packCreate(key, payload));
    if (!payload.isActive) {
      const { data: patched } = await apiClient.patch<ApiRow>(
        `${KEY_TO_PATH[key]}/${data.id}`, { isActive: false },
      );
      const row = unpack(patched);
      emitAuditCreate(key, row);
      return row;
    }
    const row = unpack(data);
    emitAuditCreate(key, row);
    return row;
  },

  async update(
    key: LookupKey,
    id: string,
    patch: Partial<Omit<LookupRow, 'id' | 'isSystem'>>,
  ): Promise<LookupRow> {
    const { data: current } = await apiClient.get<ApiRow>(`${KEY_TO_PATH[key]}/${id}`);
    const before = unpack(current);
    const { data } = await apiClient.patch<ApiRow>(`${KEY_TO_PATH[key]}/${id}`, packUpdate(key, patch));
    const after = unpack(data);
    emitAudit({
      action: 'update', module: 'lookups', entityType: key,
      entityLabel: 'بيانات مرجعية', entityId: id,
      details: `تم تعديل "${after.labelAr}" في ${key}`,
      before, after,
    });
    return after;
  },

  async setActive(key: LookupKey, id: string, isActive: boolean): Promise<LookupRow> {
    return lookupsService.update(key, id, { isActive });
  },

  async reorder(key: LookupKey, orderedIds: string[]): Promise<LookupRow[]> {
    let nextOrder = 10;
    const results: LookupRow[] = [];
    for (const id of orderedIds) {
      const { data } = await apiClient.patch<ApiRow>(`${KEY_TO_PATH[key]}/${id}`, { sortOrder: nextOrder });
      results.push(unpack(data));
      nextOrder += 10;
    }
    emitAudit({
      action: 'update', module: 'lookups', entityType: key,
      entityLabel: 'بيانات مرجعية', entityId: key,
      details: `إعادة ترتيب ${key}`,
      after: { order: orderedIds },
    });
    return results;
  },

  async getDependencies(key: LookupKey, id: string): Promise<DependencyResult> {
    const counts: Record<string, number> = {};
    if (key === 'universities') {
      const facs = await lookupsService.list('faculties', { parentId: id });
      counts.faculties = facs.filter((r) => !r.deletedAt).length;
    } else if (key === 'specialtyTypes') {
      const specs = await lookupsService.list('specialties', { parentId: id });
      counts.specialties = specs.filter((r) => !r.deletedAt).length;
    }
    const blocking = Object.values(counts).some((n) => n > 0);
    return { counts, blocking };
  },

  async softDelete(key: LookupKey, id: string, reason: string): Promise<LookupRow> {
    const dep = await lookupsService.getDependencies(key, id);
    if (dep.blocking) throw new DependencyBlockedError(dep, 'هذا السجل', LOOKUP_DEP_LABELS);
    await apiClient.post(`${KEY_TO_PATH[key]}/${id}/archive`);
    const { data } = await apiClient.get<ApiRow>(`${KEY_TO_PATH[key]}/${id}`);
    const after = unpack(data);
    emitAudit({
      action: 'soft_delete', module: 'lookups', entityType: key,
      entityLabel: 'بيانات مرجعية', entityId: id,
      details: `حذف "${after.labelAr}" — السبب: ${reason}`,
      after,
    });
    return after;
  },

  async restore(key: LookupKey, id: string): Promise<LookupRow> {
    await apiClient.post(`${KEY_TO_PATH[key]}/${id}/restore`);
    const { data } = await apiClient.get<ApiRow>(`${KEY_TO_PATH[key]}/${id}`);
    const after = unpack(data);
    emitAudit({
      action: 'restore', module: 'lookups', entityType: key,
      entityLabel: 'بيانات مرجعية', entityId: id,
      details: `استعادة "${after.labelAr}"`,
      after,
    });
    return after;
  },
};

function emitAuditCreate(key: LookupKey, row: LookupRow): void {
  emitAudit({
    action: 'create', module: 'lookups', entityType: key,
    entityLabel: 'بيانات مرجعية', entityId: row.id,
    details: `تم إنشاء "${row.labelAr}" في ${key}`,
    after: row,
  });
}
