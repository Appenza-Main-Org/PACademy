/**
 * Application Settings — global master-data service.
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/admin/app-settings/category-configs
 *   PATCH  /api/admin/app-settings/category-configs/:id
 *   GET    /api/admin/app-settings/category-configs/:configId/specializations
 *   GET    /api/admin/app-settings/category-configs/:configId/eligible-specializations
 *   POST   /api/admin/app-settings/category-configs/:configId/specializations
 *   DELETE /api/admin/app-settings/specializations/:id
 *   GET    /api/admin/app-settings/specializations/:csId/years
 *   POST   /api/admin/app-settings/category-configs/:configId/years
 *   PATCH  /api/admin/app-settings/years/:id
 *   DELETE /api/admin/app-settings/years/:id
 *   POST   /api/admin/app-settings/years/:id/toggle-active
 *   POST   /api/admin/app-settings/bulk-save
 */

import { apiClient } from '@/shared/lib/api-client';
import type {
  ApplicantCategoryGenderScope,
  ApplicantCategoryType,
  SpecializationRow,
} from '@/features/lookups/types';
import { ADMISSION_SETUP_CYCLE_STORAGE_KEY } from '../config';
import type { YearRowDraft } from '../lib/appSettingsValidation';
import type {
  ApplicantCategoryConfig,
  ApplicantCategorySpecialization,
  ApplicantSpecializationYear,
  YearGradeKind,
} from '../types';

export interface CategoryConfigJoined extends ApplicantCategoryConfig {
  categoryCode: string;
  categoryNameAr: string;
  categoryType: ApplicantCategoryType;
  categoryFacultyCodes: readonly string[];
  categorySpecializationCodes: readonly string[];
  lockedGender: ApplicantCategoryGenderScope | null;
  singleAxis: boolean;
  implicitSpecId: string | null;
  specializationCount: number;
  yearCount: number;
  excellenceCriterion: string[];
}

export interface CategorySpecializationJoined extends ApplicantCategorySpecialization {
  specializationNameAr: string;
  yearCount: number;
}

export interface ParentCategorySnapshot {
  code: string;
  lockedGender: ApplicantCategoryGenderScope | null;
}

export interface BulkYearChange {
  id: string | null;
  kind: 'create' | 'update' | 'delete';
  categorySpecializationId: string;
  row?: YearRowDraft;
}

export interface BulkSaveResult {
  created: number;
  updated: number;
  deleted: number;
}

export interface YearGroupForReview {
  csId: string;
  nameAr: string | null;
  years: ApplicantSpecializationYear[];
}

export interface CategorySettingsSummary {
  config: CategoryConfigJoined;
  groups: YearGroupForReview[];
  gradingMode: YearGradeKind | null;
}

export interface ApplicationSettingsCycleDraftPayload {
  version: number;
  cycleId: string;
  updatedAt?: string;
  headers: Record<string, unknown>;
  local: unknown[];
  approved: unknown[];
}

