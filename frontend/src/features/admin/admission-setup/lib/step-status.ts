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
  ElectronicDeclaration,
  ExamDateConfig,
} from '../types';

export interface StepStatusInputs {
  cycle: AdmissionCycle | null;
  categories: ApplicantCategory[];
  committees: Committee[];
  examDateConfig: ExamDateConfig | null;
  declaration: ElectronicDeclaration | null;
}

export function computeStepStatus(
  key: AdmissionSetupStepKey,
  inputs: StepStatusInputs,
): AdmissionSetupStepStatus {
  const { cycle, categories, committees, examDateConfig, declaration } = inputs;

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
      const cycleCommittees = committees.filter((c) => !c.linkedCycleId || c.linkedCycleId === cycle.id);
      return cycleCommittees.length > 0 ? 'complete' : 'not_started';
    }
    case 'exam_dates':
      if (!examDateConfig) return 'not_started';
      return examDateConfig.bookableDays.length > 0 ? 'complete' : 'in_progress';
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
