/**
 * CyclesPage — list of admission cycles with status, capacity, and clone CTA.
 * Source: Tasks/KARASA_GAPS.md §1.2.D.
 */

import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarRange, Copy, Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  DataTable,
  DuplicateAction,
  EmptyState,
  IconStamp,
  PageHeader,
  toast,
} from '@/shared/components';
import type { DataTableColumn, ListActionsConfig } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { date as fmtDate, num } from '@/shared/lib/format';
import type { AdmissionCycle, CycleStatus } from '@/shared/types/domain';
import { cyclesService } from '../api/cycles.service';
import { cyclesKeys, useActiveCycle, useCycles } from '../api/cycles.queries';

const STATUS_LABEL: Record<CycleStatus, string> = {
  draft: 'مسودة',
  open: 'مفتوحة',
  active: 'نشطة',
  extended: 'ممدّدة',
  closed: 'مغلقة',
  processing: 'تحت المعالجة',
  finalized: 'مختومة',
  archived: 'مؤرشفة',
};

const STATUS_TONE: Record<CycleStatus, 'neutral' | 'success' | 'warning' | 'info' | 'brand'> = {
  draft: 'neutral',
  open: 'success',
  active: 'success',
  extended: 'info',
  closed: 'warning',
  processing: 'info',
  finalized: 'brand',
  archived: 'neutral',
};

export function CyclesPage(): JSX.Element {
  const navigate = useNavigate();
  const { data, isLoading } = useCycles();
  const { data: activeCycle } = useActiveCycle();
  const qc = useQueryClient();

  const listActions: ListActionsConfig<AdmissionCycle> = useMemo(
    () => ({
      entityKey: 'admin.cycles',
      entityLabelAr: 'دورات القبول',
      auditModule: 'cycles',
      export: {
        enabled: true,
        formats: ['csv', 'xlsx'],
        filenamePrefix: 'دورات-القبول-',
        columns: [
          { key: 'id', labelAr: 'الكود' },
          { key: 'nameAr', labelAr: 'اسم الدورة' },
          {
            key: 'cohort',
            labelAr: 'الفئة',
            format: (v) => (v === 'male' ? 'ذكور' : 'إناث'),
          },
          { key: 'year', labelAr: 'العام' },
          {
            key: 'openDate',
            labelAr: 'تاريخ الفتح',
            format: (v) => fmtDate(String(v), 'short'),
          },
          {
            key: 'closeDate',
            labelAr: 'تاريخ الإغلاق',
            format: (v) => fmtDate(String(v), 'short'),
          },
          { key: 'expectedCapacity', labelAr: 'السعة المتوقعة' },
          { key: 'applicantCount', labelAr: 'عدد المتقدمين' },
          {
            key: 'status',
            labelAr: 'الحالة',
            format: (v) => STATUS_LABEL[v as CycleStatus] ?? String(v ?? ''),
          },
        ],
      },
    }),
    [],
  );

  const columns: DataTableColumn<AdmissionCycle>[] = [
    {
      key: 'nameAr',
      label: 'الدورة',
      render: (c) => (
        <Link to={ROUTES.admin.cycleDetail(c.id)} className="font-medium text-teal-700 hover:underline">
          {c.nameAr}
        </Link>
      ),
    },
    {
      key: 'cohort',
      label: 'الفئة',
      render: (c) => (c.cohort === 'male' ? 'ذكور' : 'إناث'),
    },
    { key: 'openDate', label: 'تاريخ الفتح', render: (c) => fmtDate(c.openDate, 'short') },
    { key: 'closeDate', label: 'تاريخ الإغلاق', render: (c) => fmtDate(c.closeDate, 'short') },
    {
      key: 'capacity',
      label: 'السعة',
      numeric: true,
      render: (c) => num(c.expectedCapacity),
    },
    {
      key: 'applicantCount',
      label: 'المتقدمون',
      numeric: true,
      render: (c) => (
        <span>
          <span dir="ltr">{num(c.applicantCount)}</span>{' '}
          <span className="text-2xs text-ink-500">
            ({Math.round((c.applicantCount / Math.max(1, c.expectedCapacity)) * 100)}%)
          </span>
        </span>
      ),
    },
    {
      key: 'status',
      label: 'الحالة',
      render: (c) => <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>,
    },
    {
      key: '_actions',
      label: <span className="sr-only">إجراءات</span>,
      align: 'end',
      render: (c) => (
        <DuplicateAction
          row={c}
          entityKey="admin.cycles"
          entityLabelAr="دورة القبول"
          auditModule="cycles"
          config={{
            enabled: true,
            transform: (row) => ({
              nameAr: `${row.nameAr} (نسخة)`,
              status: 'draft' as CycleStatus,
              applicantCount: 0,
            }),
            onCommit: async (_draft, source) => cyclesService.clone(source.id),
            redirectTo: (next) => ROUTES.admin.cycleDetail(next.id),
            guard: (row) => {
              /* Cycles that are already in an active/open/extended state can be
               * cloned (the clone always lands draft), but the user should be
               * aware that activating it will require closing the source. */
              if (row.deletedAt) return 'لا يمكن نسخ دورة محذوفة';
              return null;
            },
          }}
          onSuccess={(next) => {
            toast(`تم إنشاء نسخة: ${next.nameAr}`, 'success');
            qc.invalidateQueries({ queryKey: [...cyclesKeys.all, 'list'] });
          }}
        >
          {({ onClick }) => (
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<Copy size={12} strokeWidth={1.75} />}
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
            >
              نسخ كمسودة
            </Button>
          )}
        </DuplicateAction>
      ),
    },
  ];

  return (
    <CenteredShell>
      <PageHeader
        title="دورات القبول"
        subtitle="إدارة دورات القبول السنوية: السعة، تواريخ الفتح والإغلاق، حالة الدورة."
        breadcrumbs={[
          { label: 'إدارة المنظومة', href: ROUTES.admin.dashboard },
          { label: 'الدورات' },
        ]}
        actions={
          <Button
            variant="primary"
            leadingIcon={<Plus size={14} strokeWidth={1.75} />}
            onClick={() => navigate(ROUTES.admin.cycleNew)}
          >
            إنشاء دورة جديدة
          </Button>
        }
      />

      {activeCycle && (
        <Card variant="elevated" className="mb-4 border-l-2 border-l-teal-500">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-teal-50 text-teal-700">
              <CalendarRange size={20} strokeWidth={1.75} />
            </span>
            <div className="flex-1">
              <p className="font-ar-display text-md font-bold text-ink-900">
                الدورة النشطة: {activeCycle.nameAr}
              </p>
              <p className="mt-0.5 text-2xs text-ink-500">
                {fmtDate(activeCycle.openDate, 'short')} إلى {fmtDate(activeCycle.closeDate, 'short')}
                {' · '}
                {Object.values(activeCycle.openCategories ?? {}).filter((c) => c?.isOpen).length} فئات مفتوحة
              </p>
            </div>
            <Badge tone="success">
              <IconStamp width={12} height={12} className="me-1 inline-block" />
              نشطة
            </Badge>
            <Link to={ROUTES.admin.cycleDetail(activeCycle.id)}>
              <Button variant="primary" size="sm">إدارة الدورة</Button>
            </Link>
          </div>
        </Card>
      )}

      <Card>
        <DataTable
          data={data ?? []}
          columns={columns}
          rowKey={(c) => c.id}
          loading={isLoading}
          empty={<EmptyState variant="generic" title="لا توجد دورات حالياً" />}
          zebraStripes
          listActions={listActions}
        />
      </Card>
    </CenteredShell>
  );
}
