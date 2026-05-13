/**
 * Bindings sub-tab placeholder — replaced by the matrix UI in a
 * follow-up commit. Kept thin here so the sub-tab strip lands first
 * with a clean typecheck.
 */

import { EmptyState } from '@/shared/components';
import type {
  AdmissionCycle,
  ApplicantCategoryKey,
} from '@/shared/types/domain';

export interface CommitteeBindingsPanelProps {
  cycle: AdmissionCycle;
  active: Array<{ key: ApplicantCategoryKey; labelAr: string }>;
}

export function CommitteeBindingsPanel(
  _props: CommitteeBindingsPanelProps,
): JSX.Element {
  return (
    <EmptyState
      variant="generic"
      title="ربط اللجان بالمواعيد"
      description="قيد الإعداد — مصفوفة اللجان × الأيام تظهر هنا."
    />
  );
}
