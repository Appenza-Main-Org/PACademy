/**
 * AdmissionSetupShell — layout wrapper for every admission-setup step.
 *
 * Wraps the page content with breadcrumbs + <StepHeader> (cycle context,
 * "الخطوة N من ١٤" badge, optional actions slot). The shell resolves the
 * current step from `useLocation()` so individual pages don't have to
 * pass it down. Pages render normal content as children.
 *
 * Used by every page under `/admin/admission-setup/*`. Index page passes
 * `step={null}` to suppress the per-step header.
 */

import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { hasPermission, useAuthStore } from '@/features/auth';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';
import { AdmissionSetupBreadcrumbs } from './AdmissionSetupBreadcrumbs';
import { StepHeader } from './StepHeader';
import { getStepByPath } from '../config';
import { useIsInWizardMode } from './WizardModeContext';

interface AdmissionSetupShellProps {
  children: ReactNode;
  /** Optional right-aligned action slot rendered into the StepHeader. */
  headerActions?: ReactNode;
  /** Pages that don't want the auto step header (e.g. the index landing). */
  hideStepHeader?: boolean;
}

export function AdmissionSetupShell({
  children,
  headerActions,
  hideStepHeader,
}: AdmissionSetupShellProps): JSX.Element {
  const { pathname } = useLocation();
  const step = getStepByPath(pathname);
  const cycleCtx = useAdmissionSetupCycle();
  const user = useAuthStore((s) => s.user);
  const canSwitchCycle = user?.role === 'super_admin';
  const inWizard = useIsInWizardMode();

  /* Inside the wizard, the wrapping AdmissionSetupWizardPage already owns
   * the top-stepper, cycle context and per-step header — render content
   * only so we don't duplicate chrome. */
  if (inWizard) {
    return <div className="flex flex-col gap-4">{children}</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <AdmissionSetupBreadcrumbs step={step} />
      {!hideStepHeader && step && (
        <StepHeader
          step={step}
          cycle={cycleCtx.cycle}
          availableCycles={cycleCtx.availableCycles}
          onSelectCycle={(id) => cycleCtx.setCycle(id)}
          canSwitchCycle={canSwitchCycle}
          actions={headerActions}
        />
      )}
      {children}
    </div>
  );
}

/** Resolve write capability for the step actions inside child pages.
 *
 * Two gates, both required:
 *   1. The user holds `admission-setup:write` permission.
 *   2. The currently selected cycle is still in "إدراج ومراجعة" (status === 'draft').
 *      Once a cycle is approved & published (any non-draft status), the
 *      wizard collapses to a view-only surface — admins can walk the steps
 *      but cannot mutate anything. See CyclesPage business rules.
 *
 * If no cycle is selected yet (e.g. first render before sessionStorage
 * resolves), we don't lock the surface — the wizard guards against the
 * "no cycle" case separately via the per-step `<NoCycle />` empty states.
 */
export function useAdmissionSetupCanWrite(): boolean {
  const user = useAuthStore((s) => s.user);
  const { cycle } = useAdmissionSetupCycle();
  if (!user) return false;
  if (!hasPermission(user.permissions, 'admission-setup:write')) return false;
  if (cycle && cycle.status !== 'draft') return false;
  return true;
}

/** True when the active admission-setup cycle is past the draft stage and
 * the wizard should render in view-only mode. */
export function useAdmissionSetupIsReadOnly(): boolean {
  const { cycle } = useAdmissionSetupCycle();
  return Boolean(cycle && cycle.status !== 'draft');
}
