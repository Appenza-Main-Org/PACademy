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
import { LoadingState, LogoMark, PageHeader, Tabs } from '@/shared/components';
import { useSearchParams } from 'react-router-dom';
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
import { DecisionBriefSection } from '../components/reports/DecisionBriefSection';
import { GovernanceSection } from '../components/reports/GovernanceSection';
import { OperationalStatusSection } from '../components/reports/OperationalStatusSection';
import { RangeChips, type TimeRange } from '../components/reports/RangeChips';
import { ReportsExportRow } from '../components/reports/ReportsExportRow';
import { StagePipelineFunnel } from '../components/reports/StagePipelineFunnel';
import { StatusPulseStrip } from '../components/reports/StatusPulseStrip';
import { SuperAdminSignalsSection } from '../components/reports/SuperAdminSignalsSection';
import { TestResultsSection } from '../components/reports/TestResultsSection';
import { ReportsFiltersBar } from '../components/reports/ReportsFiltersBar';
import { ReportsAvailabilityGate } from '../components/reports/ReportsAvailabilityGate';
import { useReportsFiltersStore } from '../reports/store';
import { useActiveCycle, useCycles } from '../api/cycles.queries';
import { resolveActiveCycle } from '../api/cycles.service';
import { ApplicantsReportTab } from './reports/ApplicantsReportTab';
import { StageDropoffTab } from './reports/StageDropoffTab';

const PRINT_CSS = `
@media print {
  .no-print { display: none !important; }
  section { break-inside: avoid; }
}
`;

const REPORT_TABS = ['overview', 'applicants', 'dropoff'] as const;
type ReportTab = (typeof REPORT_TABS)[number];

function resolveReportTab(value: string | null): ReportTab {
  return REPORT_TABS.includes(value as ReportTab) ? (value as ReportTab) : 'overview';
}

export function ReportsPage(): JSX.Element {
  const [range, setRange] = useState<TimeRange>('cycle');
  const [params, setParams] = useSearchParams();
  const activeCycle = useActiveCycle();
  const cycles = useCycles();
  const storedFilters = useReportsFiltersStore((state) => state.filters);
  const listActiveCycle = resolveActiveCycle(cycles.data);
  const effectiveCycle = activeCycle.data ?? listActiveCycle;
  const filters = { ...storedFilters, cycleId: storedFilters.cycleId ?? effectiveCycle?.id };
  const tab = resolveReportTab(params.get('tab'));
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
        subtitle="التقارير والإحصائيات طبقاً لنطاق كراسة الشروط"
        actions={<LogoMark size={36} />}
      />

      <ReportsFiltersBar />

      <Tabs
        value={tab}
        onValueChange={(next) => setParams((prev) => {
          prev.set('tab', next);
          return prev;
        })}
      >
        <Tabs.List>
          <Tabs.Tab value="overview">نظرة عامة</Tabs.Tab>
          <Tabs.Tab value="applicants">تقرير الطلبة</Tabs.Tab>
          <Tabs.Tab value="dropoff">الطلبة المتوقفون</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview">
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

          {cycle.data && funnel.data && operational.data && governance.data && integrations.data ? (
            <DecisionBriefSection
              snapshot={cycle.data}
              funnel={funnel.data}
              operational={operational.data}
              governance={governance.data}
              integrations={integrations.data}
              range={range}
            />
          ) : (
            <LoadingState variant="card-grid" count={3} />
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
        </Tabs.Panel>

        <Tabs.Panel value="applicants">
          <ReportsAvailabilityGate filters={filters}>
            <ApplicantsReportTab />
          </ReportsAvailabilityGate>
        </Tabs.Panel>

        <Tabs.Panel value="dropoff">
          <ReportsAvailabilityGate filters={filters}>
            <StageDropoffTab />
          </ReportsAvailabilityGate>
        </Tabs.Panel>

      </Tabs>
    </CenteredShell>
  );
}
