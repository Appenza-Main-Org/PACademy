/**
 * Per-step status checkers — surface the index-page status pill.
 *
 * Status semantics:
 *   • complete    — every required setting for this step is filled in for
 *                   the picked cycle.
 *   • in_progress — the step has been touched (some settings present) but
 *                   not all required pieces are filled.
 *   • not_started — nothing exists yet for the picked cycle.
 *
 * Until the net-new services ship in Phase 5, any step whose entity has no
 * mock-side existence reports `not_started`. Composed steps inspect the
 * cycle / category / committee they extend.
 */

import type { AdmissionCycle, ApplicantCategory, Committee } from '@/shared/types/domain';
import type {
  AdmissionSetupStepKey,
  AdmissionSetupStepStatus,
  CommitteeMergeSplitRule,
  ElectronicDeclaration,
  ExamDateConfig,
  TotalScoreConfig,
} from '../types';

export interface StepStatusInputs {
  cycle: AdmissionCycle | null;
  categories: ApplicantCategory[];
  committees: Committee[];
  /** Net-new entities — empty arrays until Phase 5 wires the services. */
  mergeSplitRules: CommitteeMergeSplitRule[];
  examDateConfig: ExamDateConfig | null;
  totalScoreConfigs: TotalScoreConfig[];
  declaration: ElectronicDeclaration | null;
}

export function computeStepStatus(
  key: AdmissionSetupStepKey,
  inputs: StepStatusInputs,
): AdmissionSetupStepStatus {
  const { cycle, categories, committees, mergeSplitRules, examDateConfig, totalScoreConfigs, declaration } = inputs;

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
    case 'age_rules': {
      const openKeys = openCategoryKeys(cycle);
      if (openKeys.length === 0) return 'not_started';
      const allHaveAge = openKeys.every((k) => {
        const cat = categories.find((c) => c.key === k);
        return Boolean(cat?.conditions.ageMin && cat?.conditions.ageMax);
      });
      return allHaveAge ? 'complete' : 'in_progress';
    }
    case 'marital_status_rules': {
      const openKeys = openCategoryKeys(cycle);
      if (openKeys.length === 0) return 'not_started';
      return 'in_progress';
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
      const cycleCommittees = committees.filter((c) => !c.linkedCycleId || c.linkedCycleId === cycle.id);
      return cycleCommittees.length > 0 ? 'complete' : 'not_started';
    }
    case 'committee_merge_split':
      return mergeSplitRules.filter((r) => r.cycleId === cycle.id && !r.deletedAt).length > 0
        ? 'complete'
        : 'not_started';
    case 'score_thresholds': {
      const cycleCommittees = committees.filter((c) => !c.linkedCycleId || c.linkedCycleId === cycle.id);
      if (cycleCommittees.length === 0) return 'not_started';
      const withCriteria = cycleCommittees.filter((c) => c.scoreCriteria?.magmoo3 || c.scoreCriteria?.accumulativeScore);
      if (withCriteria.length === cycleCommittees.length) return 'complete';
      if (withCriteria.length > 0) return 'in_progress';
      return 'not_started';
    }
    case 'exam_dates':
      if (!examDateConfig) return 'not_started';
      return examDateConfig.bookableDays.length > 0 ? 'complete' : 'in_progress';
    case 'date_committee_binding': {
      const cycleCommittees = committees.filter((c) => !c.linkedCycleId || c.linkedCycleId === cycle.id);
      if (cycleCommittees.length === 0) return 'not_started';
      const bound = cycleCommittees.filter(
        (c) => (c.availableDates?.length ?? 0) > 0 && (c.capacityPerDay ?? 0) > 0,
      );
      if (bound.length === cycleCommittees.length) return 'complete';
      if (bound.length > 0) return 'in_progress';
      return 'not_started';
    }
    case 'total_score': {
      const cycleScored = totalScoreConfigs.filter((t) => t.cycleId === cycle.id);
      return cycleScored.length > 0 ? 'complete' : 'not_started';
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
