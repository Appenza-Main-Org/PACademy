/**
 * ReportsPage — super-admin admissions command center.
 * Composer-only — every section is a self-contained sub-component
 * under [components/reports](../components/reports/). Wired in commit 4.
 */

import { LoadingState, PageHeader } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { useCycleSnapshot } from '../api/reports.queries';

export function ReportsPage(): JSX.Element {
  const cycleSnapshot = useCycleSnapshot();

  return (
    <CenteredShell>
      <PageHeader
        title="لوحة قيادة منظومة القبول"
        subtitle="لوحة المتابعة المركزية لمدير المنظومة"
      />
      {cycleSnapshot.isLoading ? <LoadingState variant="page" /> : null}
    </CenteredShell>
  );
}
