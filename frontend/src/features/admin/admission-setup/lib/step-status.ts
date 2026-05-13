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
  ExamScheduleDay,
} from '../types';

/**
 * Aggregated exam-schedule snapshot consumed by the step-status check.
 * Built from the union of all active-category day lists for the cycle.
 */
export interface ExamScheduleSnapshot {
  /** Each active category's WORKING-day count. Step is complete when
   *  every entry is > 0. */
  workingDaysByCategory: Record<string, number>;
  /** Ids of active categories — defines the universe of required
   *  WORKING-day buckets. */
  activeCategoryIds: string[];
  /** Total day rows across all categories — `> 0` means the step
   *  has been touched. */
  totalDays: number;
}

/**
 * Aggregated committee-binding snapshot consumed by the step-status check.
 *
 * The committees step is complete when both:
 *   1. roster — every active category has ≥1 row in `CategoryCommittees`
 *   2. bindings — every active category has ≥1 active `CommitteeDayBinding`
 * Either dimension empty for any active category → `in_progress`.
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
  examSchedule: ExamScheduleSnapshot | null;
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

/**
 * Build an `ExamScheduleSnapshot` from a flat list of days + the active
 * category ids resolved at call-site. Pure helper — no react state.
 */
export function buildExamScheduleSnapshot(
  days: ExamScheduleDay[],
  activeCategoryIds: string[],
): ExamScheduleSnapshot {
  const workingDaysByCategory: Record<string, number> = {};
  for (const id of activeCategoryIds) workingDaysByCategory[id] = 0;
  for (const day of days) {
    if (day.kind !== 'WORKING') continue;
    if (workingDaysByCategory[day.applicantCategoryId] === undefined) continue;
    workingDaysByCategory[day.applicantCategoryId] =
      (workingDaysByCategory[day.applicantCategoryId] ?? 0) + 1;
  }
  return {
    workingDaysByCategory,
    activeCategoryIds,
    totalDays: days.length,
  };
}

export function computeStepStatus(
  key: AdmissionSetupStepKey,
  inputs: StepStatusInputs,
): AdmissionSetupStepStatus {
  const { cycle, categories, committees, examSchedule, declaration } = inputs;

  if (!cycle) return 'not_started';

  switch (key) {
    case 'application_settings': {
      const openCount = Object.values(cycle.openCategories ?? {}).filter((c) => c?.isOpen).length;
      if (openCount === 0) return 'not_started';
      return openCount > 0 ? 'complete' : 'in_progress';
    }
    case 'application_status':
      return cycle.status === 'active' || cycle.status === 'extended' || cycle.status === 'open'
        ? 'complete'
        : cycle.status === 'draft'
          ? 'not_started'
          : 'in_progress';
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
      const rosterTouched = snap.activeCategoryIds.some(
        (id) => (snap.rosterByCategory[id] ?? 0) > 0,
      );
      const bindingsTouched = snap.activeCategoryIds.some(
        (id) => (snap.activeBindingsByCategory[id] ?? 0) > 0,
      );
      if (!rosterTouched && !bindingsTouched) return 'not_started';
      const rosterComplete = snap.activeCategoryIds.every(
        (id) => (snap.rosterByCategory[id] ?? 0) > 0,
      );
      const bindingsComplete = snap.activeCategoryIds.every(
        (id) => (snap.activeBindingsByCategory[id] ?? 0) > 0,
      );
      return rosterComplete && bindingsComplete ? 'complete' : 'in_progress';
    }
    case 'exam_dates': {
      if (!examSchedule) return 'not_started';
      if (examSchedule.activeCategoryIds.length === 0) {
        /* No active categories means step 1 is incomplete — surface this
         * step as not_started so the user is sent back upstream. */
        return 'not_started';
      }
      if (examSchedule.totalDays === 0) return 'not_started';
      const allComplete = examSchedule.activeCategoryIds.every(
        (id) => (examSchedule.workingDaysByCategory[id] ?? 0) > 0,
      );
      return allComplete ? 'complete' : 'in_progress';
    }
    case 'notifications':
      /* Notifications are global — surface as in_progress; the actual page
       * shows the count and lets the admin add cycle-scoped messages. */
      return 'in_progress';
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
