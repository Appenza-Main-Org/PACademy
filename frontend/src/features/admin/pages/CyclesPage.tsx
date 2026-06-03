/**
 * CyclesPage — list of admission cycles.
 *
 * Columns mirror the Add form (CycleNewPage) field set 1:1, plus the
 * orthogonal active flag and per-row actions:
 *   اسم الدورة · حالة الدورة · حالة التفعيل · إجراءات.
 *
 * Status (review/published) and isActive are independent — see
 * cycleListStatus.ts and AdmissionCycle.isActive. Activating a cycle is a
 * separate concern from editing its status, and the mock service upholds
 * the single-active invariant atomically.
 *
 * Per-row actions:
 *   • تعديل      — routes to the dedicated edit page for this cycle.
 *                  Available regardless of status.
 *   • تفعيل      — flips isActive on the row (and clears it on every
 *                  other cycle). Confirms via AlertDialog. The currently
 *                  active row gets a "نشطة" badge in place of the button.
 *   • إعداد التقديم — pins the row's cycle in sessionStorage and lands
 *                     the user in the first wizard step
 *                     (`application_settings`). Aria-disabled + tooltip
 *                     ("متاح فقط للدورة النشطة") for non-active rows.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CalendarRange,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Settings2,
  Trash2,
} from 'lucide-react';
import { ADMISSION_SETUP_CYCLE_STORAGE_KEY } from '@/features/admin/admission-setup/config';
import {
  AlertDialog,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  IconStamp,
  PageHeader,
  Select,
  SoftDeleteDialog,
  toast,
  Tooltip,
  TooltipProvider,
} from '@/shared/components';
import type { DataTableColumn, ListActionsConfig } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import type { AdmissionCycle } from '@/shared/types/domain';
import {
  useCycles,
  useCycleDependencies,
  useCycleRestore,
  useCycleSetActive,
  useCycleSoftDelete,
  useCycleUpdateStatus,
} from '../api/cycles.queries';
import {
  canDeleteAdmissionCycle,
  cycleDeleteBlockedReason,
} from '../lib/cycle-delete-guard';
import {
  fromListStatus,
  LIST_STATUS_LABEL,
  LIST_STATUS_OPTIONS,
  LIST_STATUS_TONE,
  toListStatus,
  type CycleListStatus,
} from '../components/cycles/cycleListStatus';

const SETUP_LOCKED_HINT = 'متاح فقط للدورة النشطة';
const CYCLE_DEP_LABELS: Record<string, string> = {
  applicants: 'طلب متقدم',
  applications: 'طلب متقدم',
  submissions: 'طلب متقدم',
  committees: 'لجنة',
  payments: 'عملية دفع',
  examPlans: 'خطة اختبار',
};

const ACTIVE_LABEL = 'نشطة';
const INACTIVE_LABEL = 'غير نشطة';
/* Drafts (إدراج ومراجعة) bubble to the top; published rows follow. */
const LIST_STATUS_PRIORITY: Record<CycleListStatus, number> = {
  review: 0,
  published: 1,
};

