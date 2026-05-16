/**
 * EmbeddedAdmissionSetupWizard — variant of AdmissionSetupWizardPage
 * suitable for hosting inside a Drawer/Modal from a parent route.
 *
 * Re-uses the same per-step page components as the routed wizard but
 * drives step selection from internal React state instead of router
 * params, so the host can keep its own URL while the admin works through
 * the setup. The /admin/admission-setup route remains the canonical
 * full-page experience; this wrapper exists to surface the same flow
 * inline from /admin/cycles without a navigation hop.
 *
 * Cycle context flows through the shared `useAdmissionSetupCycle` hook —
 * we sync the requested cycle into that context once on mount/change so
 * every step page reads the right cycle without prop drilling.
 */

import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/shared/components';
import { hasPermission, useAuthStore } from '@/features/auth';
import { useCategoriesAdmin } from '@/features/admin/api/categories.queries';
import { useCommittees } from '@/features/committees';
import { ADMISSION_SETUP_STEPS } from '../config';
import {
  VerticalStepper,
  type VerticalStepDescriptor,
  type VerticalStepState,
} from './VerticalStepper';
import { WizardModeProvider } from './WizardModeContext';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';
import {
  buildCommitteeBindingsSnapshot,
  computeStepStatus,
  type StepStatusInputs,
} from '../lib/step-status';
import {
  useCommitteeBindings,
  useElectronicDeclaration,
} from '../api/admission-setup.queries';
import { useExamScheduleAggregate } from '../api/examSchedule.queries';
import { useCycleCommitteeBindings } from '../api/committeeBinding.queries';
import type { AdmissionSetupStepKey } from '../types';
import { ApplicationSettingsPage } from '../pages/ApplicationSettingsPage';
import { FeesPage } from '../pages/FeesPage';
import { ExamsManagementPage } from '../pages/ExamsManagementPage';
import { CommitteesManagementPage } from '../pages/CommitteesManagementPage';
import { DateCommitteeBindingPage } from '../pages/DateCommitteeBindingPage';
import { NotificationsStepPage } from '../pages/NotificationsStepPage';
import { ElectronicDeclarationPage } from '../pages/ElectronicDeclarationPage';

/* Mirrors the renderer map in AdmissionSetupWizardPage. Adding a step
 * means appending to ADMISSION_SETUP_STEPS, the routed wizard renderer
 * map, and this map — three touches that compile-fail if missed because
 * AdmissionSetupStepKey is closed. */
const STEP_RENDERERS: Record<AdmissionSetupStepKey, () => JSX.Element> = {
  application_settings: () => <ApplicationSettingsPage />,
  fees: () => <FeesPage />,
  exams: () => <ExamsManagementPage />,
  committees: () => <CommitteesManagementPage />,
  date_committee_binding: () => <DateCommitteeBindingPage />,
  notifications: () => <NotificationsStepPage />,
  electronic_declaration: () => <ElectronicDeclarationPage />,
};

interface EmbeddedAdmissionSetupWizardProps {
  cycleId: string;
}

export function EmbeddedAdmissionSetupWizard({
  cycleId,
}: EmbeddedAdmissionSetupWizardProps): JSX.Element {
  const cycleCtx = useAdmissionSetupCycle();
  const { cycle, setCycle } = cycleCtx;
  const user = useAuthStore((s) => s.user);
  const canRead = Boolean(user && hasPermission(user.permissions, 'admission-setup:read'));

  /* Sync the embedded cycle into the shared admission-setup context.
   * The guard short-circuits once synced so setCycle's unstable identity
   * never causes a loop — the effect re-runs but the body is a no-op. */
  useEffect(() => {
    if (cycle?.id !== cycleId) setCycle(cycleId);
  }, [cycleId, cycle?.id, setCycle]);

  const orderedSteps = useMemo(
    () => [...ADMISSION_SETUP_STEPS].sort((a, b) => a.order - b.order),
    [],
  );
  const [activeKey, setActiveKey] = useState<AdmissionSetupStepKey>(
    orderedSteps[0]!.key,
  );

  const categoriesQuery = useCategoriesAdmin();
  const committeesQuery = useCommittees();
  const examScheduleAggregateQuery = useExamScheduleAggregate(cycleId);
  const declarationQuery = useElectronicDeclaration(cycleId);
  const rosterQuery = useCommitteeBindings(cycleId, null);
  const cycleBindingsQuery = useCycleCommitteeBindings(cycleId);
  const committeeBindingsSnapshot =
    examScheduleAggregateQuery.data && rosterQuery.data && cycleBindingsQuery.data
      ? buildCommitteeBindingsSnapshot(
          rosterQuery.data,
          cycleBindingsQuery.data,
          cycleId,
          examScheduleAggregateQuery.data.activeCategoryIds,
        )
      : null;

  if (!canRead) {
    return (
      <EmptyState
        variant="generic"
        title="ليس لديك صلاحية الاطلاع على إعدادات التقديم"
      />
    );
  }

  const statusInputs: StepStatusInputs = {
    cycle,
    categories: categoriesQuery.data ?? [],
    committees: committeesQuery.data ?? [],
    declaration: declarationQuery.data ?? null,
    committeeBindings: committeeBindingsSnapshot,
  };

  const stepperItems: VerticalStepDescriptor[] = orderedSteps.map((s) => ({
    key: s.key,
    label: s.labelAr,
    order: s.order,
    state: deriveStepperState(s.key, activeKey, statusInputs),
  }));

  return (
    <WizardModeProvider>
      <div className="flex h-full min-h-0 flex-col gap-3 md:flex-row md:items-stretch">
        <aside
          aria-label="مراحل المعالج"
          className="w-full shrink-0 rounded-md border border-border-subtle bg-surface-card p-3 md:w-[220px] md:overflow-auto"
        >
          <VerticalStepper
            steps={stepperItems}
            activeKey={activeKey}
            onSelect={(k) => setActiveKey(k as AdmissionSetupStepKey)}
          />
        </aside>
        <div className="min-w-0 flex-1 md:overflow-y-auto">
          {STEP_RENDERERS[activeKey]()}
        </div>
      </div>
    </WizardModeProvider>
  );
}

function deriveStepperState(
  key: AdmissionSetupStepKey,
  activeKey: AdmissionSetupStepKey,
  inputs: StepStatusInputs,
): VerticalStepState {
  if (activeKey === key) return 'current';
  const status = computeStepStatus(key, inputs);
  if (status === 'complete') return 'complete';
  if (status === 'in_progress') return 'in_progress';
  return 'upcoming';
}
