/**
 * DistributionPage — توزيع كشوف على المحقّقين.
 * Source: RFP Scope Document §5.2.D.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Printer, RefreshCw } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  PrintLayout,
  toast,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import { investigationsService } from '../api/investigations.service';
import { date as fmtDate } from '@/shared/lib/format';
import type { InvestigationCase } from '@/shared/types/domain';

export function DistributionPage(): JSX.Element {
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['investigations', 'cases', { status: 'open' }],
    queryFn: () => investigationsService.list({ status: 'open' }),
  });
  const balanceMut = useMutation({
    mutationFn: () => investigationsService.autoBalance(),
    onSuccess: ({ assignments }) => {
      toast(`تم توزيع ${assignments.length} قضية تلقائياً`, 'success');
      qc.invalidateQueries({ queryKey: ['investigations'] });
    },
  });

  const columns: DataTableColumn<InvestigationCase>[] = [
    { key: 'id', label: 'القضية', width: 110, render: (c) => <span className="font-mono" dir="ltr">{c.id}</span> },
    { key: 'applicant', label: 'المتقدم', render: (c) => c.applicantName },
    { key: 'caseType', label: 'النوع', render: (c) => CASE_TYPE_LABEL[c.caseType] },
    { key: 'priority', label: 'الأولوية', render: (c) => <Badge tone={priorityTone(c.priority)}>{PRIORITY_LABEL[c.priority]}</Badge> },
    { key: 'assignedTo', label: 'المحقّق', render: (c) => c.assignedTo },
    { key: 'dueDate', label: 'تاريخ الاستحقاق', render: (c) => <span className="text-2xs text-ink-500">{fmtDate(c.dueDate, 'short')}</span> },
  ];

  return (
    <>
      <PageHeader
        title="كشوف التوزيع"
        subtitle="موازنة القضايا المفتوحة على المحقّقين النشطين، ثم طباعة كشف"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              leadingIcon={<RefreshCw size={14} strokeWidth={1.75} />}
              isLoading={balanceMut.isPending}
              onClick={() => balanceMut.mutate()}
            >
              توزيع تلقائي
            </Button>
            <Button variant="primary" leadingIcon={<Printer size={14} strokeWidth={1.75} />} onClick={() => window.print()}>
              طباعة الكشف
            </Button>
          </div>
        }
      />

      <PrintLayout
        title="كشف توزيع قضايا التحريات"
        subtitle={`عدد القضايا المفتوحة: ${data?.length ?? 0}`}
        reportId={`DIST-${new Date().toISOString().slice(0, 10)}`}
        generatedAt={fmtDate(Date.now())}
        restricted
      >
        <Card>
          <DataTable
            data={data ?? []}
            columns={columns}
            rowKey={(c) => c.id}
            loading={isLoading}
            error={isError ? <ErrorState error={error} onRetry={() => refetch()} /> : undefined}
            empty={<EmptyState variant="no-cases" />}
            density="compact"
          />
        </Card>
      </PrintLayout>
    </>
  );
}

function priorityTone(p: InvestigationCase['priority']): 'neutral' | 'info' | 'warning' | 'danger' {
  if (p === 'critical') return 'danger';
  if (p === 'high') return 'warning';
  if (p === 'medium') return 'info';
  return 'neutral';
}

const CASE_TYPE_LABEL: Record<InvestigationCase['caseType'], string> = {
  'committee-A': 'لجنة (أ)',
  'committee-C': 'لجنة (ج)',
  'data-review': 'مراجعة',
};
const PRIORITY_LABEL: Record<InvestigationCase['priority'], string> = {
  low: 'منخفضة',
  medium: 'متوسطة',
  high: 'مرتفعة',
  critical: 'حرجة',
};
