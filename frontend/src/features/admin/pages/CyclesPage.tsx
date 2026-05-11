/**
 * CyclesPage — list of admission cycles.
 *
 * Columns mirror the trimmed cycle schema: name, year, opening date,
 * closing date, status. Per-row edit opens a modal that lets the
 * admin flip the cycle's status between draft / active / closed;
 * activating while another active cycle exists triggers the same
 * confirm-and-demote dialog used by /admin/cycles/new.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarRange, Pencil, Plus, Save } from 'lucide-react';
import {
  AlertDialog,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  IconStamp,
  Modal,
  PageHeader,
  Select,
  toast,
} from '@/shared/components';
import type { DataTableColumn, ListActionsConfig } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { date as fmtDate } from '@/shared/lib/format';
import { isConflictError } from '@/shared/lib/errors';
import type { AdmissionCycle, CycleStatus } from '@/shared/types/domain';
import { useActiveCycle, useCycleUpdateStatus, useCycles } from '../api/cycles.queries';

type EditableStatus = 'draft' | 'active' | 'closed';

const STATUS_LABEL: Record<CycleStatus, string> = {
  draft: 'مسودة',
  /* `open` is the legacy "running cycle" token kept for seeded data —
   * surface it under the same Arabic label as `active`. */
  open: 'نشطة',
  active: 'نشطة',
  extended: 'ممدّدة',
  closed: 'مغلقة',
  processing: 'تحت المعالجة',
  finalized: 'مختومة',
  archived: 'مؤرشفة',
};

const STATUS_TONE: Record<CycleStatus, 'neutral' | 'success' | 'danger' | 'info'> = {
  draft: 'neutral',
  open: 'success',
  active: 'success',
  extended: 'info',
  closed: 'danger',
  processing: 'info',
  finalized: 'neutral',
  archived: 'neutral',
};

/* Sort priority — more-relevant statuses bubble to the top of the list;
 * cycles within a bucket are then ordered by openDate descending. */
const STATUS_PRIORITY: Record<CycleStatus, number> = {
  active: 0,
  open: 0,
  extended: 0,
  draft: 1,
  closed: 2,
  processing: 3,
  finalized: 4,
  archived: 5,
};

const EDITABLE_STATUS_OPTIONS: ReadonlyArray<{ value: EditableStatus; label: string }> = [
  { value: 'draft', label: 'مسودة' },
  { value: 'active', label: 'نشطة' },
  { value: 'closed', label: 'مغلقة' },
];

/** Normalize legacy `open` / `extended` statuses onto the edit form's
 *  three-state union so the Select reflects the right initial value. */
function toEditableStatus(s: CycleStatus): EditableStatus {
  if (s === 'open' || s === 'active' || s === 'extended') return 'active';
  if (s === 'draft') return 'draft';
  return 'closed';
}

