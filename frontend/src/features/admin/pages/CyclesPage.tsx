/**
 * CyclesPage — list of admission cycles.
 *
 * Columns mirror the Add form (CycleNewPage) field set 1:1:
 *   اسم الدورة · السنة · حالة الدورة.
 *
 * Status is a two-state binary on this surface — see cycleListStatus.ts:
 *   إدراج ومراجعة → draft (editable)
 *   اعتماد ونشر  → published (locked — Edit action is aria-disabled with a
 *                  tooltip explaining why).
 *
 * Per-row Edit opens a modal that flips the cycle between the two states.
 * Promoting a draft to "اعتماد ونشر" while another cycle is already
 * published triggers the same confirm-and-demote dialog used by
 * /admin/cycles/new.
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
  Tooltip,
  TooltipProvider,
} from '@/shared/components';
import type { DataTableColumn, ListActionsConfig } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { date as fmtDate } from '@/shared/lib/format';
import { isConflictError } from '@/shared/lib/errors';
import type { AdmissionCycle } from '@/shared/types/domain';
import { useActiveCycle, useCycleUpdateStatus, useCycles } from '../api/cycles.queries';
import {
  fromListStatus,
  LIST_STATUS_LABEL,
  LIST_STATUS_OPTIONS,
  LIST_STATUS_TONE,
  toListStatus,
  type CycleListStatus,
} from '../components/cycles/cycleListStatus';

const LOCKED_EDIT_HINT = 'لا يمكن التعديل بعد الاعتماد والنشر';

/* Drafts (إدراج ومراجعة) bubble to the top — they're the only rows the
 * admin can act on. Published rows follow, ordered by year desc. */
const LIST_STATUS_PRIORITY: Record<CycleListStatus, number> = {
  review: 0,
  published: 1,
};

export function CyclesPage(): JSX.Element {
  const navigate = useNavigate();
  const { data, isLoading } = useCycles();
  const { data: activeCycle } = useActiveCycle();
  const updateStatusMut = useCycleUpdateStatus();

  const [editing, setEditing] = useState<AdmissionCycle | null>(null);
  const [draftStatus, setDraftStatus] = useState<CycleListStatus>('review');
  const [conflict, setConflict] = useState<{
    activeCycleName: string;
    targetId: string;
  } | null>(null);

  const sortedCycles = useMemo(() => {
    const rows = [...(data ?? [])];
    rows.sort((a, b) => {
      const byStatus =
        LIST_STATUS_PRIORITY[toListStatus(a.status)] -
        LIST_STATUS_PRIORITY[toListStatus(b.status)];
      if (byStatus !== 0) return byStatus;
      if (a.year !== b.year) return b.year - a.year;
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
            key: 'status',
            labelAr: 'حالة الدورة',
            format: (v) =>
              LIST_STATUS_LABEL[toListStatus(v as AdmissionCycle['status'])],
          },
        ],
      },
    }),
    [],
  );

  const openEdit = (cycle: AdmissionCycle): void => {
    setEditing(cycle);
    setDraftStatus(toListStatus(cycle.status));
  };

  const closeEdit = (): void => {
    setEditing(null);
  };

  const submitEdit = (options: { demoteCurrentActive?: boolean } = {}): void => {
    if (!editing) return;
    updateStatusMut.mutate(
      {
        id: editing.id,
        next: fromListStatus(draftStatus),
        demoteCurrentActive: options.demoteCurrentActive,
      },
      {
        onSuccess: () => {
          if (options.demoteCurrentActive) {
            toast('تم اعتماد الدورة الجديدة وتحويل الدورة السابقة إلى مسودة', 'success');
          } else if (draftStatus === 'published') {
            toast('تم اعتماد ونشر الدورة', 'success');
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
      key: 'status',
      label: 'حالة الدورة',
      render: (c) => {
        const ls = toListStatus(c.status);
        return <Badge tone={LIST_STATUS_TONE[ls]}>{LIST_STATUS_LABEL[ls]}</Badge>;
      },
    },
    {
      key: '_actions',
      label: <span className="sr-only">إجراءات</span>,
      align: 'end',
      render: (c) => {
        const isLocked = toListStatus(c.status) === 'published';
        /* When locked we deliberately omit the native `disabled` so the
         * button stays focusable + hoverable for the tooltip, and guard
         * the click handler instead. aria-disabled exposes the state to AT. */
        const editButton = (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Pencil size={12} strokeWidth={1.75} />}
            aria-disabled={isLocked || undefined}
            className={
              isLocked
                ? 'cursor-not-allowed text-ink-400 hover:bg-transparent hover:text-ink-400'
                : undefined
            }
            onClick={() => {
              if (isLocked) return;
              openEdit(c);
            }}
          >
            تعديل
          </Button>
        );
        return isLocked ? (
          <Tooltip content={LOCKED_EDIT_HINT}>
            <span tabIndex={0} aria-label={LOCKED_EDIT_HINT} className="inline-flex">
              {editButton}
            </span>
          </Tooltip>
        ) : (
          editButton
        );
      },
    },
  ];

  return (
    <TooltipProvider>
      <CenteredShell>
        <PageHeader
          title="دورات القبول"
          subtitle="إدارة دورات القبول السنوية: الاسم والسنة وحالة الاعتماد والنشر."
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
                  الدورة المعتمدة والمنشورة: {activeCycle.nameAr}
                </p>
                <p className="mt-0.5 text-2xs text-ink-500">
                  {fmtDate(activeCycle.openDate, 'short')} إلى{' '}
                  {fmtDate(activeCycle.closeDate, 'short')}
                </p>
              </div>
              <Badge tone={LIST_STATUS_TONE.published}>
                <IconStamp width={12} height={12} className="me-1 inline-block" />
                {LIST_STATUS_LABEL.published}
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
              options={LIST_STATUS_OPTIONS as ReadonlyArray<{ value: string; label: string }>}
              value={draftStatus}
              onChange={(e) => setDraftStatus(e.target.value as CycleListStatus)}
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
                  !!editing && draftStatus === toListStatus(editing.status)
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
          title="تأكيد اعتماد ونشر دورة جديدة"
          description={
            conflict ? (
              <>
                يوجد دورة معتمدة ومنشورة حالياً باسم{' '}
                <strong className="font-semibold text-ink-900">
                  &quot;{conflict.activeCycleName}&quot;
                </strong>
                . عند اعتماد هذه الدورة، سيتم تحويل الدورة الحالية إلى مسودة تلقائياً.
                هل تريد المتابعة؟
              </>
            ) : null
          }
          actionLabel="تأكيد الاعتماد"
          cancelLabel="إلغاء"
          tone="danger"
          isActionLoading={updateStatusMut.isPending}
          onAction={() => {
            if (!conflict) return;
            submitEdit({ demoteCurrentActive: true });
          }}
        />
      </CenteredShell>
    </TooltipProvider>
  );
}
