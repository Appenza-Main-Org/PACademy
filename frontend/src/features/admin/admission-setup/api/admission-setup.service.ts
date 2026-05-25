/**
 * Admission Setup API Contract — net-new entities for the wizard.
 *
 * INTEGRATION CONTRACT:
 *   GET  /api/admission-setup/cycles/:cycleId/exam-dates
 *   PUT  /api/admission-setup/cycles/:cycleId/exam-dates
 *   GET  /api/admission-setup/cycles/:cycleId/declaration
 *   PUT  /api/admission-setup/cycles/:cycleId/declaration
 *   POST /api/admission-setup/declarations/:id/publish
 *   GET  /api/admission-setup/cycles/:cycleId/committee-bindings
 *   PUT  /api/admission-setup/cycles/:cycleId/committee-bindings
 */

import { apiClient } from '@/shared/lib/api-client';
import type { ApplicantCategoryKey, CategoryCommittees } from '@/shared/types/domain';
import type { DeclarationDocument, ElectronicDeclaration, ExamDateConfig } from '../types';

export const admissionSetupService = {
  async getExamDateConfig(cycleId: string): Promise<ExamDateConfig | null> {
    return apiClient.get(`/api/admission-setup/cycles/${encodeURIComponent(cycleId)}/exam-dates`);
  },

  async setExamDateConfig(input: {
    cycleId: string;
    firstAvailableDate: string;
    bookableDays: string[];
    blackoutDates: string[];
  }): Promise<ExamDateConfig> {
    return apiClient.put(
      `/api/admission-setup/cycles/${encodeURIComponent(input.cycleId)}/exam-dates`,
      input,
    );
  },

  async getDeclaration(cycleId: string): Promise<ElectronicDeclaration | null> {
    return apiClient.get(`/api/admission-setup/cycles/${encodeURIComponent(cycleId)}/declaration`);
  },

  async setDeclaration(input: {
    cycleId: string;
    mode: 'text' | 'pdf';
    bodyAr?: string;
    document?: DeclarationDocument | File | null;
    effectiveFrom: string;
  }): Promise<ElectronicDeclaration> {
    if (input.document instanceof File) {
      const form = new FormData();
      form.set('mode', input.mode);
      form.set('effectiveFrom', input.effectiveFrom);
      if (input.bodyAr !== undefined) form.set('bodyAr', input.bodyAr);
      form.set('document', input.document);
      return apiClient.put(
        `/api/admission-setup/cycles/${encodeURIComponent(input.cycleId)}/declaration`,
        form,
      );
    }
    return apiClient.put(
      `/api/admission-setup/cycles/${encodeURIComponent(input.cycleId)}/declaration`,
      input,
    );
  },

  async publishDeclaration(declarationId: string): Promise<ElectronicDeclaration> {
    return apiClient.post(`/api/admission-setup/declarations/${encodeURIComponent(declarationId)}/publish`);
  },

  async listCategoryCommittees(cycleId: string): Promise<CategoryCommittees[]> {
    return apiClient.get(`/api/admission-setup/cycles/${encodeURIComponent(cycleId)}/committee-bindings`);
  },

  async listCommitteeBindings(input: {
    cycleId: string;
    categoryId?: ApplicantCategoryKey;
  }): Promise<CategoryCommittees[]> {
    return apiClient.get(`/api/admission-setup/cycles/${encodeURIComponent(input.cycleId)}/committee-bindings`, {
      query: { categoryId: input.categoryId },
    });
  },

  async setCommitteeBindings(input: {
    cycleId: string;
    academicYearId: string;
    categoryId?: ApplicantCategoryKey;
    committeeIds: string[];
    actorUserId?: string;
  }): Promise<CategoryCommittees[]> {
    return apiClient.put(
      `/api/admission-setup/cycles/${encodeURIComponent(input.cycleId)}/committee-bindings`,
      input,
    );
  },
};
