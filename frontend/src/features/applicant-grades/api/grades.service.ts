/**
 * Applicant Grades — service layer (real backend).
 *
 * Wired to the spec-009-style Grades module added 2026-05-16:
 *
 *   GET    /admin/grades                                  → GradeRow[]
 *   GET    /admin/grades/paginated?page&pageSize&search&sortKey&sortDirection
 *   GET    /admin/grades/export?search&sortKey&sortDirection
 *   DELETE /admin/grades                                  → 204
 *   POST   /admin/grades/:seat/adjustments                → GradeRow
 *   PATCH  /admin/grades/:seat/adjustments/:id/toggle     → GradeRow
 *   DELETE /admin/grades/:seat/adjustments/:id            → GradeRow
 *   PATCH  /admin/grades/:seat/override-max               → GradeRow
 *   POST   /admin/grades/import/stage                     → StagedImport
 *   POST   /admin/grades/import/commit                    → CommittedImport
 *   POST   /admin/grades/import/preflight                 → ImportReport
 *   POST   /admin/grades/import/commit-v2                 → ImportCommitResult
 */

import { apiClient } from '@/shared/api';
import { emitAudit } from '@/shared/lib/audit';
import type { ImportedGradeRow } from '../lib/parseAccessFile';
import type {
  AdjustmentReason,
  CommittedImport,
  GradeAdjustment,
  GradeRow,
  ImportCommitResult,
  ImportDuplicateRow,
  ImportFailureRow,
  ImportGroupAction,
  ImportGroupCode,
  ImportReport,
  ImportReportGroup,
  ImportResolution,
  ImportSkipBucket,
  ImportSkipCode,
  NormalisedRow,
  StagedImport,
} from '../types';

const REASON_LABEL: Record<AdjustmentReason, string> = {
  SPORTS_ACTIVITY: 'نشاط رياضي',
  GRIEVANCE: 'تظلم',
  LEGAL_CASE: 'قضية',
  OTHER: 'أخرى',
};

const REASON_FROM_BACKEND: Record<string, AdjustmentReason> = {
  SportsActivity: 'SPORTS_ACTIVITY',
  Grievance: 'GRIEVANCE',
  LegalCase: 'LEGAL_CASE',
  Other: 'OTHER',
};

interface BackendAdjustment {
  id: string;
  reason: string;
  note: string | null;
  amount: number;
  addedBy: string;
  addedAt: string;
  isActive: boolean;
  rowVersion: string;
}

interface BackendGradeRow {
  id: string;
  seat: number;
  seatingNumber: string | null;
  nid: string;
  name: string;
  kind: 'general' | 'azhar';
  branch: string;
  school: string;
  region: string;
  total: number;
  importMax: number;
  overrideMax: number | null;
  lastEditedAt: string | null;
  lastEditedBy: string | null;
  status: string;
  log: BackendAdjustment[];
  rowVersion: string;
}

interface BackendStagedImport {
  stageId: string;
  newRowCount: number;
  duplicates: ImportDuplicateRow[];
  skipped: ImportSkipBucket[];
}

/* Module-level stash for the v1 import wizard's stage→commit handshake.
 * The backend's commit endpoint needs the stageId returned from stage;
 * preserving the existing two-call public API means we remember it here. */
let lastStageId: string | null = null;

function mapAdjustment(a: BackendAdjustment): GradeAdjustment {
  const reason = REASON_FROM_BACKEND[a.reason] ?? 'OTHER';
  return {
    id: a.id,
    reason,
    reasonLabel: REASON_LABEL[reason],
    note: a.note ?? '',
    amount: a.amount,
    by: a.addedBy,
    when: a.addedAt,
    isActive: a.isActive,
  };
}

function mapRow(r: BackendGradeRow): GradeRow {
  return {
    seat: r.seat,
    seatingNumber: r.seatingNumber,
    nid: r.nid,
    name: r.name,
    kind: r.kind,
    branch: r.branch,
    school: r.school,
    region: r.region,
    total: r.total,
    importMax: r.importMax,
    overrideMax: r.overrideMax,
    lastEditedAt: r.lastEditedAt,
    lastEditedBy: r.lastEditedBy,
    status: r.status,
    log: r.log.map(mapAdjustment),
  };
}

