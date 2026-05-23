/**
 * ReportsPage — super-admin admissions command center.
 *
 * Composer-only: header, time-range chip, export row, status pulse,
 * then six section components. Each section consumes its own query
 * hook and ships its own loading/empty states. The page itself stays
 * dumb (no business logic, no aggregation) so layout edits never
 * touch service code.
 */

import { useState } from 'react';
import { LoadingState, LogoMark, PageHeader } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import {
  useCycleSnapshot,
  useDepartmentReports,
  useGovernanceReport,
  useIntegrationStatus,
  useOperationalStatus,
  useStageFunnel,
  useTestResultsReport,
} from '../api/reports.queries';
import { CycleOverviewSection } from '../components/reports/CycleOverviewSection';
import { DepartmentBreakdownSection } from '../components/reports/DepartmentBreakdownSection';
import { GovernanceSection } from '../components/reports/GovernanceSection';
import { OperationalStatusSection } from '../components/reports/OperationalStatusSection';
import { RangeChips, type TimeRange } from '../components/reports/RangeChips';
import { ReportsExportRow } from '../components/reports/ReportsExportRow';
import { StagePipelineFunnel } from '../components/reports/StagePipelineFunnel';
import { StatusPulseStrip } from '../components/reports/StatusPulseStrip';
import { SuperAdminSignalsSection } from '../components/reports/SuperAdminSignalsSection';
import { TestResultsSection } from '../components/reports/TestResultsSection';

const PRINT_CSS = `
@media print {
  .no-print { display: none !important; }
  section { break-inside: avoid; }
}
`;

export function ReportsPage(): JSX.Element {
  const [range, setRange] = useState<TimeRange>('cycle');
  const cycle = useCycleSnapshot();
  const funnel = useStageFunnel();
  const departments = useDepartmentReports();
  const tests = useTestResultsReport();
  const operational = useOperationalStatus();
  const governance = useGovernanceReport();
  const integrations = useIntegrationStatus();

  const generatedAt = cycle.data?.generatedAt ?? new Date(0).toISOString();

  return (
    <CenteredShell>
      <style>{PRINT_CSS}</style>
      <PageHeader
        title="لوحة قيادة منظومة القبول"
        subtitle="لوحة المتابعة المركزية لمدير المنظومة"
        actions={<LogoMark size={36} />}
      />

      <ReportsExportRow
        generatedAt={generatedAt}
        snapshot={cycle.data}
        funnel={funnel.data}
        departments={departments.data}
        testResults={tests.data}
        operational={operational.data}
        governance={governance.data}
        integrations={integrations.data}
      />

      <RangeChips value={range} onChange={setRange} />

      {cycle.data && integrations.data ? (
        <StatusPulseStrip snapshot={cycle.data} integrations={integrations.data} />
      ) : (
        <LoadingState variant="kpi" />
      )}

      {funnel.data && operational.data && governance.data ? (
        <SuperAdminSignalsSection
          funnel={funnel.data}
          operational={operational.data}
          governance={governance.data}
        />
      ) : (
        <LoadingState variant="card-grid" count={5} />
      )}

      {cycle.data ? (
        <CycleOverviewSection snapshot={cycle.data} range={range} />
      ) : (
        <LoadingState variant="card-grid" count={3} />
      )}
      {funnel.data ? <StagePipelineFunnel funnel={funnel.data} /> : <LoadingState variant="table" rows={6} />}
      {departments.data ? (
        <DepartmentBreakdownSection report={departments.data} />
      ) : (
        <LoadingState variant="card-grid" count={3} />
      )}
      {tests.data ? <TestResultsSection report={tests.data} /> : <LoadingState variant="card-grid" count={5} />}
      {operational.data ? (
        <OperationalStatusSection status={operational.data} />
      ) : (
        <LoadingState variant="card-grid" count={4} />
      )}
      {governance.data && integrations.data ? (
        <GovernanceSection governance={governance.data} integrations={integrations.data} range={range} />
      ) : (
        <LoadingState variant="card-grid" count={3} />
      )}
    </CenteredShell>
  );
}
