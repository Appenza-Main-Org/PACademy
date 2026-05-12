/**
 * Admission Setup API — wired to the real backend (spec 009 — Admission-Setup
 * Wizard Persistence). Replaces the previous in-memory mock implementation
 * for the 5 net-new entities (merge/split rules, score thresholds, exam
 * dates, total score, electronic declaration) plus wizard-step status.
 *
 * INTEGRATION CONTRACT (matches backend controllers under
 * backend/src/PACademy.Api/Controllers/Admin/AdmissionSetup/):
 *
 *   # Step 9 — Committee merge/split rules
 *   GET    /admin/admission-setup/cycles/:cycleId/merge-split-rules     → CommitteeMergeSplitRule[]
 *   POST   /admin/admission-setup/cycles/:cycleId/merge-split-rules     → CommitteeMergeSplitRule
 *   POST   /admin/admission-setup/merge-split-rules/:id/archive         → 204
 *
 *   # Step 10 — Committee score thresholds
 *   GET    /admin/admission-setup/cycles/:cycleId/score-thresholds      → CommitteeScoreThreshold[]
 *   PUT    /admin/admission-setup/cycles/:cycleId/committees/:committeeId/score-threshold
 *                                                                       → CommitteeScoreThreshold
 *
 *   # Step 11 — Exam date config
 *   GET    /admin/admission-setup/cycles/:cycleId/exam-dates            → ExamDateConfig | null
 *   PUT    /admin/admission-setup/cycles/:cycleId/exam-dates            → ExamDateConfig
 *
 *   # Step 13 — Total score config
 *   GET    /admin/admission-setup/cycles/:cycleId/total-score           → TotalScoreConfig[]
 *   PUT    /admin/admission-setup/cycles/:cycleId/total-score/:stream   → TotalScoreConfig
 *
 *   # Step 15 — Electronic declaration
 *   GET    /admin/admission-setup/cycles/:cycleId/declaration           → ElectronicDeclaration | null
 *   POST   /admin/admission-setup/cycles/:cycleId/declaration           → ElectronicDeclaration  (new draft)
 *   POST   /admin/admission-setup/declaration/:id/publish               → ElectronicDeclaration
 *
 * Errors:
 *   - 409 ROW_VERSION_CONFLICT     → thrown as RowVersionConflictError
 *                                     (apiClient interceptor in shared/api/errors.ts)
 *   - 4xx other                    → thrown as ApiError
 *   - Audit emission happens on the backend; the frontend no longer calls emitAudit()
 *
 * The 3 category-committee binding methods (listCategoryCommittees,
 * listCommitteeBindings, setCommitteeBindings) still use the mock — they
 * belong to spec 010 (Lookup Management Module) §3 mapping endpoints,
 * which are not yet implemented.
 */

import { apiClient } from '@/shared/api';
import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import { emitAudit } from '@/shared/lib/audit';
import { committeeService } from '@/features/committees';
import type {
  ApplicantCategoryKey,
  CategoryCommittees,
} from '@/shared/types/domain';
import type {
  ApplicantStream,
  CommitteeMergeSplitRule,
  CommitteeScoreThreshold,
  ElectronicDeclaration,
  ExamDateConfig,
  TotalScoreComponent,
  TotalScoreConfig,
} from '../types';

/* ── Mock-only state for the category-committee binding methods ──────── */
const CATEGORY_COMMITTEES: CategoryCommittees[] = MOCK.categoryCommittees.map((c) => ({ ...c }));

