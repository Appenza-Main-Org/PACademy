/**
 * Admission Setup API Service — net-new entities for the wizard.
 *
 * Composed steps (application_settings, fees,
 * exams, committees) reuse `cyclesService`, `categoriesService`,
 * `committeeService`, and `examPlansService` directly; this service
 * only owns the shapes defined in `../types.ts` that have no admin-gaps
 * home today.
 *
 * INTEGRATION CONTRACT:
 *   §1  CommitteeMergeSplitRules   /admin/admission-setup/cycles/{cycleId}/merge-split-rules
 *   §2  CommitteeScoreThresholds   /admin/admission-setup/cycles/{cycleId}/score-thresholds
 *   §3  ExamDateConfig             /admin/admission-setup/cycles/{cycleId}/exam-dates
 *   §4  TotalScoreConfig           /admin/admission-setup/cycles/{cycleId}/total-score
 *   §5  ElectronicDeclaration      /admin/admission-setup/cycles/{cycleId}/declaration
 *   §6  WizardStepStatus           /admin/admission-setup/cycles/{cycleId}/step-statuses
 *   §10 CommitteeBindings          /admin/admission-setup/cycles/{cycleId}/committee-bindings
 */

import { apiClient } from '@/shared/api/client';
import { RowVersionConflictError } from '@/shared/api/errors';
import type { ApplicantCategoryKey, CategoryCommittees } from '@/shared/types/domain';
import type {
  ApplyMergeSplitRuleResult,
  CommitteeMergeSplitRule,
  CommitteeScoreThresholdRow,
  CycleCloneSummaryDto,
  DeclarationDocument,
  ElectronicDeclaration,
  ExamDateConfig,
  MergeSplitPreviewDto,
  TotalScoreComponent,
  TotalScoreConfig,
  WizardStepStatusRow,
} from '../types';

function isConflict(err: unknown): err is RowVersionConflictError {
  return err instanceof RowVersionConflictError;
}

function rethrowConflict(err: unknown): never {
  if (isConflict(err)) throw err;
  throw err;
}

