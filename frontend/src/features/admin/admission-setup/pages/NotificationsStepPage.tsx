import { AdmissionSetupShell } from '../components/AdmissionSetupShell';
import { StepPlaceholder } from '../components/StepPlaceholder';
import { getStepByKey } from '../config';

export function NotificationsStepPage(): JSX.Element {
  return (
    <AdmissionSetupShell>
      <StepPlaceholder step={getStepByKey('notifications')} />
    </AdmissionSetupShell>
  );
}
