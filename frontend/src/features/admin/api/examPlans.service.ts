/**
 * Exam Plans API — Gap J (admin-gaps).
 *
 * INTEGRATION CONTRACT:
 *   GET  /api/exams/academy
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

export const examPlansService = {
  async listExams(): Promise<AcademyExam[]> {
    return apiClient.get('/api/exams/academy');
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
