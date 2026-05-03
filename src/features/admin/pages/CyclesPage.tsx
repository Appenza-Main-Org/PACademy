/**
 * CyclesPage — list of admission cycles with status, capacity, and clone CTA.
 * Source: Tasks/KARASA_GAPS.md §1.2.D.
 */

import { Link } from 'react-router-dom';
import { Copy, Plus } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  toast,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { date as fmtDate, num } from '@/shared/lib/format';
import type { AdmissionCycle, CycleStatus } from '@/shared/types/domain';
import { useCycleClone, useCycles } from '../api/cycles.queries';

const STATUS_LABEL: Record<CycleStatus, string> = {
  draft: 'مسودة',
  open: 'مفتوحة',
  active: 'نشطة',
  closed: 'مغلقة',
  processing: 'تحت المعالجة',
  finalized: 'مختومة',
  archived: 'مؤرشفة',
};

const STATUS_TONE: Record<CycleStatus, 'neutral' | 'success' | 'warning' | 'info' | 'brand'> = {
  draft: 'neutral',
  open: 'success',
  active: 'success',
  closed: 'warning',
  processing: 'info',
  finalized: 'brand',
  archived: 'neutral',
};

export function CyclesPage(): JSX.Element {
  const { data, isLoading } = useCycles();
  const cloneMut = useCycleClone();

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
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<Copy size={12} strokeWidth={1.75} />}
          onClick={() => {
            cloneMut.mutate(c.id, {
              onSuccess: (next) => toast(`تم إنشاء نسخة: ${next.nameAr}`, 'success'),
            });
          }}
        >
          نسخ كمسودة
        </Button>
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
            onClick={() => toast('إنشاء دورة جديدة — قيد التنفيذ', 'info')}
          >
            دورة جديدة
          </Button>
        }
      />

      <Card>
        <DataTable
          data={data ?? []}
          columns={columns}
          rowKey={(c) => c.id}
          loading={isLoading}
          empty={<EmptyState variant="generic" title="لا توجد دورات حالياً" />}
          zebraStripes
        />
      </Card>
    </CenteredShell>
  );
}
