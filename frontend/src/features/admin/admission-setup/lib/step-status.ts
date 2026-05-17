/**
 * Per-step status helpers — surface the index-page status pill.
 *
 * `useStepStatuses(cycleId)` is the primary hook; it reads from the server's
 * `GET /admin/admission-setup/cycles/{cycleId}/step-statuses` endpoint and
 * maps the 13-row response to the 6 frontend `AdmissionSetupStepKey` values.
 *
 * `computeStepStatus` is preserved for pages that still derive status from
 * local query data (e.g. before the server round-trip completes).
 */

import { useMemo } from 'react';
import type { AdmissionCycle, ApplicantCategory, Committee } from '@/shared/types/domain';
import type {
  AdmissionSetupStepKey,
  AdmissionSetupStepStatus,
  CommitteeDayBinding,
  ElectronicDeclaration,
} from '../types';
import { useWizardStepStatuses } from '../api/admission-setup.queries';

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
    case 'application_settings_review':
      /* Pure review surface — its status mirrors the step it reviews. */
      return computeStepStatus('application_settings', inputs);
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
    case 'date_committee_binding':
      /* Bindings are optional overrides — surface as in_progress once the
       * committees step has any committees; complete when any binding exists. */
      return committees.some((c) => !c.linkedCycleId || c.linkedCycleId === cycle.id)
        ? 'in_progress'
        : 'not_started';
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

/* ─────────────────────────────────────────────────────────────────────────
 * Server-authoritative step status hook
 * ───────────────────────────────────────────────────────────────────────── */

/**
 * useStepStatuses — maps the server's WizardStepStatusRow[] to the 6
 * AdmissionSetupStepKey values shown on the index page.
 *
 * Aggregation rules:
 *   committees       ← aggregated(committees + committee_bindings)
 *   electronic_declaration, exams, notifications ← direct server key match
 *   application_settings, fees ← spec 011 owns these; falls back to 'not_started'
 *   merge_split_rules / score_thresholds / exam_date_config / total_score_config
 *     are tracked server-side but have no dedicated index-page pill; ignored here.
 */
export function useStepStatuses(cycleId: string | null): {
  statuses: Record<AdmissionSetupStepKey, AdmissionSetupStepStatus>;
  isLoading: boolean;
} {
  const { data: rows, isLoading } = useWizardStepStatuses(cycleId);

  const statuses = useMemo((): Record<AdmissionSetupStepKey, AdmissionSetupStepStatus> => {
    const byKey: Record<string, AdmissionSetupStepStatus> = {};
    for (const row of rows ?? []) {
      byKey[row.stepKey] = row.status as AdmissionSetupStepStatus;
    }

    const pick = (key: string): AdmissionSetupStepStatus =>
      byKey[key] ?? 'not_started';

    /** A step is complete only when ALL its server sub-keys are complete. */
    const agg = (keys: string[]): AdmissionSetupStepStatus => {
      const ss = keys.map(pick);
      if (ss.every((s) => s === 'complete')) return 'complete';
      if (ss.every((s) => s === 'not_started')) return 'not_started';
      return 'in_progress';
    };

    return {
      application_settings: pick('application_settings'),
      /* Review surface mirrors the step it reviews — server doesn't track it. */
      application_settings_review: pick('application_settings'),
      fees: pick('fees'),
      exams: pick('exams'),
      committees: agg(['committees', 'committee_bindings']),
      date_committee_binding: pick('date_committee_binding'),
      electronic_declaration: pick('electronic_declaration'),
    };
  }, [rows]);

  return { statuses, isLoading };
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
