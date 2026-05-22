/**
 * Exam Schedule — per-category calendar service.
 */

import { apiClient } from '@/shared/lib/api-client';
import type { DayKind, ExamScheduleDay } from '../types';

export const examScheduleService = {
  async listDays(
    cycleId: string,
    applicantCategoryId?: string,
  ): Promise<ExamScheduleDay[]> {
    return apiClient.get(`/api/admin/exam-schedule/cycles/${encodeURIComponent(cycleId)}`, {
      query: { categoryId: applicantCategoryId },
    });
  },

  async aggregateForCycle(cycleId: string): Promise<{
    activeCategoryIds: string[];
    days: ExamScheduleDay[];
  }> {
    return apiClient.get(`/api/admin/exam-schedule/cycles/${encodeURIComponent(cycleId)}/aggregate`);
  },

  async generateBulk(input: {
    cycleId: string;
    applicantCategoryId: string;
    startDate: string;
    endDate: string;
    note?: string | null;
  }): Promise<{ created: ExamScheduleDay[]; skippedExistingDates: string[] }> {
    return apiClient.post(`/api/admin/exam-schedule/cycles/${encodeURIComponent(input.cycleId)}/generate`, input);
  },

  async addDay(
    cycleId: string,
    applicantCategoryId: string,
    input: { date: string; kind: DayKind; note?: string | null },
  ): Promise<ExamScheduleDay> {
    return apiClient.post(`/api/admin/exam-schedule/cycles/${encodeURIComponent(cycleId)}/days`, {
      applicantCategoryId,
      ...input,
    });
  },

  async updateDay(
    dayId: string,
    patch: Partial<Pick<ExamScheduleDay, 'date' | 'kind' | 'note'>>,
  ): Promise<ExamScheduleDay> {
    return apiClient.patch(`/api/admin/exam-schedule/days/${encodeURIComponent(dayId)}`, patch);
  },

  async deleteDay(dayId: string): Promise<void> {
    await apiClient.delete(`/api/admin/exam-schedule/days/${encodeURIComponent(dayId)}`);
  },

  async toggleOff(dayId: string): Promise<ExamScheduleDay> {
    return apiClient.post(`/api/admin/exam-schedule/days/${encodeURIComponent(dayId)}/toggle-off`);
  },

  async clearRange(
    cycleId: string,
    applicantCategoryId: string,
    startDate: string,
    endDate: string,
  ): Promise<{ deleted: number }> {
    return apiClient.post(`/api/admin/exam-schedule/cycles/${encodeURIComponent(cycleId)}/clear-range`, {
      applicantCategoryId,
      startDate,
      endDate,
    });
  },

  async copyFromCategory(input: {
    cycleId: string;
    sourceCategoryId: string;
    targetCategoryId: string;
    overwrite: boolean;
  }): Promise<{ created: number; skipped: number }> {
    return apiClient.post(
      `/api/admin/exam-schedule/cycles/${encodeURIComponent(input.cycleId)}/copy-from-category`,
      input,
    );
  },
};
