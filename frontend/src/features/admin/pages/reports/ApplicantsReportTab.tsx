import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Button, Card, CardHeader, DataTable, Input, Select } from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import { useApplicantsAggregateQuery, useApplicantsDetailQuery } from '../../api/reports.queries';
import { useActiveCycle } from '../../api/cycles.queries';
import { ReportsExportButtons } from '../../components/reports/ReportsExportButtons';
import { useReportsFiltersStore } from '../../reports/store';
import type { ApplicantReportAggregateRow, ApplicantReportRow, GroupByDimension } from '../../reports/types';

const GROUP_BY_OPTIONS: Array<{ value: GroupByDimension; label: string }> = [
  { value: 'committee', label: 'اللجنة' },
  { value: 'specialization', label: 'التخصص' },
  { value: 'category', label: 'الفئة' },
  { value: 'gender', label: 'الجنس' },
  { value: 'paymentStatus', label: 'حالة الدفع' },
  { value: 'ageBracket', label: 'شريحة السن' },
];

const PAYMENT_LABELS: Record<string, string> = {
  unpaid: 'لم يدفع',
  pending: 'قيد الدفع',
  paid: 'مدفوع',
  refunded: 'مسترد',
};

export function ApplicantsReportTab(): JSX.Element {
  const navigate = useNavigate();
  const storedFilters = useReportsFiltersStore((state) => state.filters);
  const activeCycle = useActiveCycle();
  const filters = { ...storedFilters, cycleId: storedFilters.cycleId ?? activeCycle.data?.id };
  const [mode, setMode] = useState<'aggregate' | 'detail'>('aggregate');
  const [groupBy, setGroupBy] = useState<GroupByDimension>('committee');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const aggregate = useApplicantsAggregateQuery(filters, groupBy);
  const detail = useApplicantsDetailQuery(filters, { page, pageSize: 25, search });

  const aggregateColumns = useMemo<DataTableColumn<ApplicantReportAggregateRow>[]>(
    () => [
      { key: 'dimensionLabelAr', label: 'البُعد', accessor: 'dimensionLabelAr' },
      { key: 'total', label: 'إجمالي المتقدمين', accessor: 'total', numeric: true, sortable: true },
      { key: 'paid', label: 'المدفوع', accessor: 'paid', numeric: true },
      { key: 'unpaid', label: 'غير المدفوع', accessor: 'unpaid', numeric: true },
      { key: 'percentage', label: 'النسبة %', render: (row) => `${row.percentage}%`, numeric: true },
    ],
    [],
  );

  const detailColumns = useMemo<DataTableColumn<ApplicantReportRow>[]>(
    () => [
      { key: 'index', label: 'م', render: (_, index) => (page - 1) * 25 + index + 1, numeric: true },
      { key: 'nationalId', label: 'الرقم القومي', accessor: 'nationalId', sortable: true },
      { key: 'nameAr', label: 'الاسم', accessor: 'nameAr', sortable: true },
      { key: 'gender', label: 'الجنس', render: (row) => row.gender === 'female' ? 'أنثى' : 'ذكر' },
      { key: 'age', label: 'السن', render: (row) => row.age ?? '—', numeric: true, sortable: true },
      { key: 'categoryLabelAr', label: 'الفئة', accessor: 'categoryLabelAr' },
      { key: 'applicantTypeLabelAr', label: 'النوع', accessor: 'applicantTypeLabelAr' },
      { key: 'specializationLabelAr', label: 'التخصص', accessor: 'specializationLabelAr' },
      { key: 'committeeLabelAr', label: 'اللجنة', accessor: 'committeeLabelAr' },
      { key: 'currentStageLabelAr', label: 'المرحلة الحالية', accessor: 'currentStageLabelAr' },
      { key: 'paymentStatus', label: 'حالة الدفع', render: (row) => PAYMENT_LABELS[row.paymentStatus] ?? row.paymentStatus },
      { key: 'submittedAt', label: 'تاريخ التقديم', render: (row) => new Date(row.submittedAt).toLocaleDateString('ar-EG'), sortable: true },
    ],
    [page],
  );

  if (mode === 'detail') {
    const rows = detail.data?.data ?? [];
    return (
      <Card>
        <CardHeader
          title="تقرير بيانات الطلبة"
          subtitle="بيان تفصيلي مطابق لفلاتر الاستعلام"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={() => setMode('aggregate')}>إجمالي</Button>
              <ReportsExportButtons<ApplicantReportRow>
                title="تقرير بيانات الطلبة"
                report="detail"
                getRows={() => rows}
                getColumns={() => detailColumns.map((column) => ({
                  key: column.key,
                  label: String(column.label),
                  value: (row) => column.render ? String(column.render(row, 0)) : String((row as Record<string, unknown>)[column.key] ?? ''),
                }))}
              />
            </div>
          }
        />
        <Input
          className="mb-4 max-w-sm"
          label="بحث بالرقم القومي"
          value={search}
          onChange={(event) => {
            setPage(1);
            setSearch(event.target.value);
          }}
        />
        <DataTable
          data={rows}
          columns={detailColumns}
          loading={detail.isLoading}
          rowKey={(row) => row.id}
          onRowClick={(row) => navigate(`/admin/applicants/${row.id}`)}
          pagination={{
            page,
            pageSize: detail.data?.pageSize ?? 25,
            total: detail.data?.total ?? 0,
            onPageChange: setPage,
          }}
          empty={<p className="py-8 text-center text-sm text-ink-500">لا توجد بيانات تطابق الفلاتر المحددة.</p>}
        />
      </Card>
    );
  }

  const rows = aggregate.data?.rows ?? [];
  return (
    <Card>
      <CardHeader
        title="تقرير إجمالي أعداد الطلبة"
        subtitle="إجمالي ومدفوع وغير مدفوع حسب البُعد المختار"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setMode('detail')}>تفصيلي</Button>
            <ReportsExportButtons<ApplicantReportAggregateRow>
              title="تقرير إجمالي أعداد الطلبة"
              report="aggregate"
              getRows={() => rows}
              getColumns={() => [
                { key: 'dimensionLabelAr', label: 'البُعد' },
                { key: 'total', label: 'إجمالي المتقدمين' },
                { key: 'paid', label: 'المدفوع' },
                { key: 'unpaid', label: 'غير المدفوع' },
                { key: 'percentage', label: 'النسبة %' },
              ]}
            />
          </div>
        }
      />
      <div className="mb-4 max-w-xs">
        <Select
          label="تجميع حسب"
          value={groupBy}
          options={GROUP_BY_OPTIONS}
          onChange={(event) => setGroupBy(event.target.value as GroupByDimension)}
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_1fr]">
        <BarChart data={rows.map((row) => ({ label: row.dimensionLabelAr, value: row.total }))} />
        <DataTable
          data={rows}
          columns={aggregateColumns}
          loading={aggregate.isLoading}
          rowKey={(row) => row.dimensionKey}
          empty={<p className="py-8 text-center text-sm text-ink-500">لا توجد بيانات تطابق الفلاتر المحددة.</p>}
        />
      </div>
    </Card>
  );
}