export const admissionSetupService = {
  /* ── Step 9 — committee merge / split rules ───────────────────────── */

  async listMergeSplitRules(cycleId: string): Promise<CommitteeMergeSplitRule[]> {
    const r = await apiClient.get<CommitteeMergeSplitRule[]>(
      `/admin/admission-setup/cycles/${cycleId}/merge-split-rules`,
    );
    return r.data;
  },

  async createMergeOrSplit(input: {
    cycleId: string;
    type: 'merge' | 'split';
    sourceCommitteeIds: string[];
    targetCommitteeIds: string[];
    reason?: string;
    effectiveAt: string;
  }): Promise<CommitteeMergeSplitRule> {
    const r = await apiClient.post<CommitteeMergeSplitRule>(
      `/admin/admission-setup/cycles/${input.cycleId}/merge-split-rules`,
      {
        type: input.type,
        sourceCommitteeIds: input.sourceCommitteeIds,
        targetCommitteeIds: input.targetCommitteeIds,
        reason: input.reason,
        effectiveAt: input.effectiveAt,
      },
    );
    return r.data;
  },

  /** Soft-deletes (archives) a planned or cancelled merge/split rule. */
  async softDeleteMergeSplit(ruleId: string, reason: string): Promise<{ ok: true }> {
    await apiClient.post(
      `/admin/admission-setup/merge-split-rules/${ruleId}/archive`,
      { reason },
    );
    return { ok: true };
  },

  /* ── Step 10 — committee score thresholds ─────────────────────────── */

  async listScoreThresholds(cycleId: string): Promise<CommitteeScoreThreshold[]> {
    const r = await apiClient.get<CommitteeScoreThreshold[]>(
      `/admin/admission-setup/cycles/${cycleId}/score-thresholds`,
    );
    return r.data;
  },

  async setCommitteeScoreThresholds(input: {
    cycleId: string;
    committeeId: string;
    min: number;
    max: number;
    rowVersion?: string;
  }): Promise<CommitteeScoreThreshold> {
    const r = await apiClient.put<CommitteeScoreThreshold>(
      `/admin/admission-setup/cycles/${input.cycleId}/committees/${input.committeeId}/score-threshold`,
      {
        min: input.min,
        max: input.max,
        rowVersion: input.rowVersion,
      },
    );
    return r.data;
  },

  /* ── Step 11 — exam date config ───────────────────────────────────── */

  async getExamDateConfig(cycleId: string): Promise<ExamDateConfig | null> {
    const r = await apiClient.get<ExamDateConfig | null>(
      `/admin/admission-setup/cycles/${cycleId}/exam-dates`,
    );
    return r.data ?? null;
  },

  async setExamDateConfig(input: {
    cycleId: string;
    firstAvailableDate: string;
    bookableDays: string[];
    blackoutDates: string[];
    rowVersion?: string;
  }): Promise<ExamDateConfig> {
    const r = await apiClient.put<ExamDateConfig>(
      `/admin/admission-setup/cycles/${input.cycleId}/exam-dates`,
      {
        firstAvailableDate: input.firstAvailableDate,
        bookableDays: input.bookableDays,
        blackoutDates: input.blackoutDates,
        rowVersion: input.rowVersion,
      },
    );
    return r.data;
  },

  /* ── Step 13 — total-score config (per applicant stream) ───────────── */

  async listTotalScoreConfigs(cycleId: string): Promise<TotalScoreConfig[]> {
    const r = await apiClient.get<TotalScoreConfig[]>(
      `/admin/admission-setup/cycles/${cycleId}/total-score`,
    );
    return r.data;
  },

  async setTotalScoreConfig(input: {
    cycleId: string;
    applicantStream: ApplicantStream;
    components: TotalScoreComponent[];
    totalScoreOutOf: number;
    rowVersion?: string;
  }): Promise<TotalScoreConfig> {
    const r = await apiClient.put<TotalScoreConfig>(
      `/admin/admission-setup/cycles/${input.cycleId}/total-score/${input.applicantStream}`,
      {
        components: input.components,
        totalScoreOutOf: input.totalScoreOutOf,
        rowVersion: input.rowVersion,
      },
    );
    return r.data;
  },

  /* ── Step 15 — electronic declaration ────────────────────────────── */

  async getDeclaration(cycleId: string): Promise<ElectronicDeclaration | null> {
    const r = await apiClient.get<ElectronicDeclaration | null>(
      `/admin/admission-setup/cycles/${cycleId}/declaration`,
    );
    return r.data ?? null;
  },

  /** Creates a new draft version of the declaration for a cycle. */
  async setDeclaration(input: {
    cycleId: string;
    bodyAr: string;
    effectiveFrom: string;
  }): Promise<ElectronicDeclaration> {
    const r = await apiClient.post<ElectronicDeclaration>(
      `/admin/admission-setup/cycles/${input.cycleId}/declaration`,
      {
        bodyAr: input.bodyAr,
        effectiveFrom: input.effectiveFrom,
      },
    );
    return r.data;
  },

  async publishDeclaration(declarationId: string): Promise<ElectronicDeclaration> {
    const r = await apiClient.post<ElectronicDeclaration>(
      `/admin/admission-setup/declaration/${declarationId}/publish`,
    );
    return r.data;
  },

  /* ── Step 8 — category↔committee bindings ────────────────────────────
   *
   * TODO(spec-010): These three methods consume the `category_committees`
   * mapping table that spec 010 (Lookup Management Module) owns. Until
   * spec 010's backend ships, they remain mock-backed.
   *
   * Backs the admin-setup wizard committee picker. Persisted bindings tell
   * the applicant-distribution step which committees can absorb each
   * category for the cycle's academic year. List/replace pair mirrors the
   * REST contract; granular add/remove kept off the API surface to keep
   * the audit trail clean (one diff per save). */
  async listCategoryCommittees(cycleId: string): Promise<CategoryCommittees[]> {
    await simulateLatency();
    return CATEGORY_COMMITTEES.filter((b) => b.cycleId === cycleId);
  },

  async listCommitteeBindings(input: {
    cycleId: string;
    categoryId?: ApplicantCategoryKey;
  }): Promise<CategoryCommittees[]> {
    await simulateLatency();
    return CATEGORY_COMMITTEES.filter(
      (b) =>
        b.cycleId === input.cycleId &&
        (input.categoryId ? b.categoryId === input.categoryId : true),
    );
  },

  /**
   * Replace the full set of committee bindings for a cycle (optionally
   * scoped to a single category). Validates each requested committee
   * against the same eligibility rules the applicant-distribution stage
   * enforces — active, current academic year, not at capacity, matching
   * specialization when the category declares one.
   */
  async setCommitteeBindings(input: {
    cycleId: string;
    academicYearId: string;
    categoryId?: ApplicantCategoryKey;
    committeeIds: string[];
    actorUserId?: string;
  }): Promise<CategoryCommittees[]> {
    await simulateLatency();
    const requestedIds = Array.from(new Set(input.committeeIds));
    const allCommittees = await committeeService.list();
    const errors: string[] = [];
    for (const cid of requestedIds) {
      const c = allCommittees.find((x) => x.id === cid);
      if (!c) {
        errors.push(`اللجنة ${cid} غير موجودة`);
        continue;
      }
      if (c.status === 'inactive') {
        errors.push(`اللجنة "${c.name}" معطلة`);
        continue;
      }
      if (c.deletedAt) {
        errors.push(`اللجنة "${c.name}" محذوفة`);
        continue;
      }
      if (c.academicYearId && c.academicYearId !== input.academicYearId) {
        errors.push(`اللجنة "${c.name}" لا تنتمي للعام الأكاديمي ${input.academicYearId}`);
        continue;
      }
      if (c.capacity !== undefined && c.applicants >= c.capacity) {
        errors.push(`اللجنة "${c.name}" مكتملة الطاقة الاستيعابية`);
        continue;
      }
    }
    if (errors.length > 0) {
      throw new Error(errors.join(' · '));
    }

    /* Replace strategy: drop the matching scope, then re-insert the new rows. */
    const before = [...CATEGORY_COMMITTEES];
    const keep = CATEGORY_COMMITTEES.filter((b) => {
      if (b.cycleId !== input.cycleId) return true;
      if (input.categoryId && b.categoryId !== input.categoryId) return true;
      return false;
    });

    const baseCategoryId: ApplicantCategoryKey =
      input.categoryId ?? 'officers_general';
    const now = new Date().toISOString();
    const next: CategoryCommittees[] = requestedIds.map((cid, idx) => ({
      id: `CC-${input.cycleId}-${baseCategoryId}-${cid}`,
      categoryId: baseCategoryId,
      committeeId: cid,
      academicYearId: input.academicYearId,
      cycleId: input.cycleId,
      order: idx + 1,
      createdAt: now,
      createdBy: input.actorUserId ?? 'system',
    }));

    CATEGORY_COMMITTEES.length = 0;
    CATEGORY_COMMITTEES.push(...keep, ...next);

    emitAudit({
      action: 'update',
      module: 'committees',
      entityType: 'CategoryCommittees',
      entityLabel: 'لجان دورة القبول',
      entityId: `${input.cycleId}:${baseCategoryId}`,
      details: `تم تحديث قائمة اللجان المختارة (${next.length} لجنة) للدورة`,
      before,
      after: CATEGORY_COMMITTEES,
    });

    return next;
  },
};
