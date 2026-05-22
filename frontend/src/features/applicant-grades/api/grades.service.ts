/**
 * Applicant Grades — service layer.
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/grades
 *   GET    /api/grades/export
 *   GET    /api/admin/applicant-grades/by-nid/:nid?cycleId=
 *   DELETE /api/grades
 *   POST   /api/grades/:seat/adjustments
 *   POST   /api/grades/:seat/adjustments/:entryId/toggle
 *   DELETE /api/grades/:seat/adjustments/:entryId
 *   PATCH  /api/grades/:seat/override-max
 *   POST   /api/grades/import/stage
 *   POST   /api/grades/import/commit
 *   POST   /api/grades/v2/preflight
 *   POST   /api/grades/v2/commit
 */

import { apiClient } from '@/shared/lib/api-client';
import { isNotFoundError } from '@/shared/lib/errors';
import type { ImportedGradeRow } from '../lib/parseAccessFile';
import type {
  AdjustmentReason,
  CommittedImport,
  GradeRow,
  ImportCommitResult,
  ImportCommitProgress,
  ImportGroupAction,
  ImportReport,
  ImportResolution,
  NormalisedRow,
  StagedImport,
} from '../types';

const GRADES_API = '/api/grades';
const IMPORT_COMMIT_CHUNK_SIZE = 5000;

export type ApplicantGradesSortKey =
  | keyof GradeRow
  | 'max'
  | 'isOverridden'
  | 'adj'
  | 'pct'
  | 'eff'
  | 'effPct';

export interface ApplicantGradesSort {
  key: ApplicantGradesSortKey;
  direction: 'asc' | 'desc';
}

export interface ApplicantGradesColumnFilters {
  nid?: string;
  seatingNumber?: string;
  name?: string;
  totalMin?: number | null;
  totalMax?: number | null;
  pctMin?: number | null;
  pctMax?: number | null;
  effMin?: number | null;
  effMax?: number | null;
  schoolCategoryCodes?: readonly string[];
  school?: string;
  graduationYearMin?: number | null;
  graduationYearMax?: number | null;
}

interface FilterInput {
  search?: string;
  gender?: GradeRow['gender'] | 'all';
  branch?: string | 'all';
  graduationYear?: number | 'all';
  schoolCategoryCode?: string | 'all';
  columnFilters?: ApplicantGradesColumnFilters;
  changedOnly?: boolean;
}

type GradesQuery = Record<string, string | number | boolean | readonly string[] | undefined>;

function toGradesQuery(
  input: FilterInput & {
    page?: number;
    pageSize?: number;
    sort?: ApplicantGradesSort | null;
  },
): GradesQuery {
  return {
    page: input.page,
    size: input.pageSize,
    q: input.search?.trim() || undefined,
    sortKey: input.sort?.key,
    sortDirection: input.sort?.direction,
    gender: input.gender && input.gender !== 'all' ? input.gender : undefined,
    branch: input.branch && input.branch !== 'all' ? input.branch : undefined,
    year:
      input.graduationYear && input.graduationYear !== 'all'
        ? input.graduationYear
        : undefined,
    schoolCategoryCode:
      input.schoolCategoryCode && input.schoolCategoryCode !== 'all'
        ? input.schoolCategoryCode
        : undefined,
    changedOnly: input.changedOnly ? true : undefined,
    nid: input.columnFilters?.nid,
    seatingNumber: input.columnFilters?.seatingNumber,
    name: input.columnFilters?.name,
    totalMin: input.columnFilters?.totalMin ?? undefined,
    totalMax: input.columnFilters?.totalMax ?? undefined,
    pctMin: input.columnFilters?.pctMin ?? undefined,
    pctMax: input.columnFilters?.pctMax ?? undefined,
    effMin: input.columnFilters?.effMin ?? undefined,
    effMax: input.columnFilters?.effMax ?? undefined,
    schoolCategoryCodes: input.columnFilters?.schoolCategoryCodes,
    school: input.columnFilters?.school,
    graduationYearMin: input.columnFilters?.graduationYearMin ?? undefined,
    graduationYearMax: input.columnFilters?.graduationYearMax ?? undefined,
  };
}

