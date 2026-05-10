import { AdmissionSetupShell } from '../components/AdmissionSetupShell';
import { StepPlaceholder } from '../components/StepPlaceholder';
import { getStepByKey } from '../config';

export function CommitteeMergeSplitPage(): JSX.Element {
  return (
    <AdmissionSetupShell>
      <StepPlaceholder step={getStepByKey('committee_merge_split')} />
    </AdmissionSetupShell>
  );
}
