/**
 * MarkStepCompleteButton — the admin-explicit "إكمال الخطوة" affordance for
 * every wizard step page. Posts to the spec-009 backend endpoint that flips
 * the wizard_step_statuses row to `complete` (status pill on the index page
 * will reflect this via useWizardStepStatuses).
 *
 * Idempotent: clicking again on a step already marked complete is a no-op
 * server-side (returns the existing row).
 *
 * Reopen behavior: when the step is already complete, the button label
 * switches to "إعادة فتح الخطوة" and clicking calls the reopen endpoint.
 */

import { CheckCircle2, RotateCcw } from 'lucide-react';
import { Button, toast } from '@/shared/components';
import type { AdmissionSetupStepKey } from '../types';
import {
  useCompleteWizardStep,
  useReopenWizardStep,
  useWizardStepStatuses,
} from '../api/admission-setup.queries';

export interface MarkStepCompleteButtonProps {
  cycleId: string;
  stepKey: AdmissionSetupStepKey;
  /** Whether the current user can write. When false the button renders disabled. */
  canWrite: boolean;
}

export function MarkStepCompleteButton({
  cycleId,
  stepKey,
  canWrite,
}: MarkStepCompleteButtonProps): JSX.Element {
  const { data: statuses = [] } = useWizardStepStatuses(cycleId);
  const completeMut = useCompleteWizardStep(cycleId);
  const reopenMut = useReopenWizardStep(cycleId);

  const current = statuses.find((s) => s.stepKey === stepKey);
  const isComplete = current?.status === 'complete';

  const handleClick = (): void => {
    if (!canWrite) return;
    const mut = isComplete ? reopenMut : completeMut;
    mut.mutate(stepKey, {
      onSuccess: () =>
        toast(
          isComplete ? 'تم إعادة فتح الخطوة' : 'تم تحديد الخطوة كمكتملة',
          'success',
        ),
      onError: (err: unknown) =>
        toast((err as { message?: string })?.message ?? 'فشل التحديث', 'danger'),
    });
  };

  const busy = completeMut.isPending || reopenMut.isPending;

  return (
    <Button
      variant={isComplete ? 'secondary' : 'primary'}
      onClick={handleClick}
      disabled={!canWrite || busy}
      isLoading={busy}
    >
      {isComplete ? (
        <>
          <RotateCcw size={14} className="me-1.5" />
          إعادة فتح الخطوة
        </>
      ) : (
        <>
          <CheckCircle2 size={14} className="me-1.5" />
          إكمال الخطوة
        </>
      )}
    </Button>
  );
}
