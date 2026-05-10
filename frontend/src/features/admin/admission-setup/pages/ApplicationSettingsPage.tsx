import { AdmissionSetupShell } from '../components/AdmissionSetupShell';
import { StepPlaceholder } from '../components/StepPlaceholder';
import { getStepByKey } from '../config';

export function ApplicationSettingsPage(): JSX.Element {
  return (
    <AdmissionSetupShell>
      <StepPlaceholder step={getStepByKey('application_settings')} />
    </AdmissionSetupShell>
  );
}
