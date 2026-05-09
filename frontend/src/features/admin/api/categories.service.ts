/**
 * Admin Categories — real API integration (spec 004 US3).
 *
 * INTEGRATION CONTRACT (backend: AdminCategoriesController + CategoriesController):
 *   GET    /admin/categories                       → CategoryListItemDto[]
 *   GET    /admin/categories/by-key/:key           → CategoryDetailDto
 *   POST   /admin/categories                       → CategoryDetailDto (custom keys only — spec keys reject)
 *   PATCH  /admin/categories/by-key/:key           → CategoryDetailDto
 *   DELETE /admin/categories/by-key/:key           → 204 (non-spec only)
 *   GET    /categories                             → CategoryListItemDto[] (public)
 *
 * Backend stores Conditions / RequiredTests / Procedures as raw JSON
 * columns; the frontend `ApplicantCategory` shape is round-tripped through
 * those columns verbatim.
 */

import { apiClient } from '@/shared/api/client';
import type {
  ApplicantCategory,
  ApplicantCategoryKey,
  CategoryCondition,
  RequiredTest,
} from '@/shared/types/domain';

const SPEC_KEYS: ReadonlySet<ApplicantCategoryKey> = new Set<ApplicantCategoryKey>([
  'officers_general',
  'officers_specialized',
  'postgraduate',
  'institute_officers_training',
  'institute_traffic',
  'institute_guarding',
  'special_units',
]);

interface CategoryListItemDto {
  id: string;
  key: string;
  nameAr: string;
  nameEn: string | null;
  sortOrder: number;
  isActive: boolean;
  isSpec: boolean;
}

interface CategoryDetailDto extends CategoryListItemDto {
  description: string | null;
  conditions: unknown;
  requiredTests: unknown;
  procedures: unknown;
  createdAt: string;
  updatedAt: string;
  demoOrigin: boolean;
}

const DEFAULT_CONDITIONS: CategoryCondition = {
  ageMin: null,
  ageMax: null,
  minScorePercent: null,
  requiredQualification: 'any',
  gender: 'any',
  minHeightCm: null,
  medicalRequired: false,
  maritalStatus: 'any',
  conductCheck: false,
  egyptianNationalityRequired: false,
  employerApprovalRequired: false,
  nominationOnly: false,
  freeText: [],
};

function asConditions(raw: unknown): CategoryCondition {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CONDITIONS };
  const r = raw as Partial<CategoryCondition>;
  return {
    ...DEFAULT_CONDITIONS,
    ...r,
    freeText: Array.isArray(r.freeText) ? r.freeText.map(String) : [],
  };
}

function asRequiredTests(raw: unknown): RequiredTest[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is RequiredTest => Boolean(x) && typeof x === 'object')
    .map((t, i) => ({
      kind: t.kind,
      order: typeof t.order === 'number' ? t.order : i + 1,
      passingCriteria: t.passingCriteria ?? '',
    }));
}

function asProcedures(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(String);
}

function listItemToCategory(dto: CategoryListItemDto): ApplicantCategory {
  return {
    key: dto.key as ApplicantCategoryKey,
    labelAr: dto.nameAr,
    labelEn: dto.nameEn ?? '',
    description: '',
    isOpen: dto.isActive,
    conditions: { ...DEFAULT_CONDITIONS },
    requiredTests: [],
    procedures: [],
  };
}

function detailToCategory(dto: CategoryDetailDto): ApplicantCategory {
  return {
    key: dto.key as ApplicantCategoryKey,
    labelAr: dto.nameAr,
    labelEn: dto.nameEn ?? '',
    description: dto.description ?? '',
    isOpen: dto.isActive,
    conditions: asConditions(dto.conditions),
    requiredTests: asRequiredTests(dto.requiredTests),
    procedures: asProcedures(dto.procedures),
  };
}

export const categoriesAdminService = {
  async list(): Promise<ApplicantCategory[]> {
    const { data } = await apiClient.get<CategoryListItemDto[]>('/admin/categories');
    /* The list endpoint returns lightweight rows. To populate conditions on the
     * list page we'd otherwise need N+1 calls; CategoriesListPage only renders
     * a few fields from `conditions`, so we hydrate lazily by fetching the
     * detail in parallel. Cheap because there are at most ~10 categories. */
    const detailed = await Promise.all(
      data.map(async (item) => {
        try {
          const { data: detail } = await apiClient.get<CategoryDetailDto>(
            `/admin/categories/by-key/${encodeURIComponent(item.key)}`,
          );
          return detailToCategory(detail);
        } catch {
          return listItemToCategory(item);
        }
      }),
    );
    return detailed;
  },

  async getByKey(key: ApplicantCategoryKey): Promise<ApplicantCategory | null> {
    try {
      const { data } = await apiClient.get<CategoryDetailDto>(
        `/admin/categories/by-key/${encodeURIComponent(key)}`,
      );
      return detailToCategory(data);
    } catch (err) {
      if ((err as { status?: number }).status === 404) return null;
      throw err;
    }
  },

  async update(
    key: ApplicantCategoryKey,
    patch: Partial<ApplicantCategory>,
  ): Promise<ApplicantCategory> {
    const isSpec = SPEC_KEYS.has(key);
    const body: Record<string, unknown> = {};
    if (patch.labelAr !== undefined && !isSpec) body.nameAr = patch.labelAr;
    if (patch.labelEn !== undefined) body.nameEn = patch.labelEn;
    if (patch.description !== undefined) body.description = patch.description;
    if (patch.conditions !== undefined) {
      body.conditions = isSpec
        ? { ...patch.conditions, nominationOnly: undefined }
        : patch.conditions;
    }
    if (patch.requiredTests !== undefined) body.requiredTests = patch.requiredTests;
    if (patch.procedures !== undefined) body.procedures = patch.procedures;
    if (patch.isOpen !== undefined && !isSpec) body.isActive = patch.isOpen;

    const { data } = await apiClient.patch<CategoryDetailDto>(
      `/admin/categories/by-key/${encodeURIComponent(key)}`,
      body,
    );
    return detailToCategory(data);
  },

  async create(payload: ApplicantCategory): Promise<ApplicantCategory> {
    if (SPEC_KEYS.has(payload.key)) {
      throw new Error('لا يمكن إنشاء فئات بمفاتيح المواصفات السبع');
    }
    const { data } = await apiClient.post<CategoryDetailDto>('/admin/categories', {
      key: payload.key,
      nameAr: payload.labelAr,
      nameEn: payload.labelEn || null,
      description: payload.description || null,
      conditions: payload.conditions,
      requiredTests: payload.requiredTests,
      procedures: payload.procedures,
      sortOrder: null,
    });
    return detailToCategory(data);
  },

  async remove(key: ApplicantCategoryKey): Promise<{ ok: true }> {
    if (SPEC_KEYS.has(key)) {
      throw new Error('لا يمكن حذف فئات السبع المعتمدة من المواصفات');
    }
    await apiClient.delete(`/admin/categories/by-key/${encodeURIComponent(key)}`);
    return { ok: true };
  },

  isSpecCategory(key: ApplicantCategoryKey): boolean {
    return SPEC_KEYS.has(key);
  },
};
