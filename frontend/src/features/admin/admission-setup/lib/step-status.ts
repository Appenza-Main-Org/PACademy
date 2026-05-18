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

/**
 * Aggregated committee-binding snapshot consumed by the step-status check.
 *
 * The committees step is complete once the admin has authored at least one
 * active `CommitteeDayBinding` for any active category — once dates are
 * picked the admin has done the meaningful work of this step. Earlier
 * rules required every active category to carry both roster + bindings,
 * which left the step pinned at `in_progress` whenever the admin only
 * cared about a subset of categories.
 *
 *   • complete    — ≥1 active binding exists for any active category
 *   • in_progress — roster rows exist but no bindings yet
 *   • not_started — neither dimension touched
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
  const { cycle, categories, committees, declaration } = inputs;

  if (!cycle) return 'not_started';

  switch (key) {
    case 'application_settings': {
      const openCount = Object.values(cycle.openCategories ?? {}).filter((c) => c?.isOpen).length;
      if (openCount === 0) return 'not_started';
      return openCount > 0 ? 'complete' : 'in_progress';
    }
    case 'application_settings_review': {
      /* Read-only checkpoint — derives its status from the upstream
       * authoring step so the stepper doesn't show «لم يبدأ» on a step
       * that has nothing to start. */
      const openCount = Object.values(cycle.openCategories ?? {}).filter((c) => c?.isOpen).length;
      return openCount > 0 ? 'complete' : 'not_started';
    }
    case 'fees': {
      const fee = cycle.fees?.applicationFee ?? 0;
      const fawry = cycle.fees?.fawryConfig?.merchantCode ?? '';
      if (fee > 0 && fawry) return 'complete';
      if (fee > 0 || fawry) return 'in_progress';
      return 'not_started';
    }
    case 'exams': {
      const openKeys = openCategoryKeys(cycle);
      if (openKeys.length === 0) return 'not_started';
      const anyHasExams = openKeys.some((k) => {
        const cat = categories.find((c) => c.key === k);
        return (cat?.requiredTests?.length ?? 0) > 0;
      });
      return anyHasExams ? 'complete' : 'in_progress';
    }
    case 'committees': {
      const snap = inputs.committeeBindings;
      if (!snap) {
        /* Back-compat path — callers that haven't wired the binding
         * snapshot fall back to the legacy "any committee exists" rule. */
        const cycleCommittees = committees.filter(
          (c) => !c.linkedCycleId || c.linkedCycleId === cycle.id,
        );
        return cycleCommittees.length > 0 ? 'complete' : 'not_started';
      }
      if (snap.activeCategoryIds.length === 0) return 'not_started';
      const anyRoster = snap.activeCategoryIds.some(
        (id) => (snap.rosterByCategory[id] ?? 0) > 0,
      );
      const anyBindings = snap.activeCategoryIds.some(
        (id) => (snap.activeBindingsByCategory[id] ?? 0) > 0,
      );
      if (anyBindings) return 'complete';
      if (anyRoster) return 'in_progress';
      return 'not_started';
    }
    case 'electronic_declaration':
      if (!declaration) return 'not_started';
      return declaration.publishedAt ? 'complete' : 'in_progress';
  }
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