export const gradesService = {
  async list(): Promise<GradeRow[]> {
    const r = await apiClient.get<BackendGradeRow[]>('/admin/grades');
    return r.data.map(mapRow);
  },

  /** NID-driven single-row lookup for the applicant portal eligibility
   *  gate. Implemented as a client-side filter on `list()` until the
   *  backend exposes a dedicated `/admin/grades/by-nid/:nid` endpoint;
   *  the `cycleId` arg is accepted for contract parity (the dataset is
   *  scoped per active cycle on the backend). */
  async findByNationalId(nid: string, _cycleId: string): Promise<GradeRow | null> {
    const rows = await gradesService.list();
    return rows.find((r) => r.nid === nid) ?? null;
  },

  async clearAll(): Promise<void> {
    await apiClient.delete('/admin/grades');
    emitAudit({
      action: 'grades_cleared',
      module: 'admin',
      entityType: 'GradeRow',
      entityLabel: 'درجات الثانوية',
      entityId: 'all',
      details: 'مسح جميع الدرجات المستوردة',
    });
  },

  async addAdjustment(
    seat: number,
    payload: { reason: AdjustmentReason; note: string | null; amount: number; isActive: boolean; by: string },
  ): Promise<GradeRow> {
    const r = await apiClient.post<BackendGradeRow>(
      `/admin/grades/${seat}/adjustments`,
      {
        reason: payload.reason,
        note: payload.note,
        amount: payload.amount,
        isActive: payload.isActive,
      },
    );
    emitAudit({
      action: 'grade_adjusted',
      module: 'admin',
      entityType: 'GradeAdjustment',
      entityLabel: 'تعديل درجة',
      entityId: `${seat}`,
      details: `إضافة تعديل (${REASON_LABEL[payload.reason]}: ${payload.amount}) للجلوس ${seat}`,
      after: { reason: payload.reason, amount: payload.amount },
    });
    return mapRow(r.data);
  },

  async toggleAdjustment(seat: number, entryId: string): Promise<GradeRow> {
    const r = await apiClient.patch<BackendGradeRow>(
      `/admin/grades/${seat}/adjustments/${entryId}/toggle`,
    );
    emitAudit({
      action: 'grade_adjusted',
      module: 'admin',
      entityType: 'GradeAdjustment',
      entityLabel: 'تعديل درجة',
      entityId: `${seat}:${entryId}`,
      details: `تبديل تفعيل تعديل ${entryId} للجلوس ${seat}`,
    });
    return mapRow(r.data);
  },

  async deleteAdjustment(seat: number, entryId: string): Promise<GradeRow> {
    const r = await apiClient.delete<BackendGradeRow>(
      `/admin/grades/${seat}/adjustments/${entryId}`,
    );
    emitAudit({
      action: 'grade_adjusted',
      module: 'admin',
      entityType: 'GradeAdjustment',
      entityLabel: 'تعديل درجة',
      entityId: `${seat}:${entryId}`,
      details: `حذف تعديل ${entryId} للجلوس ${seat}`,
    });
    return mapRow(r.data);
  },

  async updateOverrideMax(
    seat: number,
    overrideMax: number | null,
    _by: string,
  ): Promise<GradeRow> {
    const r = await apiClient.patch<BackendGradeRow>(
      `/admin/grades/${seat}/override-max`,
      { overrideMax },
    );
    emitAudit({
      action: 'grade_override_set',
      module: 'admin',
      entityType: 'GradeRow',
      entityLabel: 'درجة طالب',
      entityId: `${seat}`,
      details:
        overrideMax == null
          ? `إلغاء الدرجة العظمى المعدّلة للجلوس ${seat}`
          : `ضبط الدرجة العظمى المعدّلة للجلوس ${seat} → ${overrideMax}`,
      after: { overrideMax },
    });
    return mapRow(r.data);
  },

  /* ── Import wizard v1 ───────────────────────────────────────────── */

  async stageImport(input: {
    kind: 'general' | 'azhar';
    maxDegree: number;
    rows: ImportedGradeRow[];
  }): Promise<{ ok: true; staged: StagedImport } | { ok: false; missing: string[] }> {
    const r = await apiClient.post<BackendStagedImport>('/admin/grades/import/stage', {
      kind: input.kind,
      maxDegree: input.maxDegree,
      rows: input.rows,
    });
    lastStageId = r.data.stageId;
    return {
      ok: true,
      staged: {
        newRows: r.data.newRowCount,
        duplicates: r.data.duplicates,
        skipped: (r.data.skipped ?? []).map((s) => ({
          ...s,
          reason: s.reason as ImportSkipCode,
        })),
      },
    };
  },

  async commitImport(
    _staged: StagedImport,
    resolutions: Record<string, ImportResolution>,
  ): Promise<CommittedImport> {
    if (!lastStageId) {
      throw new Error('No staged import to commit. Call stageImport first.');
    }
    const r = await apiClient.post<CommittedImport>('/admin/grades/import/commit', {
      stageId: lastStageId,
      resolutions,
    });
    lastStageId = null;
    emitAudit({
      action: 'grade_imported',
      module: 'admin',
      entityType: 'GradeRow',
      entityLabel: 'درجات الثانوية',
      entityId: 'import',
      details: `استيراد درجات — أُدرج ${r.data.inserted}, حُفظ ${r.data.kept}`,
      after: { inserted: r.data.inserted, replaced: r.data.replaced, kept: r.data.kept },
    });
    return r.data;
  },

  /* ── Import wizard v2 ───────────────────────────────────────────── */

  async runImportPreflight(input: {
    rows: NormalisedRow[];
    graduationYear: number;
  }): Promise<ImportReport> {
    const r = await apiClient.post<{
      totals: { received: number; imported: number; skipped: number; failed: number };
      groups: Array<{
        code: ImportGroupCode;
        labelAr: string;
        rows: ImportFailureRow[];
        availableActions: readonly ImportGroupAction[];
      }>;
    }>('/admin/grades/import/preflight', input);
    return {
      totals: r.data.totals,
      groups: r.data.groups as ImportReportGroup[],
    };
  },

  async runImportCommit(input: {
    rows: NormalisedRow[];
    graduationYear: number;
    perGroupActions: Record<ImportGroupCode, ImportGroupAction | undefined>;
  }): Promise<ImportCommitResult> {
    const r = await apiClient.post<ImportCommitResult>('/admin/grades/import/commit-v2', input);
    emitAudit({
      action: 'grade_imported',
      module: 'admin',
      entityType: 'GradeRow',
      entityLabel: 'درجات الثانوية',
      entityId: 'import-v2',
      details: `استيراد درجات (v2) — أُدرج ${r.data.insertedCount}, فشل ${r.data.failedCount}`,
      after: r.data,
    });
    return r.data;
  },

  /* ── Paginated list (v2) ────────────────────────────────────────── */

  async listPaginated(input: {
    page: number;
    pageSize: number;
    search: string;
    sort?: { key: keyof GradeRow; direction: 'asc' | 'desc' } | null;
  }): Promise<{ rows: GradeRow[]; total: number }> {
    const r = await apiClient.get<{ rows: BackendGradeRow[]; total: number }>(
      '/admin/grades/paginated',
      {
        params: {
          page: input.page,
          pageSize: input.pageSize,
          search: input.search || undefined,
          sortKey: input.sort?.key,
          sortDirection: input.sort?.direction,
        },
      },
    );
    return { rows: r.data.rows.map(mapRow), total: r.data.total };
  },

  async exportAll(input: {
    search: string;
    sort?: { key: keyof GradeRow; direction: 'asc' | 'desc' } | null;
  }): Promise<GradeRow[]> {
    const r = await apiClient.get<BackendGradeRow[]>('/admin/grades/export', {
      params: {
        search: input.search || undefined,
        sortKey: input.sort?.key,
        sortDirection: input.sort?.direction,
      },
    });
    return r.data.map(mapRow);
  },
};