export function CyclesPage(): JSX.Element {
  const navigate = useNavigate();
  const { data, isLoading } = useCycles();
  const { data: activeCycle } = useActiveCycle();
  const updateStatusMut = useCycleUpdateStatus();

  const [editing, setEditing] = useState<AdmissionCycle | null>(null);
  const [draftStatus, setDraftStatus] = useState<EditableStatus>('draft');
  const [conflict, setConflict] = useState<{
    activeCycleName: string;
    targetId: string;
    nextStatus: EditableStatus;
  } | null>(null);

  const sortedCycles = useMemo(() => {
    const rows = [...(data ?? [])];
    rows.sort((a, b) => {
      const byStatus = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      if (byStatus !== 0) return byStatus;
      return new Date(b.openDate).getTime() - new Date(a.openDate).getTime();
    });
    return rows;
  }, [data]);

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
          { key: 'nameAr', labelAr: 'اسم الدورة' },
          { key: 'year', labelAr: 'السنة' },
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

  const openEdit = (cycle: AdmissionCycle): void => {
    setEditing(cycle);
    setDraftStatus(toEditableStatus(cycle.status));
  };

  const closeEdit = (): void => {
    setEditing(null);
  };

  const submitEdit = (options: { demoteCurrentActive?: boolean } = {}): void => {
    if (!editing) return;
    updateStatusMut.mutate(
      {
        id: editing.id,
        next: draftStatus,
        demoteCurrentActive: options.demoteCurrentActive,
      },
      {
        onSuccess: () => {
          if (options.demoteCurrentActive) {
            toast('تم تفعيل الدورة الجديدة وتحويل الدورة السابقة إلى مسودة', 'success');
          } else if (draftStatus === 'active') {
            toast('تم تفعيل الدورة', 'success');
          } else if (draftStatus === 'closed') {
            toast('تم إغلاق الدورة', 'success');
          } else {
            toast('تم حفظ المسودة', 'success');
          }
          setConflict(null);
          setEditing(null);
        },
        onError: (err) => {
          if (isConflictError(err) && err.conflictCode === 'ACTIVE_CYCLE_EXISTS') {
            const payload = err.payload as { activeCycleName?: string };
            setConflict({
              activeCycleName: payload?.activeCycleName ?? '',
              targetId: editing.id,
              nextStatus: draftStatus,
            });
            return;
          }
          toast((err as Error).message, 'danger');
        },
      },
    );
  };

  const columns: DataTableColumn<AdmissionCycle>[] = [
    {
      key: 'nameAr',
      label: 'اسم الدورة',
      render: (c) => (
        <Link
          to={ROUTES.admin.cycleDetail(c.id)}
          className="font-medium text-teal-700 hover:underline"
        >
          {c.nameAr}
        </Link>
      ),
    },
    {
      key: 'year',
      label: 'السنة',
      numeric: true,
      render: (c) => (
        <span className="font-numeric tnum" dir="ltr">
          {c.year}
        </span>
      ),
    },
    {
      key: 'openDate',
      label: 'تاريخ الفتح',
      render: (c) => fmtDate(c.openDate, 'short'),
    },
    {
      key: 'closeDate',
      label: 'تاريخ الإغلاق',
      render: (c) => fmtDate(c.closeDate, 'short'),
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
          leadingIcon={<Pencil size={12} strokeWidth={1.75} />}
          onClick={() => openEdit(c)}
        >
          تعديل
        </Button>
      ),
    },
  ];

  return (
    <CenteredShell>
      <PageHeader
        title="دورات القبول"
        subtitle="إدارة دورات القبول السنوية: تواريخ الفتح والإغلاق، حالة الدورة."
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
                {fmtDate(activeCycle.openDate, 'short')} إلى{' '}
                {fmtDate(activeCycle.closeDate, 'short')}
              </p>
            </div>
            <Badge tone="success">
              <IconStamp width={12} height={12} className="me-1 inline-block" />
              نشطة
            </Badge>
          </div>
        </Card>
      )}

      <Card>
        <DataTable
          data={sortedCycles}
          columns={columns}
          rowKey={(c) => c.id}
          loading={isLoading}
          empty={<EmptyState variant="generic" title="لا توجد دورات حالياً" />}
          zebraStripes
          listActions={listActions}
        />
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => {
          if (!updateStatusMut.isPending) closeEdit();
        }}
        title="تعديل حالة الدورة"
        subtitle={editing?.nameAr}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <Select
            label="حالة الدورة"
            required
            options={EDITABLE_STATUS_OPTIONS as ReadonlyArray<{ value: string; label: string }>}
            value={draftStatus}
            onChange={(e) => setDraftStatus(e.target.value as EditableStatus)}
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={closeEdit}
              disabled={updateStatusMut.isPending}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              variant="primary"
              leadingIcon={<Save size={14} strokeWidth={1.75} />}
              onClick={() => submitEdit()}
              isLoading={updateStatusMut.isPending}
              disabled={
                !!editing && draftStatus === toEditableStatus(editing.status)
              }
            >
              حفظ
            </Button>
          </div>
        </div>
      </Modal>

      <AlertDialog
        open={conflict !== null}
        onOpenChange={(next) => {
          if (!next) setConflict(null);
        }}
        title="تأكيد تفعيل دورة جديدة"
        description={
          conflict ? (
            <>
              يوجد دورة نشطة حالياً باسم{' '}
              <strong className="font-semibold text-ink-900">
                &quot;{conflict.activeCycleName}&quot;
              </strong>
              . عند تفعيل هذه الدورة، سيتم تحويل الدورة الحالية إلى مسودة تلقائياً.
              هل تريد المتابعة؟
            </>
          ) : null
        }
        actionLabel="تأكيد التفعيل"
        cancelLabel="إلغاء"
        tone="danger"
        isActionLoading={updateStatusMut.isPending}
        onAction={() => {
          if (!conflict) return;
          submitEdit({ demoteCurrentActive: true });
        }}
      />
    </CenteredShell>
  );
}
