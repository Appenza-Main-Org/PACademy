/**
 * Exam Plans API — Gap J (admin-gaps).
 *
 * INTEGRATION CONTRACT:
 *   GET  /api/lookups/tests?isActive=true
 *   GET  /api/cycles/:cycleId/exam-plans
 *   GET  /api/cycles/:cycleId/categories/:categoryId/exam-plan
 *   PUT  /api/cycles/:cycleId/categories/:categoryId/exam-plan
 *   POST /api/cycles/:targetCycleId/exam-plans/copy?from=:sourceCycleId
 *   GET  /api/exams/results/can-enter
 *   POST /api/exams/results/:resultId/transition
 *   POST /api/cycles/:cycleId/exams/:examId/results
 *   POST /api/cycles/:cycleId/exams/:examId/results/bulk-upload
 *   POST /api/cycles/:cycleId/exams/:examId/device-callback
 */

import { apiClient } from '@/shared/lib/api-client';
import type {
  AcademyExam,
  ApplicantCategoryKey,
  CycleCategoryExamPlan,
  CycleCategoryExamPlanEntry,
  ExamResultStatus,
} from '@/shared/types/domain';

interface TestLookupRow {
  code: string;
  name: string;
  isActive: boolean;
  order: number;
  required: boolean;
  metadata?: Record<string, unknown>;
}

function metadataString(row: TestLookupRow, key: string): string | undefined {
  const value = row.metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function metadataScoreType(row: TestLookupRow): AcademyExam['scoreType'] {
  const value = metadataString(row, 'scoreType');
  return value === 'numeric' || value === 'qualitative' || value === 'pass_fail'
    ? value
    : 'pass_fail';
}

function toAcademyExam(row: TestLookupRow): AcademyExam {
  return {
    id: row.code,
    key: metadataString(row, 'key') ?? row.code,
    group: metadataString(row, 'group') ?? 'admission',
    nameAr: row.name,
    scoreType: metadataScoreType(row),
    isQualifying: row.required,
  };
}

export const examPlansService = {
  async listExams(): Promise<AcademyExam[]> {
    const rows = await apiClient.get<TestLookupRow[]>('/api/lookups/tests', {
      query: { isActive: true },
    });
    return rows
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(toAcademyExam);
  },

  async listForCycle(cycleId: string): Promise<CycleCategoryExamPlan[]> {
    return apiClient.get(`/api/cycles/${encodeURIComponent(cycleId)}/exam-plans`);
  },

  async getPlan(cycleId: string, categoryId: ApplicantCategoryKey): Promise<CycleCategoryExamPlan> {
    return apiClient.get(
      `/api/cycles/${encodeURIComponent(cycleId)}/categories/${encodeURIComponent(categoryId)}/exam-plan`,
    );
  },

  async savePlan(
    cycleId: string,
    categoryId: ApplicantCategoryKey,
    entries: CycleCategoryExamPlanEntry[],
  ): Promise<CycleCategoryExamPlan> {
    return apiClient.put(
      `/api/cycles/${encodeURIComponent(cycleId)}/categories/${encodeURIComponent(categoryId)}/exam-plan`,
      { exams: entries },
    );
  },

  async copyConfig(input: { fromCycleId: string; toCycleId: string }): Promise<CycleCategoryExamPlan[]> {
    return apiClient.post(
      `/api/cycles/${encodeURIComponent(input.toCycleId)}/exam-plans/copy`,
      undefined,
      { query: { from: input.fromCycleId } },
    );
  },

  async canEnterResult(
    applicantId: string,
    examId: string,
    ctx: { cycleId: string; categoryId: ApplicantCategoryKey },
  ): Promise<boolean> {
    const result = await apiClient.get<{ canEnter: boolean }>('/api/exams/results/can-enter', {
      query: { applicantId, examId, cycleId: ctx.cycleId, categoryId: ctx.categoryId },
    });
    return result.canEnter;
  },

  async transitionResultStatus(
    resultId: string,
    next: ExamResultStatus,
    options: { override?: boolean } = {},
  ): Promise<{ id: string; status: ExamResultStatus }> {
    return apiClient.post(`/api/exams/results/${encodeURIComponent(resultId)}/transition`, {
      status: next,
      ...options,
    });
  },

  async manualEntry(input: {
    cycleId: string;
    examId: string;
    applicantId: string;
    score: number | string;
  }): Promise<{ ok: true }> {
    return apiClient.post(
      `/api/cycles/${encodeURIComponent(input.cycleId)}/exams/${encodeURIComponent(input.examId)}/results`,
      input,
    );
  },

  async bulkUpload(input: { cycleId: string; examId: string; rows: Record<string, unknown>[] }): Promise<{
    imported: number;
    errors: { row: number; message: string }[];
  }> {
    return apiClient.post(
      `/api/cycles/${encodeURIComponent(input.cycleId)}/exams/${encodeURIComponent(input.examId)}/results/bulk-upload`,
      { rows: input.rows },
    );
  },

  async deviceIntegration(input: {
    cycleId: string;
    examId: string;
    deviceMessage: unknown;
  }): Promise<{ ok: true }> {
    return apiClient.post(
      `/api/cycles/${encodeURIComponent(input.cycleId)}/exams/${encodeURIComponent(input.examId)}/device-callback`,
      { deviceMessage: input.deviceMessage },
    );
  },
};