export const admissionSetupService = {
  /* ── §3 Exam date config ──────────────────────────────────────────── */
  async getExamDateConfig(cycleId: string): Promise<ExamDateConfig | null> {
    const { data } = await apiClient.get<ExamDateConfig | null>(
      `/admin/admission-setup/cycles/${cycleId}/exam-dates`,
    );
    return data;
  },

  async setExamDateConfig(input: {
    cycleId: string;
    firstAvailableDate: string;
    bookableDays: string[];
    blackoutDates: string[];
    rowVersion?: string;
  }): Promise<ExamDateConfig> {
    const { cycleId, ...body } = input;
    try {
      const { data } = await apiClient.put<ExamDateConfig>(
        `/admin/admission-setup/cycles/${cycleId}/exam-dates`,
        body,
      );
      return data;
    } catch (err) {
      return rethrowConflict(err);
    }
  },

  /* ── §5 Electronic declaration ────────────────────────────────────── */
  async getDeclaration(cycleId: string): Promise<ElectronicDeclaration | null> {
    const { data } = await apiClient.get<ElectronicDeclaration | null>(
      `/admin/admission-setup/cycles/${cycleId}/declaration`,
    );
    return data;
  },

  /**
   * Uploads a PDF for the declaration. The backend writes the file under
   * wwwroot/uploads/declarations/{cycleId}/{guid}.pdf and returns the
   * relative URL the caller stores on the declaration record via
   * setDeclaration / updateDeclaration.
   */
  async uploadDeclarationDocument(
    cycleId: string,
    file: File,
  ): Promise<{ fileName: string; fileUrl: string; size: number }> {
    const form = new FormData();
    form.append('file', file, file.name);
    const { data } = await apiClient.post<{ fileName: string; fileUrl: string; size: number }>(
      `/admin/admission-setup/cycles/${cycleId}/declaration/upload`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  },

  async listDeclarationVersions(cycleId: string): Promise<ElectronicDeclaration[]> {
    const { data } = await apiClient.get<ElectronicDeclaration[]>(
      `/admin/admission-setup/cycles/${cycleId}/declaration/versions`,
    );
    return data;
  },

  async setDeclaration(input: {
    cycleId: string;
    mode: 'text' | 'pdf';
    bodyAr?: string;
    document?: DeclarationDocument | null;
    effectiveFrom: string;
  }): Promise<ElectronicDeclaration> {
    const { cycleId, ...body } = input;
    try {
      const { data } = await apiClient.post<ElectronicDeclaration>(
        `/admin/admission-setup/cycles/${cycleId}/declaration`,
        body,
      );
      return data;
    } catch (err) {
      return rethrowConflict(err);
    }
  },

  async updateDeclaration(input: {
    id: string;
    rowVersion: string;
    bodyAr?: string;
    effectiveFrom?: string;
  }): Promise<ElectronicDeclaration> {
    const { id, ...body } = input;
    try {
      const { data } = await apiClient.patch<ElectronicDeclaration>(
        `/admin/admission-setup/declaration/${id}`,
        body,
      );
      return data;
    } catch (err) {
      return rethrowConflict(err);
    }
  },

  async publishDeclaration(declarationId: string, rowVersion: string): Promise<ElectronicDeclaration> {
    try {
      const { data } = await apiClient.post<ElectronicDeclaration>(
        `/admin/admission-setup/declaration/${declarationId}/publish`,
        { rowVersion },
      );
      return data;
    } catch (err) {
      return rethrowConflict(err);
    }
  },

  async archiveDeclaration(declarationId: string, reason: string): Promise<void> {
    await apiClient.post(
      `/admin/admission-setup/declaration/${declarationId}/archive`,
      { reason },
    );
  },

  /* ── §1 Committee merge/split rules ───────────────────────────────── */
  async listMergeSplitRules(
    cycleId: string,
    options?: { status?: string; includeArchived?: boolean },
  ): Promise<CommitteeMergeSplitRule[]> {
    const { data } = await apiClient.get<CommitteeMergeSplitRule[]>(
      `/admin/admission-setup/cycles/${cycleId}/merge-split-rules`,
      { params: options },
    );
    return data;
  },

  async getMergeSplitRule(id: string): Promise<CommitteeMergeSplitRule> {
    const { data } = await apiClient.get<CommitteeMergeSplitRule>(
      `/admin/admission-setup/merge-split-rules/${id}`,
    );
    return data;
  },

  async createMergeSplitRule(input: {
    cycleId: string;
    type: 'merge' | 'split';
    sourceCommitteeIds: string[];
    targetCommitteeIds: string[];
    reason?: string;
    effectiveAt: string;
  }): Promise<CommitteeMergeSplitRule> {
    const { cycleId, ...body } = input;
    const { data } = await apiClient.post<CommitteeMergeSplitRule>(
      `/admin/admission-setup/cycles/${cycleId}/merge-split-rules`,
      body,
    );
    return data;
  },

  async updateMergeSplitRule(input: {
    id: string;
    rowVersion: string;
    type?: 'merge' | 'split';
    sourceCommitteeIds?: string[];
    targetCommitteeIds?: string[];
    reason?: string;
    effectiveAt?: string;
  }): Promise<CommitteeMergeSplitRule> {
    const { id, ...body } = input;
    try {
      const { data } = await apiClient.patch<CommitteeMergeSplitRule>(
        `/admin/admission-setup/merge-split-rules/${id}`,
        body,
      );
      return data;
    } catch (err) {
      return rethrowConflict(err);
    }
  },

  async cancelMergeSplitRule(input: {
    id: string;
    rowVersion: string;
    reason?: string;
  }): Promise<CommitteeMergeSplitRule> {
    const { id, ...body } = input;
    try {
      const { data } = await apiClient.post<CommitteeMergeSplitRule>(
        `/admin/admission-setup/merge-split-rules/${id}/cancel`,
        body,
      );
      return data;
    } catch (err) {
      return rethrowConflict(err);
    }
  },

  async previewMergeSplitRule(id: string): Promise<MergeSplitPreviewDto> {
    const { data } = await apiClient.post<MergeSplitPreviewDto>(
      `/admin/admission-setup/merge-split-rules/${id}/preview`,
    );
    return data;
  },

  async applyMergeSplitRule(input: {
    id: string;
    confirmPreviewHash: string;
    rowVersion: string;
  }): Promise<ApplyMergeSplitRuleResult> {
    const { id, ...body } = input;
    try {
      const { data } = await apiClient.post<ApplyMergeSplitRuleResult>(
        `/admin/admission-setup/merge-split-rules/${id}/apply`,
        body,
      );
      return data;
    } catch (err) {
      return rethrowConflict(err);
    }
  },

  async archiveMergeSplitRule(input: { id: string; reason: string }): Promise<void> {
    await apiClient.post(
      `/admin/admission-setup/merge-split-rules/${input.id}/archive`,
      { reason: input.reason },
    );
  },

  /* ── §2 Committee score thresholds ────────────────────────────────── */
  async listScoreThresholds(cycleId: string): Promise<CommitteeScoreThresholdRow[]> {
    const { data } = await apiClient.get<CommitteeScoreThresholdRow[]>(
      `/admin/admission-setup/cycles/${cycleId}/score-thresholds`,
    );
    return data;
  },

  async getScoreThreshold(
    cycleId: string,
    committeeId: string,
  ): Promise<CommitteeScoreThresholdRow> {
    const { data } = await apiClient.get<CommitteeScoreThresholdRow>(
      `/admin/admission-setup/cycles/${cycleId}/committees/${committeeId}/score-threshold`,
    );
    return data;
  },

  async upsertScoreThreshold(input: {
    cycleId: string;
    committeeId: string;
    min: number;
    max: number;
    rowVersion?: string;
  }): Promise<CommitteeScoreThresholdRow> {
    const { cycleId, committeeId, ...body } = input;
    try {
      const { data } = await apiClient.put<CommitteeScoreThresholdRow>(
        `/admin/admission-setup/cycles/${cycleId}/committees/${committeeId}/score-threshold`,
        body,
      );
      return data;
    } catch (err) {
      return rethrowConflict(err);
    }
  },

  /* ── §4 Total score config ────────────────────────────────────────── */
  async listTotalScoreConfigs(cycleId: string): Promise<TotalScoreConfig[]> {
    const { data } = await apiClient.get<TotalScoreConfig[]>(
      `/admin/admission-setup/cycles/${cycleId}/total-score`,
    );
    return data;
  },

  async getTotalScoreConfig(cycleId: string, stream: string): Promise<TotalScoreConfig> {
    const { data } = await apiClient.get<TotalScoreConfig>(
      `/admin/admission-setup/cycles/${cycleId}/total-score/${stream}`,
    );
    return data;
  },

  async upsertTotalScoreConfig(input: {
    cycleId: string;
    stream: string;
    components: TotalScoreComponent[];
    totalScoreOutOf: number;
    rowVersion?: string;
  }): Promise<TotalScoreConfig> {
    const { cycleId, stream, ...body } = input;
    try {
      const { data } = await apiClient.put<TotalScoreConfig>(
        `/admin/admission-setup/cycles/${cycleId}/total-score/${stream}`,
        body,
      );
      return data;
    } catch (err) {
      return rethrowConflict(err);
    }
  },

  /* ── §6 Wizard step status ────────────────────────────────────────── */
  async getWizardStepStatuses(cycleId: string): Promise<WizardStepStatusRow[]> {
    const { data } = await apiClient.get<WizardStepStatusRow[]>(
      `/admin/admission-setup/cycles/${cycleId}/step-statuses`,
    );
    return data;
  },

  async completeWizardStep(cycleId: string, stepKey: string, rowVersion?: string): Promise<WizardStepStatusRow> {
    const { data } = await apiClient.post<WizardStepStatusRow>(
      `/admin/admission-setup/cycles/${cycleId}/steps/${stepKey}/complete`,
      rowVersion ? { rowVersion } : {},
    );
    return data;
  },

  async reopenWizardStep(cycleId: string, stepKey: string, rowVersion: string): Promise<WizardStepStatusRow> {
    try {
      const { data } = await apiClient.post<WizardStepStatusRow>(
        `/admin/admission-setup/cycles/${cycleId}/steps/${stepKey}/reopen`,
        { rowVersion },
      );
      return data;
    } catch (err) {
      return rethrowConflict(err);
    }
  },

  /* ── §10 Committee ↔ category bindings ────────────────────────────── */
  async listCategoryCommittees(cycleId: string): Promise<CategoryCommittees[]> {
    const { data } = await apiClient.get<CategoryCommittees[]>(
      `/admin/admission-setup/cycles/${cycleId}/committee-bindings`,
    );
    return data;
  },

  async listCommitteeBindings(input: {
    cycleId: string;
    categoryId?: ApplicantCategoryKey;
  }): Promise<CategoryCommittees[]> {
    const { data } = await apiClient.get<CategoryCommittees[]>(
      `/admin/admission-setup/cycles/${input.cycleId}/committee-bindings`,
      { params: input.categoryId ? { categoryId: input.categoryId } : undefined },
    );
    return data;
  },

  async setCommitteeBindings(input: {
    cycleId: string;
    academicYearId: string;
    categoryId?: ApplicantCategoryKey;
    committeeIds: string[];
    actorUserId?: string;
  }): Promise<CategoryCommittees[]> {
    const url = input.categoryId
      ? `/admin/admission-setup/cycles/${input.cycleId}/categories/${input.categoryId}/committees`
      : `/admin/admission-setup/cycles/${input.cycleId}/committee-bindings`;
    const { data } = await apiClient.put<CategoryCommittees[]>(url, {
      committeeIds: input.committeeIds,
      academicYearId: input.academicYearId,
    });
    return data;
  },

  /* ── §7 Cross-cycle clone (P4) ────────────────────────────────────── */
  async cloneCycleWizard(input: {
    targetCycleId: string;
    sourceCycleId: string;
    confirmReplace?: boolean;
  }): Promise<CycleCloneSummaryDto> {
    const { data } = await apiClient.post<CycleCloneSummaryDto>(
      `/admin/cycles/${input.targetCycleId}/copy-from/${input.sourceCycleId}`,
      { confirmReplace: input.confirmReplace },
    );
    return data;
  },
};