export const gradesService = {
  async list(): Promise<GradeRow[]> {
    return apiClient.get<GradeRow[]>(GRADES_API);
  },

  async findByNationalId(nid: string, cycleId: string): Promise<GradeRow | null> {
    try {
      return await apiClient.get<GradeRow>(
        `/api/admin/applicant-grades/by-nid/${encodeURIComponent(nid)}`,
        { query: { cycleId } },
      );
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw err;
    }
  },

  async clearAll(): Promise<void> {
    await apiClient.delete<{ deleted: number }>(GRADES_API);
  },

  async deleteRows(seats: readonly number[]): Promise<{ deleted: number }> {
    return apiClient.delete<{ deleted: number }>(GRADES_API, { body: { seats } });
  },

  async addAdjustment(
    seat: number,
    payload: { reason: AdjustmentReason; note: string | null; amount: number; isActive: boolean; by: string },
  ): Promise<GradeRow> {
    return apiClient.post<GradeRow>(`${GRADES_API}/${encodeURIComponent(String(seat))}/adjustments`, payload);
  },

  async toggleAdjustment(seat: number, entryId: string): Promise<GradeRow> {
    return apiClient.post<GradeRow>(
      `${GRADES_API}/${encodeURIComponent(String(seat))}/adjustments/${encodeURIComponent(entryId)}/toggle`,
    );
  },

  async deleteAdjustment(seat: number, entryId: string): Promise<GradeRow> {
    return apiClient.delete<GradeRow>(
      `${GRADES_API}/${encodeURIComponent(String(seat))}/adjustments/${encodeURIComponent(entryId)}`,
    );
  },

  async updateOverrideMax(
    seat: number,
    overrideMax: number | null,
    by: string,
  ): Promise<GradeRow> {
    return apiClient.patch<GradeRow>(`${GRADES_API}/${encodeURIComponent(String(seat))}/override-max`, {
      overrideMax,
      by,
    });
  },

  async stageImport(input: {
    kind: 'general' | 'azhar';
    maxDegree: number;
    rows: ImportedGradeRow[];
  }): Promise<{ ok: true; staged: StagedImport } | { ok: false; missing: string[] }> {
    return apiClient.post(`${GRADES_API}/import/stage`, input);
  },

  async commitImport(
    staged: StagedImport,
    resolutions: Record<string, ImportResolution>,
  ): Promise<CommittedImport> {
    return apiClient.post(`${GRADES_API}/import/commit`, { staged, resolutions });
  },

  async runImportPreflight(input: {
    rows: NormalisedRow[];
    graduationYear: number;
  }): Promise<ImportReport> {
    return apiClient.post(`${GRADES_API}/v2/preflight`, input);
  },

  async runImportCommit(input: {
    rows: NormalisedRow[];
    graduationYear: number;
    selectedSchoolCategories: string[];
    maxGradeByCategory: Record<string, number>;
    perGroupActions: Partial<Record<string, ImportGroupAction>>;
    onProgress?: (progress: ImportCommitProgress) => void;
  }): Promise<ImportCommitResult> {
    const { rows, onProgress, ...payload } = input;
    const totalRows = rows.length;
    const aggregate: ImportCommitResult = {
      insertedCount: 0,
      failedCount: 0,
      alreadyImportedCount: 0,
    };

    if (totalRows === 0) {
      onProgress?.({ processedRows: 0, totalRows, ...aggregate });
      return aggregate;
    }

    for (let offset = 0; offset < totalRows; offset += IMPORT_COMMIT_CHUNK_SIZE) {
      const chunk = rows.slice(offset, offset + IMPORT_COMMIT_CHUNK_SIZE);
      const result = await apiClient.post<ImportCommitResult>(
        `${GRADES_API}/v2/commit`,
        { ...payload, rows: chunk },
      );
      aggregate.insertedCount += result.insertedCount;
      aggregate.failedCount += result.failedCount;
      aggregate.alreadyImportedCount += result.alreadyImportedCount;
      onProgress?.({
        processedRows: Math.min(offset + chunk.length, totalRows),
        totalRows,
        ...aggregate,
      });
    }

    return aggregate;
  },

  async listPaginated(input: FilterInput & {
    page: number;
    pageSize: number;
    sort?: ApplicantGradesSort | null;
  }): Promise<{ rows: GradeRow[]; total: number }> {
    return apiClient.get<{ rows: GradeRow[]; total: number }>(GRADES_API, {
      query: toGradesQuery(input),
    });
  },

  async exportAll(input: FilterInput & {
    sort?: ApplicantGradesSort | null;
  }): Promise<GradeRow[]> {
    return apiClient.get<GradeRow[]>(`${GRADES_API}/export`, {
      query: toGradesQuery(input),
    });
  },
};

export function hasGradeChange(r: GradeRow): boolean {
  return r.gradeChangedAt != null || r.log.length > 0;
}
