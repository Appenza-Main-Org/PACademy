/**
 * AdmissionSetupShell — layout wrapper for every admission-setup step.
 *
 * Wraps the page content with breadcrumbs + <StepHeader> (cycle context,
 * "الخطوة N من ١٥" badge, optional actions slot). The shell resolves the
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

/** Resolve write capability for the step actions inside child pages. */
export function useAdmissionSetupCanWrite(): boolean {
  const user = useAuthStore((s) => s.user);
  if (!user) return false;
  return hasPermission(user.permissions, 'admission-setup:write');
}