function readSelectedCycleId(): string | null {
  try {
    return sessionStorage.getItem(ADMISSION_SETUP_CYCLE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function cycleHeaders(cycleId?: string | null): HeadersInit | undefined {
  const resolved = cycleId ?? readSelectedCycleId();
  return resolved ? { 'X-Cycle-Id': resolved } : undefined;
}

function cycleQuery(cycleId?: string | null): { cycleId?: string } | undefined {
  const resolved = cycleId ?? readSelectedCycleId();
  return resolved ? { cycleId: resolved } : undefined;
}

async function buildApplicationSettingsSummaryFromTree(
  cycleId?: string | null,
): Promise<CategorySettingsSummary[]> {
  const configs = await apiClient.get<CategoryConfigJoined[]>(
    '/api/admin/app-settings/category-configs',
    { headers: cycleHeaders(cycleId), query: cycleQuery(cycleId) },
  );

  return Promise.all(
    configs.map(async (config) => {
      const groups = await buildReviewGroups(config, cycleId);
      return {
        config,
        groups,
        gradingMode: await resolveReviewGradingMode(groups, cycleId),
      };
    }),
  );
}

async function buildReviewGroups(
  config: CategoryConfigJoined,
  cycleId?: string | null,
): Promise<YearGroupForReview[]> {
  const specializations = await apiClient.get<CategorySpecializationJoined[]>(
    `/api/admin/app-settings/category-configs/${encodeURIComponent(config.id)}/specializations`,
    { headers: cycleHeaders(cycleId), query: cycleQuery(cycleId) },
  );

  return Promise.all(
    specializations.map(async (specialization) => ({
      csId: specialization.id,
      nameAr: config.singleAxis ? null : specialization.specializationNameAr,
      years: await apiClient.get<ApplicantSpecializationYear[]>(
        `/api/admin/app-settings/specializations/${encodeURIComponent(specialization.id)}/years`,
        { headers: cycleHeaders(cycleId), query: cycleQuery(cycleId) },
      ),
    })),
  );
}

async function resolveReviewGradingMode(
  groups: readonly YearGroupForReview[],
  cycleId?: string | null,
): Promise<YearGradeKind | null> {
  const firstGroup = groups[0];
  if (!firstGroup) return null;

  try {
    const response = await apiClient.get<{ gradingMode: YearGradeKind | null }>(
      `/api/admin/app-settings/specializations/${encodeURIComponent(firstGroup.csId)}/grading-mode`,
      { headers: cycleHeaders(cycleId), query: cycleQuery(cycleId) },
    );
    return response.gradingMode;
  } catch {
    return groups.flatMap((group) => group.years)[0]?.gradeKind ?? null;
  }
}

export const applicationSettingsService = {
  async listCategoryConfigs(): Promise<CategoryConfigJoined[]> {
    return apiClient.get('/api/admin/app-settings/category-configs', {
      headers: cycleHeaders(),
      query: cycleQuery(),
    });
  },

  async listCategoryConfigsForCycle(
    cycleId?: string | null,
  ): Promise<CategoryConfigJoined[]> {
    return apiClient.get('/api/admin/app-settings/category-configs', {
      headers: cycleHeaders(cycleId),
      query: cycleQuery(cycleId),
    });
  },

  async listSpecializationsForConfig(
    configId: string,
  ): Promise<CategorySpecializationJoined[]> {
    return apiClient.get(`/api/admin/app-settings/category-configs/${encodeURIComponent(configId)}/specializations`, {
      headers: cycleHeaders(),
      query: cycleQuery(),
    });
  },

  async getEligibleSpecializations(
    configId: string,
  ): Promise<SpecializationRow[]> {
    return apiClient.get(`/api/admin/app-settings/category-configs/${encodeURIComponent(configId)}/eligible-specializations`, {
      headers: cycleHeaders(),
      query: cycleQuery(),
    });
  },

  async listYears(
    categorySpecializationId: string,
  ): Promise<ApplicantSpecializationYear[]> {
    return apiClient.get(`/api/admin/app-settings/specializations/${encodeURIComponent(categorySpecializationId)}/years`, {
      headers: cycleHeaders(),
      query: cycleQuery(),
    });
  },

  async getApplicationSettingsSummary(cycleId?: string | null): Promise<CategorySettingsSummary[]> {
    try {
      return await apiClient.get<CategorySettingsSummary[]>('/api/admin/app-settings/summary', {
        headers: cycleHeaders(cycleId),
        query: cycleQuery(cycleId),
      });
    } catch {
      /* Some backend environments do not yet expose the aggregate summary. */
    }
    return buildApplicationSettingsSummaryFromTree(cycleId);
  },

  async getCycleDraft(cycleId: string): Promise<ApplicationSettingsCycleDraftPayload> {
    return apiClient.get(`/api/admin/app-settings/cycle-drafts/${encodeURIComponent(cycleId)}`, {
      headers: cycleHeaders(cycleId),
      query: cycleQuery(cycleId),
    });
  },

  async saveCycleDraft(
    cycleId: string,
    draft: ApplicationSettingsCycleDraftPayload,
  ): Promise<ApplicationSettingsCycleDraftPayload> {
    return apiClient.put(`/api/admin/app-settings/cycle-drafts/${encodeURIComponent(cycleId)}`, draft, {
      headers: cycleHeaders(cycleId),
      query: cycleQuery(cycleId),
    });
  },

  async getGradingModeForSpec(
    categorySpecializationId: string,
  ): Promise<YearGradeKind | null> {
    const response = await apiClient.get<{ gradingMode: YearGradeKind | null }>(
      `/api/admin/app-settings/specializations/${encodeURIComponent(categorySpecializationId)}/grading-mode`,
      { headers: cycleHeaders(), query: cycleQuery() },
    );
    return response.gradingMode;
  },

  async getParentCategoryForSpec(
    categorySpecializationId: string,
  ): Promise<ParentCategorySnapshot | null> {
    // "No parent category" serializes as 204 No Content → undefined; coalesce
    // so the query resolves (TanStack treats undefined data as an error).
    const snapshot = await apiClient.get<ParentCategorySnapshot | null | undefined>(
      `/api/admin/app-settings/specializations/${encodeURIComponent(categorySpecializationId)}/parent-category`,
      {
        headers: cycleHeaders(),
        query: cycleQuery(),
      },
    );
    return snapshot ?? null;
  },

  async attachSpecialization(
    configId: string,
    specializationId: string,
  ): Promise<CategorySpecializationJoined> {
    return apiClient.post(`/api/admin/app-settings/category-configs/${encodeURIComponent(configId)}/specializations`, {
      specializationId,
    }, {
      headers: cycleHeaders(),
      query: cycleQuery(),
    });
  },

  async detachSpecialization(id: string): Promise<void> {
    await apiClient.delete(`/api/admin/app-settings/specializations/${encodeURIComponent(id)}`, {
      headers: cycleHeaders(),
      query: cycleQuery(),
    });
  },

  async createYear(input: YearRowDraft & { categorySpecializationId: string }): Promise<ApplicantSpecializationYear> {
    const { categorySpecializationId, ...row } = input;
    return apiClient.post(
      `/api/admin/app-settings/category-configs/${encodeURIComponent(categorySpecializationId)}/years`,
      row,
      { headers: cycleHeaders(), query: cycleQuery() },
    );
  },

  async updateYear(
    id: string,
    patch: Partial<YearRowDraft>,
  ): Promise<ApplicantSpecializationYear> {
    return apiClient.patch(`/api/admin/app-settings/years/${encodeURIComponent(id)}`, patch, {
      headers: cycleHeaders(),
      query: cycleQuery(),
    });
  },

  async deleteYear(id: string): Promise<void> {
    await apiClient.delete(`/api/admin/app-settings/years/${encodeURIComponent(id)}`, {
      headers: cycleHeaders(),
      query: cycleQuery(),
    });
  },

  async toggleYearActive(id: string): Promise<ApplicantSpecializationYear> {
    return apiClient.post(`/api/admin/app-settings/years/${encodeURIComponent(id)}/toggle-active`, undefined, {
      headers: cycleHeaders(),
      query: cycleQuery(),
    });
  },

  async toggleCategoryActive(
    configId: string,
  ): Promise<CategoryConfigJoined> {
    return apiClient.patch(`/api/admin/app-settings/category-configs/${encodeURIComponent(configId)}`, {
      toggleActive: true,
    }, {
      headers: cycleHeaders(),
      query: cycleQuery(),
    });
  },

  async bulkSave(payload: BulkYearChange[]): Promise<BulkSaveResult> {
    return apiClient.post('/api/admin/app-settings/bulk-save', payload, {
      headers: cycleHeaders(),
      query: cycleQuery(),
    });
  },
};

export type ApplicationSettingsService = typeof applicationSettingsService;
