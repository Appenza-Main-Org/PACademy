/**
 * ReportsExportRow — print, CSV, last-updated chip.
 * In-house CSV writer assembles flat rows from the section data;
 * PDF export triggers `window.print()` against the page's @media print
 * stylesheet (no PDF library).
 */

import { FileText, Printer } from 'lucide-react';
import { Button, toast } from '@/shared/components';
import { downloadBlob } from '@/shared/lib/download';
import { date as fmtDate, relativeTime } from '@/shared/lib/format';
import type {
  CycleSnapshot,
  DepartmentReport,
  GovernanceReport,
  IntegrationStatus,
  OperationalStatus,
  StageFunnelPoint,
  TestResultsReport,
} from '@/shared/types/domain';

interface ReportsExportRowProps {
  generatedAt: string;
  snapshot: CycleSnapshot | undefined;
  funnel: readonly StageFunnelPoint[] | undefined;
  departments: DepartmentReport | undefined;
  testResults: TestResultsReport | undefined;
  operational: OperationalStatus | undefined;
  governance: GovernanceReport | undefined;
  integrations: readonly IntegrationStatus[] | undefined;
}

export function ReportsExportRow(props: ReportsExportRowProps): JSX.Element {
  const handlePrint = (): void => {
    if (typeof window !== 'undefined') window.print();
  };

  const handleCsv = (): void => {
    const blob = buildCsv(props);
    const stamp = fmtDate(props.generatedAt, 'short').replace(/\s+/g, '-');
    downloadBlob(blob, `admissions-command-center-${stamp}.csv`);
    toast('تم تصدير ملف CSV', 'success');
  };

  return (
    <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 rounded-pill bg-ink-100 px-3 py-1 text-2xs text-ink-700">
        <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
        آخر تحديث: {relativeTime(new Date(props.generatedAt))}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<FileText size={14} strokeWidth={1.75} />}
          onClick={handleCsv}
        >
          تصدير CSV
        </Button>
        <Button
          variant="primary"
          size="sm"
          leadingIcon={<Printer size={14} strokeWidth={1.75} />}
          onClick={handlePrint}
        >
          تصدير PDF
        </Button>
      </div>
    </div>
  );
}

function escape(value: string | number): string {
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(p: ReportsExportRowProps): Blob {
  const lines: string[] = [];
  const push = (...parts: (string | number)[]): void => {
    lines.push(parts.map(escape).join(','));
  };
  /* UTF-8 BOM so Excel opens Arabic correctly. */
  const BOM = '﻿';

  push('section', 'metric', 'value');
  if (p.snapshot) {
    push('cycle', 'totalApplicants', p.snapshot.totalApplicants);
    push('cycle', 'finalApproved', p.snapshot.finalApproved);
    push('cycle', 'acceptanceRate', `${p.snapshot.acceptanceRate}%`);
    push('cycle', 'daysRemaining', p.snapshot.daysRemaining);
  }
  if (p.funnel) {
    for (const f of p.funnel) {
      push('funnel', f.stageLabel, f.count);
    }
  }
  if (p.departments) {
    for (const d of p.departments.byDepartment) {
      push('department', d.labelAr, d.total);
    }
    for (const r of p.departments.topRejectionReasons) {
      push('rejection', r.labelAr, r.count);
    }
  }
  if (p.testResults) {
    for (const k of p.testResults.byKind) {
      push('test', k.labelAr, `${k.passRate}%`);
    }
  }
  if (p.operational) {
    for (const c of p.operational.committees) {
      push('committee', c.name, `${c.todayProcessed}/${c.todayQueue}`);
    }
    for (const m of p.operational.medicalStations) {
      push('medical-station', m.name, m.queue);
    }
  }
  if (p.integrations) {
    for (const i of p.integrations) {
      push('integration', i.nameAr, i.status);
    }
  }
  if (p.governance) {
    push('governance', 'totalLast24h', p.governance.totalLast24h);
    push('governance', 'highSensitivityLast24h', p.governance.highSensitivityLast24h);
  }
  return new Blob([BOM + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
}