function cycleSortTime(cycle: AdmissionCycle): number {
  const stamp = cycle.updatedAt ?? cycle.createdAt ?? cycle.openDate;
  const time = new Date(stamp).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function CyclesPage(): JSX.Element {
  const navigate = useNavigate();
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const { data, isLoading } = useCycles({ includeDeleted });
  const setActiveMut = useCycleSetActive();
  const updateStatusMut = useCycleUpdateStatus();
  const softDeleteMut = useCycleSoftDelete();
  const restoreMut = useCycleRestore();

  /* Land in the first wizard step (إعدادات التقديم) and pin the chosen
   * cycle in sessionStorage so the wizard page can resolve it on mount. */
  const openSetupWizard = (cycleId: string): void => {
    try {
      sessionStorage.setItem(ADMISSION_SETUP_CYCLE_STORAGE_KEY, cycleId);
    } catch {
      /* sessionStorage unavailable — wizard will fall back to active cycle. */
    }
    navigate(ROUTES.admin.admissionSetup.wizard('application_settings'));
  };

  const [activateTarget, setActivateTarget] = useState<AdmissionCycle | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdmissionCycle | null>(null);
  const [statusTarget, setStatusTarget] = useState<{
    cycle: AdmissionCycle;
    next: CycleListStatus;
  } | null>(null);
  const deleteDepsQuery = useCycleDependencies(deleteTarget?.id ?? null);

  const activeCycle = useMemo(
    () => (data ?? []).find((c) => c.isActive && !c.deletedAt) ?? null,
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
      const byUpdated = cycleSortTime(b) - cycleSortTime(a);
      if (byUpdated !== 0) return byUpdated;
      return a.nameAr.localeCompare(b.nameAr, 'ar');
    });
    return rows;
  }, [data]);

  const listActions: ListActionsConfig<AdmissionCycle> = useMemo(
    () => ({
      entityKey: 'admin.cycles',
      entityLabelAr: 'دورات القبول',
      auditModule: 'cycles',
      deleted: {
        enabled: true,
        isShowing: includeDeleted,
        onToggle: setIncludeDeleted,
        isDeleted: (c) => Boolean(c.deletedAt),
      },
      export: {
        enabled: true,
        formats: ['csv', 'xlsx'],
        filenamePrefix: 'دورات-القبول-',
        columns: [
          { key: 'nameAr', labelAr: 'اسم الدورة' },
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
    [includeDeleted],
  );

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

  const confirmStatusChange = (): void => {
    if (!statusTarget) return;
    const { cycle, next } = statusTarget;
    const current = toListStatus(cycle.status);
    if (current === next) {
      setStatusTarget(null);
      return;
    }

    if (next === 'published') {
      setActiveMut.mutate(cycle.id, {
        onSuccess: () => {
          toast(`تم اعتماد ونشر دورة "${cycle.nameAr}" وتفعيلها`, 'success');
          setStatusTarget(null);
        },
        onError: (err) => {
          toast((err as Error).message, 'danger');
        },
      });
      return;
    }

    updateStatusMut.mutate({ id: cycle.id, next: fromListStatus(next) }, {
      onSuccess: () => {
        toast(`تم تغيير حالة دورة "${cycle.nameAr}" إلى ${LIST_STATUS_LABEL[next]}`, 'success');
        setStatusTarget(null);
      },
      onError: (err) => {
        toast((err as Error).message, 'danger');
      },
    });
  };

  const confirmDelete = async (reason: string): Promise<void> => {
    if (!deleteTarget) return;
    const blockedReason = cycleDeleteBlockedReason(deleteTarget);
    if (blockedReason) {
      toast(blockedReason, 'warning');
      setDeleteTarget(null);
      return;
    }
    await softDeleteMut.mutateAsync({ id: deleteTarget.id, reason });
    toast(`تم حذف دورة "${deleteTarget.nameAr}"`, 'success');
  };

  const columns: DataTableColumn<AdmissionCycle>[] = [
    {
      key: 'nameAr',
      label: 'الدورة',
      sortable: true,
      getSortValue: (c) => c.nameAr,
      filter: { kind: 'text', getValue: (c) => c.nameAr },
      render: (c) => (
        <div className="min-w-[11rem]">
          <Link
            to={ROUTES.admin.cycleDetail(c.id)}
            className="font-ar text-sm font-semibold text-teal-700 hover:underline"
          >
            {c.nameAr}
          </Link>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'حالة الدورة',
      sortable: true,
      getSortValue: (c) => toListStatus(c.status),
      filter: {
        kind: 'enum',
        getValue: (c) => toListStatus(c.status),
        options: (Object.keys(LIST_STATUS_LABEL) as CycleListStatus[]).map((k) => ({
          value: k,
          label: LIST_STATUS_LABEL[k],
        })),
      },
      render: (c) => {
        if (c.deletedAt) return <Badge tone="warning">محذوف</Badge>;
        const ls = toListStatus(c.status);
        return (
          <div className="min-w-[10rem]">
            <Select
              aria-label={`حالة دورة ${c.nameAr}`}
              value={ls}
              options={LIST_STATUS_OPTIONS}
              containerClassName="min-w-[9.5rem]"
              className={
                ls === 'published'
                  ? 'h-9 rounded-full border-teal-100 bg-teal-50 py-1.5 pe-8 ps-3 text-xs font-semibold text-teal-700'
                  : 'h-9 rounded-full border-ink-100 bg-ink-50 py-1.5 pe-8 ps-3 text-xs font-semibold text-ink-700'
              }
              disabled={setActiveMut.isPending || updateStatusMut.isPending}
              onChange={(event) => {
                const next = event.currentTarget.value as CycleListStatus;
                if (next === ls) return;
                setStatusTarget({ cycle: c, next });
              }}
            />
          </div>
        );
      },
    },
    {
      key: 'isActive',
      label: 'التفعيل',
      sortable: true,
      getSortValue: (c) => (c.isActive ? 1 : 0),
      filter: {
        kind: 'enum',
        getValue: (c) => (c.isActive ? 'active' : 'inactive'),
        options: [
          { value: 'active', label: ACTIVE_LABEL },
          { value: 'inactive', label: INACTIVE_LABEL },
        ],
      },
      render: (c) =>
        c.deletedAt ? (
          <Badge tone="warning">محذوف</Badge>
        ) : c.isActive ? (
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
        if (c.deletedAt) {
          return (
            <div className="flex min-w-[13rem] flex-wrap items-center justify-end gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<RotateCcw size={12} strokeWidth={1.75} />}
                onClick={() =>
                  restoreMut.mutate(c.id, {
                    onSuccess: () => toast(`تم استعادة "${c.nameAr}"`, 'success'),
                    onError: (err) => toast((err as Error).message, 'danger'),
                  })
                }
              >
                استعادة
              </Button>
            </div>
          );
        }
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
              openSetupWizard(c.id);
            }}
          >
            إعداد التقديم
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

        const activeToggleSlot = c.isActive ? null : (
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Power size={12} strokeWidth={1.75} />}
            onClick={() => setActivateTarget(c)}
          >
            تفعيل
          </Button>
        );

        /* Edit is unconditional now — every status is editable. */
        const editSlot = (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Pencil size={12} strokeWidth={1.75} />}
            onClick={() => navigate(ROUTES.admin.cycleEdit(c.id))}
          >
            تعديل
          </Button>
        );

        const deleteSlot = canDeleteAdmissionCycle(c) ? (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Trash2 size={12} strokeWidth={1.75} />}
            onClick={() => setDeleteTarget(c)}
          >
            حذف
          </Button>
        ) : (
          null
        );

        return (
          <div className="flex min-w-[13rem] flex-wrap items-center justify-end gap-1.5">
            {setupSlot}
            {activeToggleSlot}
            {editSlot}
            {deleteSlot}
          </div>
        );
      },
    },
  ];

  return (
    <TooltipProvider>
      <CenteredShell>
        <PageHeader
          title="دورات القبول وإعداد التقديم"
          subtitle="إدارة دورات القبول: الاسم وحالة الاعتماد والنشر."
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
              إضافة دورة
            </Button>
          }
        />

        <section className="mb-4">
          {activeCycle ? (
            <Card variant="elevated" className="overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-700">
                    <CalendarRange size={22} strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="success" dot>
                        {ACTIVE_LABEL}
                      </Badge>
                      <Badge tone={LIST_STATUS_TONE[toListStatus(activeCycle.status)]}>
                        {LIST_STATUS_LABEL[toListStatus(activeCycle.status)]}
                      </Badge>
                    </div>
                    <p className="m-0 mt-3 font-ar text-xs font-medium text-ink-500">
                      الدورة النشطة الآن
                    </p>
                    <h2 className="m-0 mt-1 font-ar-display text-2xl font-bold leading-9 text-ink-900">
                      {activeCycle.nameAr}
                    </h2>
                  </div>
                </div>
                <Button
                  variant="primary"
                  leadingIcon={<Settings2 size={14} strokeWidth={1.75} />}
                  onClick={() => openSetupWizard(activeCycle.id)}
                >
                  إعداد التقديم
                </Button>
              </div>
            </Card>
          ) : (
            <Card variant="elevated" className="flex min-h-[12rem] items-center justify-between gap-4">
              <div>
                <h2 className="m-0 font-ar-display text-xl font-bold text-ink-900">
                  لا توجد دورة نشطة
                </h2>
                <p className="m-0 mt-2 font-ar text-sm text-ink-500">
                  فعّل دورة واحدة حتى تظهر إعدادات التقديم وباقي مسارات الدورة.
                </p>
              </div>
              <Button
                variant="primary"
                leadingIcon={<Plus size={14} strokeWidth={1.75} />}
                onClick={() => navigate(ROUTES.admin.cycleNew)}
              >
                إضافة دورة
              </Button>
            </Card>
          )}
        </section>

        <Card className="p-0">
          <DataTable
            data={sortedCycles}
            columns={columns}
            rowKey={(c) => c.id}
            loading={isLoading}
            empty={<EmptyState variant="generic" title="لا توجد دورات حالياً" />}
            density="compact"
            zebraStripes
            listActions={listActions}
          />
        </Card>

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

        <AlertDialog
          open={statusTarget !== null}
          onOpenChange={(next) => {
            if (!next) setStatusTarget(null);
          }}
          title="تأكيد تغيير حالة الدورة"
          description={
            statusTarget ? (
              <>
                سيتم تغيير حالة دورة{' '}
                <strong className="font-semibold text-ink-900">
                  &quot;{statusTarget.cycle.nameAr}&quot;
                </strong>{' '}
                من {LIST_STATUS_LABEL[toListStatus(statusTarget.cycle.status)]} إلى{' '}
                {LIST_STATUS_LABEL[statusTarget.next]}.
                {statusTarget.next === 'published'
                  ? ' عند الاعتماد والنشر سيتم تفعيل هذه الدورة وإلغاء تفعيل أي دورة أخرى، لضمان وجود دورة نشطة واحدة فقط.'
                  : statusTarget.cycle.isActive
                    ? ' ستبقى هذه الدورة هي الدورة النشطة بعد الرجوع إلى إدراج ومراجعة حتى لا تبقى المنظومة بدون دورة نشطة.'
                    : ''}
              </>
            ) : null
          }
          actionLabel="تأكيد التغيير"
          cancelLabel="إلغاء"
          tone="primary"
          isActionLoading={setActiveMut.isPending || updateStatusMut.isPending}
          onAction={confirmStatusChange}
        />

        <SoftDeleteDialog
          open={deleteTarget !== null}
          entityNoun="هذه الدورة"
          entityLabel={deleteTarget?.nameAr ?? ''}
          dependencies={deleteDepsQuery.data ?? null}
          dependencyLabels={CYCLE_DEP_LABELS}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />

      </CenteredShell>
    </TooltipProvider>
  );
}
