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
  PowerOff,
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
  useCycleDeactivate,
  useCycleRemove,
  useCycleSetActive,
} from '../api/cycles.queries';
import {
  LIST_STATUS_LABEL,
  LIST_STATUS_TONE,
  toListStatus,
  type CycleListStatus,
} from '../components/cycles/cycleListStatus';

const SETUP_LOCKED_HINT = 'متاح فقط للدورة النشطة';

const ACTIVE_LABEL = 'نشطة';
const INACTIVE_LABEL = 'غير نشطة';
const COHORT_LABEL: Record<AdmissionCycle['cohort'], string> = {
  male: 'ذكور',
  female: 'إناث',
};

/* Drafts (إدراج ومراجعة) bubble to the top; published rows follow,
 * ordered by year desc. */
const LIST_STATUS_PRIORITY: Record<CycleListStatus, number> = {
  review: 0,
  published: 1,
};

export function CyclesPage(): JSX.Element {
  const navigate = useNavigate();
  const { data, isLoading } = useCycles();
  const setActiveMut = useCycleSetActive();
  const deactivateMut = useCycleDeactivate();
  const removeMut = useCycleRemove();

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
  const [deactivateTarget, setDeactivateTarget] = useState<AdmissionCycle | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdmissionCycle | null>(null);

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
      return a.nameAr.localeCompare(b.nameAr, 'ar');
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

  const confirmDeactivate = (): void => {
    if (!deactivateTarget) return;
    deactivateMut.mutate(deactivateTarget.id, {
      onSuccess: () => {
        toast(`تم إلغاء تفعيل دورة "${deactivateTarget.nameAr}"`, 'success');
        setDeactivateTarget(null);
      },
      onError: (err) => {
        toast((err as Error).message, 'danger');
      },
    });
  };

  const confirmDelete = (): void => {
    if (!deleteTarget || deleteTarget.isActive) return;
    removeMut.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast(`تم حذف دورة "${deleteTarget.nameAr}"`, 'success');
        setDeleteTarget(null);
      },
      onError: (err) => {
        toast((err as Error).message || 'تعذر حذف الدورة', 'danger');
      },
    });
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
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">
              <span className="font-numeric tnum">{c.year}</span>
            </Badge>
            <Badge tone="neutral">{COHORT_LABEL[c.cohort]}</Badge>
            <span className="font-mono text-2xs text-ink-400" dir="ltr">
              {c.id}
            </span>
          </div>
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
        const ls = toListStatus(c.status);
        return <Badge tone={LIST_STATUS_TONE[ls]}>{LIST_STATUS_LABEL[ls]}</Badge>;
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

        const activeToggleSlot = c.isActive ? (
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<PowerOff size={12} strokeWidth={1.75} />}
            onClick={() => setDeactivateTarget(c)}
          >
            إلغاء التفعيل
          </Button>
        ) : (
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

        const deleteSlot = c.isActive ? null : (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Trash2 size={12} strokeWidth={1.75} />}
            onClick={() => setDeleteTarget(c)}
          >
            حذف
          </Button>
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
          open={deactivateTarget !== null}
          onOpenChange={(next) => {
            if (!next) setDeactivateTarget(null);
          }}
          title="تأكيد إلغاء تفعيل الدورة"
          description={
            deactivateTarget ? (
              <>
                سيتم إلغاء تفعيل دورة{' '}
                <strong className="font-semibold text-ink-900">
                  &quot;{deactivateTarget.nameAr}&quot;
                </strong>
                . يمكن أن تبقى المنظومة بدون دورة نشطة حتى يتم تفعيل دورة أخرى.
              </>
            ) : null
          }
          actionLabel="إلغاء التفعيل"
          cancelLabel="إلغاء"
          tone="danger"
          isActionLoading={deactivateMut.isPending}
          onAction={confirmDeactivate}
        />

        <AlertDialog
          open={deleteTarget !== null}
          onOpenChange={(next) => {
            if (!next) setDeleteTarget(null);
          }}
          title="تأكيد حذف الدورة"
          description={
            deleteTarget ? (
              <>
                سيتم حذف دورة{' '}
                <strong className="font-semibold text-ink-900">
                  &quot;{deleteTarget.nameAr}&quot;
                </strong>
                . لا يمكن حذف الدورة النشطة، ولا يمكن حذف دورة مرتبطة بسجلات تشغيلية.
              </>
            ) : null
          }
          actionLabel="حذف"
          cancelLabel="إلغاء"
          tone="danger"
          isActionLoading={removeMut.isPending}
          onAction={confirmDelete}
        />

      </CenteredShell>
    </TooltipProvider>
  );
}
