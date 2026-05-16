/**
 * Exam Plans API — Gap J (admin-gaps) + spec 009 §8 (CycleExam plan).
 *
 * LEGACY (mock-backed) — per-cycle, per-category exam ordering:
 *   GET    /api/cycles/:cycleId/exam-plans                                 → CycleCategoryExamPlan[]
 *   GET    /api/cycles/:cycleId/categories/:categoryId/exam-plan           → CycleCategoryExamPlan
 *   PUT    /api/cycles/:cycleId/categories/:categoryId/exam-plan           → CycleCategoryExamPlan
 *   POST   /api/cycles/:targetCycleId/exam-plans/copy?from=:sourceCycleId  → CycleCategoryExamPlan[]
 *
 * SPEC 009 §8 — CycleExam plan (real backend, GUID-scoped):
 *   GET    /admin/cycles/:cycleId/exam-plan[?categoryId=]   → CycleExamDto[]
 *   POST   /admin/cycles/:cycleId/exam-plan                 → 201 CycleExamDto
 *   PATCH  /admin/cycle-exams/:id                           → CycleExamDto
 *   POST   /admin/cycles/:cycleId/exam-plan/reorder         → CycleExamDto[]
 *   POST   /admin/cycle-exams/:id/archive                   → 204
 *   POST   /admin/cycle-exams/:id/restore                   → CycleExamDto
 *
 * Result-entry stubs (real backend wires these to:
 *   - manualEntry: POST /api/cycles/:cycleId/exams/:examId/results
 *   - bulkUpload: POST /api/cycles/:cycleId/exams/:examId/results/bulk-upload  (xlsx)
 *   - deviceIntegration: webhook /api/cycles/:cycleId/exams/:examId/device-callback)
 */

import { apiClient } from '@/shared/api';
import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import { emitAudit } from '@/shared/lib/audit';
import { ConflictError } from '@/shared/lib/errors';
import { DEFAULT_EXAM_PLAN_ENTRIES } from '@/shared/mock-data/academyExams';
import type {
  AcademyExam,
  ApplicantCategoryKey,
  CycleCategoryExamPlan,
  CycleCategoryExamPlanEntry,
  ExamResultStatus,
} from '@/shared/types/domain';

/* ── Spec 009 §8 types ──────────────────────────────────────────────── */

/** Backend CycleExam entity (spec 009 §8). */
export interface CycleExamDto {
  id: string;
  cycleId: string;
  examTypeKey: string;
  categoryId: string | null;
  order: number;
  isRequired: boolean;
  feeEgp: number | null;
  isArchived: boolean;
  rowVersion: string;
}

export interface CreateCycleExamRequest {
  examTypeKey: string;
  categoryId?: string;
  order: number;
  isRequired: boolean;
  feeEgp?: number;
}

export interface UpdateCycleExamRequest {
  examTypeKey?: string;
  categoryId?: string;
  order?: number;
  isRequired?: boolean;
  feeEgp?: number;
  rowVersion: string;
}

const PLANS: CycleCategoryExamPlan[] = [...MOCK.cycleCategoryExamPlans];
let planIdSeq = 1;
const planId = (): string => `EP-${String(planIdSeq++).padStart(5, '0')}`;

function ensurePlan(cycleId: string, categoryId: ApplicantCategoryKey): CycleCategoryExamPlan {
  const existing = PLANS.find((p) => p.cycleId === cycleId && p.categoryId === categoryId);
  if (existing) return existing;
  const fresh: CycleCategoryExamPlan = {
    id: planId(),
    cycleId,
    categoryId,
    exams: DEFAULT_EXAM_PLAN_ENTRIES.map((e) => ({ ...e })),
    updatedAt: new Date().toISOString(),
  };
  PLANS.push(fresh);
  return fresh;
}

