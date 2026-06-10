/**
 * Per-step status checkers — surface the index-page status pill.
 *
 * Status semantics:
 *   • complete    — every required setting for this step is filled in for
 *                   the picked cycle.
 *   • in_progress — the step has been touched (some settings present) but
 *                   not all required pieces are filled.
 *   • not_started — nothing exists yet for the picked cycle.
 */

import type { AdmissionCycle, ApplicantCategory, Committee } from '@/shared/types/domain';
import type {
  AdmissionSetupStepKey,
  AdmissionSetupStepStatus,
  CommitteeDayBinding,
  ElectronicDeclaration,
} from '../types';
import {
  findCategoriesMissingExams,
  findCategoriesWithInvalidExamOrders,
  hasPendingExamPlanDrafts,
  type ExamPlanStepDraftState,
} from './exam-plan-step';

/**
 * Aggregated committee-binding snapshot consumed by the step-status check.
 *
 * The committees step is complete once the admin has authored any data —
 * either roster rows or active day-bindings — for any active category.
 * Earlier rules required every active category to carry both dimensions,
 * which left the step pinned at `in_progress` even after admins added
 * everything they cared about. The looser rule trusts the admin's intent:
 * once they've added committee data, the step is done.
 *
 *   • complete    — ≥1 roster row OR ≥1 active binding for any active category
 *   • not_started — neither dimension touched
 *
 * `in_progress` no longer fires here; the step is binary so the cycle
 * approval gate can flip on once data exists.
 */
export interface CommitteeBindingsSnapshot {
  /** Per-active-category roster count (from `CategoryCommittees`). */
  rosterByCategory: Record<string, number>;
  /** Per-active-category active-binding count. */
  activeBindingsByCategory: Record<string, number>;
  /** Universe of required category buckets (= active categories). */
  activeCategoryIds: string[];
}

export interface StepStatusInputs {
  cycle: AdmissionCycle | null;
  categories: ApplicantCategory[];
  committees: Committee[];
  declaration: ElectronicDeclaration | null;
  committeeBindings?: CommitteeBindingsSnapshot | null;
  applicationSettingsStatus?: AdmissionSetupStepStatus;
  examPlanDraftState?: ExamPlanStepDraftState | null;
}

export function buildCommitteeBindingsSnapshot(
  rosterRows: Array<{ cycleId: string; categoryId: string }>,
  bindings: CommitteeDayBinding[],
  cycleId: string,
  activeCategoryIds: string[],
): CommitteeBindingsSnapshot {
  const rosterByCategory: Record<string, number> = {};
  const activeBindingsByCategory: Record<string, number> = {};
  for (const id of activeCategoryIds) {
    rosterByCategory[id] = 0;
    activeBindingsByCategory[id] = 0;
  }
  for (const row of rosterRows) {
    if (row.cycleId !== cycleId) continue;
    if (rosterByCategory[row.categoryId] === undefined) continue;
    rosterByCategory[row.categoryId] = (rosterByCategory[row.categoryId] ?? 0) + 1;
  }
  for (const b of bindings) {
    if (b.cycleId !== cycleId) continue;
    if (!b.isActive) continue;
    if (activeBindingsByCategory[b.applicantCategoryId] === undefined) continue;
    activeBindingsByCategory[b.applicantCategoryId] =
      (activeBindingsByCategory[b.applicantCategoryId] ?? 0) + 1;
  }
  return { rosterByCategory, activeBindingsByCategory, activeCategoryIds };
}

export function computeStepStatus(
  key: AdmissionSetupStepKey,
  inputs: StepStatusInputs,
): AdmissionSetupStepStatus {
  const { cycle, categories, declaration } = inputs;

  if (!cycle) return 'not_started';

  switch (key) {
    case 'application_settings':
      return inputs.applicationSettingsStatus ?? legacyApplicationSettingsStatus(cycle);
    case 'application_settings_review': {
      /* Read-only checkpoint — derives its status from the upstream
       * authoring step so the stepper doesn't show «لم يبدأ» on a step
       * that has nothing to start. */
      return inputs.applicationSettingsStatus ?? legacyApplicationSettingsStatus(cycle);
    }
    case 'fees': {
      const fee = cycle.fees?.applicationFee ?? 0;
      if (fee > 0) return 'complete';
      return 'not_started';
    }
    case 'exams': {
      if (inputs.examPlanDraftState) {
        const { activeCategories, draftsByCategory } = inputs.examPlanDraftState;
        if (activeCategories.length === 0) return 'not_started';
        if (hasPendingExamPlanDrafts(inputs.examPlanDraftState)) return 'in_progress';
        const missing = findCategoriesMissingExams(activeCategories, draftsByCategory);
        const invalidOrders = findCategoriesWithInvalidExamOrders(activeCategories, draftsByCategory);
        if (missing.length === 0 && invalidOrders.length === 0) return 'complete';
        const anyTouched = activeCategories.some(
          (category) => (draftsByCategory[category.key]?.entries.length ?? 0) > 0,
        );
        return anyTouched ? 'in_progress' : 'not_started';
      }

      const openKeys = openCategoryKeys(cycle);
      if (openKeys.length === 0) return 'not_started';
      const anyHasExams = openKeys.some((k) => {
        const cat = categories.find((c) => c.key === k);
        return (cat?.requiredTests?.length ?? 0) > 0;
      });
      return anyHasExams ? 'complete' : 'in_progress';
    }
    case 'electronic_declaration':
      /* A declaration row alone is not enough: legacy/backend records can
       * exist before the admin has authored text or uploaded the PDF that
       * applicants must acknowledge. Authored content is still invisible to
       * applicants until the explicit «نشر» click stamps `publishedAt` —
       * only then is the step truly complete. */
      if (!hasElectronicDeclarationContent(declaration)) return 'not_started';
      return declaration?.publishedAt ? 'complete' : 'in_progress';
  }
}

export function hasElectronicDeclarationContent(
  declaration: ElectronicDeclaration | null | undefined,
): boolean {
  if (!declaration) return false;
  if (declaration.bodyAr?.trim()) return true;
  const doc = declaration.document;
  return Boolean(doc?.fileName?.trim() && doc.fileUrl?.trim());
}

function legacyApplicationSettingsStatus(cycle: AdmissionCycle): AdmissionSetupStepStatus {
  const openCount = Object.values(cycle.openCategories ?? {}).filter((c) => c?.isOpen).length;
  if (openCount === 0) return 'not_started';
  return openCount > 0 ? 'complete' : 'in_progress';
}

function openCategoryKeys(cycle: AdmissionCycle): string[] {
  return Object.entries(cycle.openCategories ?? {})
    .filter(([, v]) => v?.isOpen)
    .map(([k]) => k);
}

export const STEP_STATUS_LABEL: Record<AdmissionSetupStepStatus, string> = {
  complete: 'مكتمل',
  in_progress: 'قيد التطوير',
  not_started: 'لم يبدأ',
};

export const STEP_STATUS_TONE: Record<AdmissionSetupStepStatus, 'success' | 'warning' | 'neutral'> = {
  complete: 'success',
  in_progress: 'warning',
  not_started: 'neutral',
};
