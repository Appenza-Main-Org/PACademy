import { useMemo, useState } from 'react';
import { Card, CardHeader, DataTable, Funnel, Input, Select } from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import { useStageDropoffQuery } from '../../api/reports.queries';
import { useActiveCycle } from '../../api/cycles.queries';
import { ReportsExportButtons } from '../../components/reports/ReportsExportButtons';
import { useReportsFiltersStore } from '../../reports/store';
import type { StuckApplicantRow } from '../../reports/types';

const STAGE_OPTIONS = Array.from({ length: 11 }, (_, index) => ({
  value: String(index + 1),
  label: `المرحلة ${index + 1}`,
}));

export function StageDropoffTab(): JSX.Element {
  const storedFilters = useReportsFiltersStore((state) => state.filters);
  const activeCycle = useActiveCycle();
  const filters = { ...storedFilters, cycleId: storedFilters.cycleId ?? activeCycle.data?.id };
  const setFilters = useReportsFiltersStore((state) => state.set);
  const [page, setPage] = useState(1);
  const [staleDays, setStaleDays] = useState(7);
  const query = useStageDropoffQuery(
    { ...filters, stoppedAtStage: filters.stoppedAtStage ?? 1 },
    { page, pageSize: 25, staleDays },
  );
  const rows = query.data?.data ?? [];

  const columns = useMemo<DataTableColumn<StuckApplicantRow>[]>(
    () => [
      { key: 'index', label: 'م', render: (_, index) => (page - 1) * 25 + index + 1, numeric: true },
      { key: 'nationalId', label: 'الرقم القومي', accessor: 'nationalId' },
      { key: 'nameAr', label: 'الاسم', accessor: 'nameAr' },
      { key: 'stoppedAtStageLabelAr', label: 'المرحلة المتوقف عندها', accessor: 'stoppedAtStageLabelAr' },
      { key: 'lastActivityAt', label: 'آخر نشاط', render: (row) => new Date(row.lastActivityAt).toLocaleDateString('ar-EG') },
      { key: 'staleDays', label: 'أيام التوقف', accessor: 'staleDays', numeric: true },
      { key: 'categoryLabelAr', label: 'الفئة', accessor: 'categoryLabelAr' },
      { key: 'committeeLabelAr', label: 'اللجنة', accessor: 'committeeLabelAr' },
      { key: 'paymentStatus', label: 'حالة الدفع', accessor: 'paymentStatus' },
    ],
    [page],
  );

  return (
    <Card>
      <CardHeader
        title="تقرير الطلبة المتوقفين"
        subtitle="المتقدمون المتوقفون عند مرحلة محددة لأكثر من عدد الأيام المختار"
        actions={
          <ReportsExportButtons<StuckApplicantRow>
            title="تقرير الطلبة المتوقفين"
            report="dropoff"
            getRows={() => rows}
            getColumns={() => [
              { key: 'nationalId', label: 'الرقم القومي' },
              { key: 'nameAr', label: 'الاسم' },
              { key: 'stoppedAtStageLabelAr', label: 'المرحلة المتوقف عندها' },
              { key: 'lastActivityAt', label: 'آخر نشاط' },
              { key: 'staleDays', label: 'أيام التوقف' },
              { key: 'categoryLabelAr', label: 'الفئة' },
              { key: 'committeeLabelAr', label: 'اللجنة' },
              { key: 'paymentStatus', label: 'حالة الدفع' },
            ]}
          />
        }
      />
      <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
        <Funnel
          stages={(query.data?.funnel ?? []).map((stage) => ({ label: stage.stageLabel, value: stage.count }))}
          ariaLabel="قمع مراحل التسجيل"
        />
        <Select
          label="المرحلة"
          value={String(filters.stoppedAtStage ?? 1)}
          options={STAGE_OPTIONS}
          onChange={(event) => {
            setPage(1);
            setFilters({ stoppedAtStage: Number(event.target.value) });
          }}
        />
        <Input
          label="أيام التوقف"
          type="number"
          min={1}
          value={staleDays}
          onChange={(event) => {
            setPage(1);
            setStaleDays(Math.max(1, Number(event.target.value) || 7));
          }}
        />
      </div>
      <DataTable
        data={rows}
        columns={columns}
        loading={query.isLoading}
        rowKey={(row) => row.id}
        pagination={{
          page,
          pageSize: query.data?.pageSize ?? 25,
          total: query.data?.total ?? 0,
          onPageChange: setPage,
        }}
        empty={<p className="py-8 text-center text-sm text-ink-500">لا توجد حالات توقف بهذه المرحلة.</p>}
      />
    </Card>
  );
}