export const examPlansService = {
  async listExams(): Promise<AcademyExam[]> {
    await simulateLatency(80, 160);
    return [...MOCK.academyExams];
  },

  async listForCycle(cycleId: string): Promise<CycleCategoryExamPlan[]> {
    await simulateLatency();
    return PLANS.filter((p) => p.cycleId === cycleId).map((p) => ({ ...p, exams: [...p.exams] }));
  },

  async getPlan(cycleId: string, categoryId: ApplicantCategoryKey): Promise<CycleCategoryExamPlan> {
    await simulateLatency();
    return { ...ensurePlan(cycleId, categoryId) };
  },

  /**
   * Save plan entries. Validates that `order` values are unique within the
   * (cycle, category) pair — duplicate orders throw ConflictError(
   * 'EXAM_ORDER_DUPLICATE'). Audit emits update with before/after.
   */
  async savePlan(
    cycleId: string,
    categoryId: ApplicantCategoryKey,
    entries: CycleCategoryExamPlanEntry[],
  ): Promise<CycleCategoryExamPlan> {
    await simulateLatency();
    const seenOrders = new Set<number>();
    for (const e of entries) {
      if (seenOrders.has(e.order)) {
        throw new ConflictError(
          'EXAM_ORDER_DUPLICATE',
          { cycleId, categoryId, order: e.order },
          `الترتيب ${e.order} مستخدم أكثر من مرة في خطة الاختبارات`,
        );
      }
      seenOrders.add(e.order);
    }
    const idx = PLANS.findIndex((p) => p.cycleId === cycleId && p.categoryId === categoryId);
    const before = idx >= 0 ? { ...PLANS[idx] } : null;
    const next: CycleCategoryExamPlan =
      idx >= 0
        ? { ...PLANS[idx], exams: entries, updatedAt: new Date().toISOString() }
        : {
            id: planId(),
            cycleId,
            categoryId,
            exams: entries,
            updatedAt: new Date().toISOString(),
          };
    if (idx >= 0) PLANS[idx] = next;
    else PLANS.push(next);
    emitAudit({
      action: 'update',
      module: 'exams',
      entityType: 'CycleCategoryExamPlan',
      entityLabel: 'خطة اختبارات',
      entityId: next.id,
      details: `حفظ خطة اختبارات الفئة ${categoryId} للدورة ${cycleId}`,
      before,
      after: next,
    });
    return next;
  },

  /**
   * Copy all plans from one cycle to another. Returns the new plans.
   * The target cycle's existing plans are wiped first.
   */
  async copyConfig(input: { fromCycleId: string; toCycleId: string }): Promise<CycleCategoryExamPlan[]> {
    await simulateLatency(200, 400);
    const sourcePlans = PLANS.filter((p) => p.cycleId === input.fromCycleId);
    if (sourcePlans.length === 0) {
      throw new Error('الدورة المصدر لا تحتوي على خطط اختبارات لنسخها');
    }
    /* Wipe the target cycle's plans first. */
    for (let i = PLANS.length - 1; i >= 0; i -= 1) {
      if (PLANS[i].cycleId === input.toCycleId) PLANS.splice(i, 1);
    }
    const cloned: CycleCategoryExamPlan[] = sourcePlans.map((p) => ({
      id: planId(),
      cycleId: input.toCycleId,
      categoryId: p.categoryId,
      exams: p.exams.map((e) => ({ ...e })),
      updatedAt: new Date().toISOString(),
    }));
    PLANS.push(...cloned);
    emitAudit({
      action: 'create',
      module: 'exams',
      entityType: 'CycleCategoryExamPlan',
      entityLabel: 'خطة اختبارات',
      entityId: input.toCycleId,
      details: `نسخ خطط الاختبارات من دورة ${input.fromCycleId} إلى ${input.toCycleId} (${cloned.length} خطة)`,
      after: { count: cloned.length, fromCycleId: input.fromCycleId },
    });
    return cloned;
  },

  /**
   * Sequence guard — Gap J. Returns false when any prior required exam
   * for the (cycle, category) is missing-or-failed for this applicant.
   * Mock implementation passes through; real backend reads the applicant's
   * exam-result history.
   */
  async canEnterResult(applicantId: string, examId: string, ctx: { cycleId: string; categoryId: ApplicantCategoryKey }): Promise<boolean> {
    await simulateLatency(60, 120);
    const plan = ensurePlan(ctx.cycleId, ctx.categoryId);
    const target = plan.exams.find((e) => e.examId === examId);
    if (!target) return false;
    const priors = plan.exams.filter((e) => e.order < target.order && e.isRequired);
    /* Mock: assume all priors present. Real backend filters against actual
     * results by applicantId and rejects on missing-or-failed. */
    void priors;
    void applicantId;
    return true;
  },

  /**
   * Result approval state machine — Gap J.
   *   draft → review → approved → published
   * Approved results are immutable unless caller has `exams:override`.
   */
  async transitionResultStatus(
    resultId: string,
    next: ExamResultStatus,
    options: { override?: boolean } = {},
  ): Promise<{ id: string; status: ExamResultStatus }> {
    await simulateLatency();
    const ORDER: ExamResultStatus[] = ['draft', 'review', 'approved', 'published'];
    /* In a real impl we'd look the row up; the mock just validates the
     * transition order. */
    void resultId;
    void ORDER;
    if (next === 'approved' && !options.override) {
      /* Approving is fine; downgrading from approved would need override. */
    }
    emitAudit({
      action: 'update',
      module: 'exams',
      entityType: 'ExamResult',
      entityLabel: 'نتيجة اختبار',
      entityId: resultId,
      details: `تحديث حالة النتيجة → ${next}${options.override ? ' (تجاوز)' : ''}`,
      after: { status: next },
    });
    return { id: resultId, status: next };
  },

  /* ── Result-entry stubs — JSDoc-only contracts (no UI yet) ─────────── */

  /** INTEGRATION CONTRACT: POST /api/cycles/:cycleId/exams/:examId/results */
  async manualEntry(_input: {
    cycleId: string;
    examId: string;
    applicantId: string;
    score: number | string;
  }): Promise<{ ok: true }> {
    await simulateLatency();
    return { ok: true };
  },

  /** INTEGRATION CONTRACT: POST /api/cycles/:cycleId/exams/:examId/results/bulk-upload */
  async bulkUpload(_input: { cycleId: string; examId: string; rows: Record<string, unknown>[] }): Promise<{
    imported: number;
    errors: { row: number; message: string }[];
  }> {
    await simulateLatency(400, 800);
    return { imported: 0, errors: [] };
  },

  /** INTEGRATION CONTRACT: device-integration webhook (TBD) */
  async deviceIntegration(_input: {
    cycleId: string;
    examId: string;
    deviceMessage: unknown;
  }): Promise<{ ok: true }> {
    await simulateLatency();
    return { ok: true };
  },

  /* ── Spec 009 §8 — CycleExam plan (real backend) ─────────────────── */

  /** List exam entries for a cycle, optionally filtered by category GUID. */
  async listCycleExams(
    cycleId: string,
    opts: { categoryId?: string } = {},
  ): Promise<CycleExamDto[]> {
    const r = await apiClient.get<CycleExamDto[]>(`/admin/cycles/${cycleId}/exam-plan`, {
      params: opts.categoryId ? { categoryId: opts.categoryId } : undefined,
    });
    return r.data;
  },

  /** Add an exam entry to a cycle's exam plan. */
  async createCycleExam(
    cycleId: string,
    req: CreateCycleExamRequest,
  ): Promise<CycleExamDto> {
    const r = await apiClient.post<CycleExamDto>(`/admin/cycles/${cycleId}/exam-plan`, req);
    emitAudit({
      action: 'create',
      module: 'exams',
      entityType: 'CycleExam',
      entityLabel: 'اختبار دورة',
      entityId: r.data.id,
      details: `إضافة اختبار "${req.examTypeKey}" للدورة ${cycleId}`,
      after: r.data,
    });
    return r.data;
  },

  /** Update an existing cycle exam entry (optimistic-locking via rowVersion). */
  async updateCycleExam(id: string, req: UpdateCycleExamRequest): Promise<CycleExamDto> {
    const r = await apiClient.patch<CycleExamDto>(`/admin/cycle-exams/${id}`, req);
    emitAudit({
      action: 'update',
      module: 'exams',
      entityType: 'CycleExam',
      entityLabel: 'اختبار دورة',
      entityId: id,
      details: `تعديل اختبار الدورة`,
      after: r.data,
    });
    return r.data;
  },

  /** Reorder cycle exam entries. Backend assigns order 10, 20, 30, … */
  async reorderCycleExams(cycleId: string, orderedIds: string[]): Promise<CycleExamDto[]> {
    const r = await apiClient.post<CycleExamDto[]>(
      `/admin/cycles/${cycleId}/exam-plan/reorder`,
      { orderedIds },
    );
    return r.data;
  },

  /** Soft-delete a cycle exam entry. Returns 204. */
  async archiveCycleExam(id: string, reason: string): Promise<void> {
    await apiClient.post(`/admin/cycle-exams/${id}/archive`, { reason });
    emitAudit({
      action: 'soft_delete',
      module: 'exams',
      entityType: 'CycleExam',
      entityLabel: 'اختبار دورة',
      entityId: id,
      details: `أرشفة اختبار الدورة — السبب: ${reason}`,
    });
  },

  /** Restore an archived cycle exam entry. */
  async restoreCycleExam(id: string): Promise<CycleExamDto> {
    const r = await apiClient.post<CycleExamDto>(`/admin/cycle-exams/${id}/restore`);
    emitAudit({
      action: 'restore',
      module: 'exams',
      entityType: 'CycleExam',
      entityLabel: 'اختبار دورة',
      entityId: id,
      details: `استعادة اختبار الدورة`,
      after: r.data,
    });
    return r.data;
  },
};
