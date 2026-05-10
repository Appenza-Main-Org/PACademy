import { AdmissionSetupShell } from '../components/AdmissionSetupShell';
import { StepPlaceholder } from '../components/StepPlaceholder';
import { getStepByKey } from '../config';

export function ScoreThresholdsPage(): JSX.Element {
  return (
    <AdmissionSetupShell>
      <StepPlaceholder step={getStepByKey('score_thresholds')} />
    </AdmissionSetupShell>
  );
}
