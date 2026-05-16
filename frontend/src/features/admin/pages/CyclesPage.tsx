/**
 * CyclesPage — list of admission cycles.
 *
 * Columns mirror the Add form (CycleNewPage) field set 1:1, plus the
 * orthogonal active flag and per-row actions:
 *   اسم الدورة · السنة · حالة الدورة · حالة التفعيل · إجراءات.
 *
 * Status (review/published) and isActive are independent — see
 * cycleListStatus.ts and AdmissionCycle.isActive. Activating a cycle is a
 * separate concern from editing its status, and the mock service upholds
 * the single-active invariant atomically.
 *
 * Per-row actions:
 *   • تعديل      — enabled only while the cycle is in "إدراج ومراجعة";
 *                  aria-disabled with a Tooltip otherwise.
 *   • تفعيل      — flips isActive on the row (and clears it on every
 *                  other cycle). Confirms via AlertDialog. The currently
 *                  active row gets a "نشطة" badge in place of the button.
 *   • إعداد القبول — navigates to /admin/cycles/admission-setup for the
 *                    currently active cycle. Aria-disabled + tooltip
 *                    ("متاح فقط للدورة النشطة") for non-active rows.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarRange, Pencil, Plus, Power, Save, Settings2 } from 'lucide-react';
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
import {
  useCycles,
  useCycleSetActive,
  useCycleUpdateStatus,
} from '../api/cycles.queries';
import {
  fromListStatus,
  LIST_STATUS_LABEL,
  LIST_STATUS_OPTIONS,
  LIST_STATUS_TONE,
  toListStatus,
  type CycleListStatus,
} from '../components/cycles/cycleListStatus';

const LOCKED_EDIT_HINT = 'لا يمكن التعديل بعد الاعتماد والنشر';
const SETUP_LOCKED_HINT = 'متاح فقط للدورة النشطة';

const ACTIVE_LABEL = 'نشطة';
const INACTIVE_LABEL = 'غير نشطة';

/* Drafts (إدراج ومراجعة) bubble to the top — they're the only rows the
 * admin can edit. Published rows follow, ordered by year desc. */
const LIST_STATUS_PRIORITY: Record<CycleListStatus, number> = {
  review: 0,
  published: 1,
};

export function CyclesPage(): JSX.Element {
  const navigate = useNavigate();
  const { data, isLoading } = useCycles();
  const updateStatusMut = useCycleUpdateStatus();
  const setActiveMut = useCycleSetActive();

  const [editing, setEditing] = useState<AdmissionCycle | null>(null);
  const [draftStatus, setDraftStatus] = useState<CycleListStatus>('review');
  const [conflict, setConflict] = useState<{
    activeCycleName: string;
    targetId: string;
  } | null>(null);
  const [activateTarget, setActivateTarget] = useState<AdmissionCycle | null>(null);

  const activeCycle = useMemo(
    () => (data ?? []).find((c) => c.isActive) ?? null,
    [data],
  );

  const sortedCycles = useMemo(() => {
    const rows = [...(data ?? [])];
    rows.sort((a, b) => {
      /* Active row pinned at top regardless of status. */
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
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
          {
            key: 'isActive',
            labelAr: 'حالة التفعيل',
            format: (v) => (v ? ACTIVE_LABEL : INACTIVE_LABEL),
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

  const confirmActivate = (): void => {
    if (!activateTarget) return;
    setActiveMut.mutate(activateTarget.id, {
      onSuccess: () => {
        toast(`تم تفعيل دورة "${activateTarget.nameAr}"`, 'success');
        setActivateTarget(null);
      },
      onError: (err) => {
        toast((err as Error).message, 'danger');
      },
    });
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
      key: 'isActive',
      label: 'حالة التفعيل',
      render: (c) =>
        c.isActive ? (
          <Badge tone="success">
            <IconStamp width={12} height={12} className="me-1 inline-block" />
            {ACTIVE_LABEL}
          </Badge>
        ) : (
          <Badge tone="neutral">{INACTIVE_LABEL}</Badge>
        ),
    },
    {
      key: '_actions',
      label: <span className="sr-only">إجراءات</span>,
      align: 'end',
      render: (c) => {
        const isLocked = toListStatus(c.status) === 'published';
        const isSetupDisabled = !c.isActive;

        /* Setup button — primary look on the active row; aria-disabled +
         * tooltip on every other row. We omit native `disabled` on the
         * locked variant so the tooltip can still hover/focus-attach. */
        const setupButton = (
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Settings2 size={12} strokeWidth={1.75} />}
            aria-disabled={isSetupDisabled || undefined}
            className={
              isSetupDisabled
                ? 'cursor-not-allowed opacity-60 hover:bg-teal-500'
                : undefined
            }
            onClick={() => {
              if (isSetupDisabled) return;
              navigate(ROUTES.admin.admissionSetup.index);
            }}
          >
            إعداد القبول
          </Button>
        );
        const setupSlot = isSetupDisabled ? (
          <Tooltip content={SETUP_LOCKED_HINT}>
            <span tabIndex={0} aria-label={SETUP_LOCKED_HINT} className="inline-flex">
              {setupButton}
            </span>
          </Tooltip>
        ) : (
          setupButton
        );

        /* Activate button — hidden on the already-active row. */
        const activateSlot = c.isActive ? null : (
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Power size={12} strokeWidth={1.75} />}
            onClick={() => setActivateTarget(c)}
          >
            تفعيل
          </Button>
        );

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
        const editSlot = isLocked ? (
          <Tooltip content={LOCKED_EDIT_HINT}>
            <span tabIndex={0} aria-label={LOCKED_EDIT_HINT} className="inline-flex">
              {editButton}
            </span>
          </Tooltip>
        ) : (
          editButton
        );

        return (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {setupSlot}
            {activateSlot}
            {editSlot}
          </div>
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
                  الدورة النشطة: {activeCycle.nameAr}
                </p>
                <p className="mt-0.5 text-2xs text-ink-500">
                  {fmtDate(activeCycle.openDate, 'short')} إلى{' '}
                  {fmtDate(activeCycle.closeDate, 'short')}
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                leadingIcon={<Settings2 size={14} strokeWidth={1.75} />}
                onClick={() => navigate(ROUTES.admin.admissionSetup.index)}
              >
                إعداد القبول
              </Button>
              <Badge tone="success">
                <IconStamp width={12} height={12} className="me-1 inline-block" />
                {ACTIVE_LABEL}
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

        <AlertDialog
          open={activateTarget !== null}
          onOpenChange={(next) => {
            if (!next) setActivateTarget(null);
          }}
          title="تأكيد تفعيل الدورة"
          description={
            activateTarget ? (
              <>
                سيتم تفعيل دورة{' '}
                <strong className="font-semibold text-ink-900">
                  &quot;{activateTarget.nameAr}&quot;
                </strong>{' '}
                وإلغاء تفعيل أي دورة أخرى نشطة حالياً (دورة واحدة فقط يمكن أن تكون
                نشطة في كل وقت). هل تريد المتابعة؟
              </>
            ) : null
          }
          actionLabel="تأكيد التفعيل"
          cancelLabel="إلغاء"
          tone="danger"
          isActionLoading={setActiveMut.isPending}
          onAction={confirmActivate}
        />

      </CenteredShell>
    </TooltipProvider>
  );
}
