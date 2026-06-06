/**
 * CyclesPage — list of admission cycles.
 *
 * Columns mirror the Add form (CycleNewPage) field set 1:1, plus per-row
 * actions:
 *   اسم الدورة · حالة الدورة · بداية التقديم · نهاية التقديم · إجراءات.
 *
 * Status (review/published) is the source of truth for active/inactive:
 * review means inactive; published means active. There is no separate
 * activation status on this surface.
 *
 * Per-row actions:
 *   • تعديل      — routes to the dedicated edit page for this cycle.
 *                  Available regardless of status.
 *   • إعداد التقديم — pins the row's cycle in sessionStorage and lands
 *                     the user in the first wizard step
 *                     (`application_settings`). Available before publishing
 *                     so admins can prepare review cycles.
 */

import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  CalendarRange,
  Pencil,
  Plus,
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
  PageHeader,
  SoftDeleteDialog,
  toast,
} from '@/shared/components';
import type { DataTableColumn, ListActionsConfig } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import type { AdmissionCycle } from '@/shared/types/domain';
import {
  useCycles,
  useCycleDependencies,
  useCycleRestore,
  useCycleSoftDelete,
  useCycleUpdateStatus,
} from '../api/cycles.queries';
import {
  resolveCycleApplicationPeriod,
  resolveCycleApplicationPeriodFromDraft,
  type CycleApplicationPeriod,
} from '../api/cycles.service';
import { applicationSettingsService } from '../admission-setup/api/applicationSettings.service';
import {
  canDeleteAdmissionCycle,
  cycleDeleteBlockedReason,
} from '../lib/cycle-delete-guard';
import {
  LIST_STATUS_LABEL,
  LIST_STATUS_TONE,
  isCycleActiveByListStatus,
  listStatusToCyclePatch,
  toListStatus,
  type CycleListStatus,
} from '../components/cycles/cycleListStatus';
import { CycleStatusToggle } from '../components/cycles/CycleStatusToggle';

const CYCLE_DEP_LABELS: Record<string, string> = {
  applicants: 'طلب متقدم',
  applications: 'طلب متقدم',
  submissions: 'طلب متقدم',
  committees: 'لجنة',
  payments: 'عملية دفع',
  examPlans: 'خطة اختبار',
};

/* Published rows bubble to the top because they are the active cycle. */
const LIST_STATUS_PRIORITY: Record<CycleListStatus, number> = {
  published: 0,
  review: 1,
};

const CYCLE_PERIODS_STALE_TIME_MS = 15_000;

function cycleSortTime(cycle: AdmissionCycle): number {
  const stamp = cycle.updatedAt ?? cycle.createdAt ?? cycle.openDate;
  const time = new Date(stamp).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function CyclesPage(): JSX.Element {
  const navigate = useNavigate();
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const { data, isLoading } = useCycles({ includeDeleted });
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
    navigate(`${ROUTES.admin.admissionSetup.wizard('application_settings')}?cycleId=${encodeURIComponent(cycleId)}`);
  };

  const [deleteTarget, setDeleteTarget] = useState<AdmissionCycle | null>(null);
  const [statusTarget, setStatusTarget] = useState<{
    cycle: AdmissionCycle;
    next: CycleListStatus;
  } | null>(null);
  const deleteDepsQuery = useCycleDependencies(deleteTarget?.id ?? null);

  const activeCycle = useMemo(
    () =>
      (data ?? []).find(
        (c) => isCycleActiveByListStatus(toListStatus(c.status)) && !c.deletedAt,
      ) ?? null,
    [data],
  );
  const activeCycleName = activeCycle?.nameAr ?? null;

  const sortedCycles = useMemo(() => {
    const rows = [...(data ?? [])];
    rows.sort((a, b) => {
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

  const cycleIds = useMemo(() => sortedCycles.map((cycle) => cycle.id), [sortedCycles]);
  const applicationPeriodsQuery = useQuery({
    queryKey: ['admin', 'cycles', 'application-periods', cycleIds],
    queryFn: () => fetchCycleApplicationPeriods(cycleIds),
    enabled: cycleIds.length > 0,
    staleTime: CYCLE_PERIODS_STALE_TIME_MS,
    gcTime: 5 * 60_000,
    retry: false,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
  const applicationPeriods = applicationPeriodsQuery.data ?? {};

  const getApplicationPeriod = useCallback(
    (cycle: AdmissionCycle): CycleApplicationPeriod =>
      applicationPeriods[cycle.id] ?? resolveCycleApplicationPeriod(cycle),
    [applicationPeriods],
  );

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
            key: 'openDate',
            labelAr: 'تاريخ بداية التقديم',
            format: (_v, row) => getApplicationPeriod(row).startDate,
          },
          {
            key: 'closeDate',
            labelAr: 'تاريخ نهاية التقديم',
            format: (_v, row) => getApplicationPeriod(row).endDate,
          },
        ],
      },
    }),
    [getApplicationPeriod, includeDeleted],
  );

  const confirmStatusChange = (): void => {
    if (!statusTarget) return;
    const { cycle, next } = statusTarget;
    const current = toListStatus(cycle.status);
    if (current === next) {
      setStatusTarget(null);
      return;
    }

    const patch = listStatusToCyclePatch(next);

    updateStatusMut.mutate(
      { id: cycle.id, next: patch.status, demoteCurrentActive: patch.isActive },
      {
        onSuccess: () => {
          toast(`تم تغيير حالة دورة "${cycle.nameAr}" إلى ${LIST_STATUS_LABEL[next]}`, 'success');
          setStatusTarget(null);
        },
        onError: (err) => {
          toast((err as Error).message, 'danger');
        },
      },
    );
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
          <div className="min-w-[15rem]">
            <CycleStatusToggle
              ariaLabel={`حالة دورة ${c.nameAr}`}
              value={ls}
              disabled={updateStatusMut.isPending}
              onChange={(next) => {
                if (next === ls) return;
                setStatusTarget({ cycle: c, next });
              }}
            />
          </div>
        );
      },
    },
    {
      key: 'applicationStartDate',
      label: 'بداية التقديم',
      sortable: true,
      getSortValue: (c) => getApplicationPeriod(c).startDate,
      numeric: true,
      width: '9rem',
      render: (c) => (
        <CycleDateCell value={getApplicationPeriod(c).startDate} />
      ),
    },
    {
      key: 'applicationEndDate',
      label: 'نهاية التقديم',
      sortable: true,
      getSortValue: (c) => getApplicationPeriod(c).endDate,
      numeric: true,
      width: '9rem',
      render: (c) => (
        <CycleDateCell value={getApplicationPeriod(c).endDate} />
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
        const setupSlot = (
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Settings2 size={12} strokeWidth={1.75} />}
            onClick={() => openSetupWizard(c.id)}
          >
            إعداد التقديم
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
            {editSlot}
            {deleteSlot}
          </div>
        );
      },
    },
  ];

  return (
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
                      <Badge tone={LIST_STATUS_TONE[toListStatus(activeCycle.status)]}>
                        {LIST_STATUS_LABEL[toListStatus(activeCycle.status)]}
                      </Badge>
                    </div>
                    <p className="m-0 mt-3 font-ar text-xs font-medium text-ink-500">
                      الدورة المعتمدة والمنشورة الآن
                    </p>
                    <h2 className="m-0 mt-1 font-ar-display text-2xl font-bold leading-9 text-ink-900">
                      {activeCycle.nameAr}
                    </h2>
                    <p className="m-0 mt-2 font-ar text-sm text-ink-600">
                      فترة التقديم:{' '}
                      <span className="font-numeric tnum" dir="ltr">
                        {formatApplicationPeriod(getApplicationPeriod(activeCycle))}
                      </span>
                    </p>
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
                  يمكن إعداد التقديم من أي دورة قيد المراجعة. تظهر الدورة للمتقدمين فقط بعد الاعتماد والنشر.
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
                  ? activeCycleName && activeCycleName !== statusTarget.cycle.nameAr
                    ? ` الاعتماد والنشر يجعل هذه الدورة هي الدورة النشطة ويلغي نشر "${activeCycleName}" حتى تبقى دورة واحدة فقط في اعتماد ونشر.`
                    : ' الاعتماد والنشر يجعل هذه الدورة هي الدورة النشطة، ولا يمكن أن تبقى أكثر من دورة واحدة في اعتماد ونشر.'
                  : ' الرجوع إلى إدراج ومراجعة يجعل الدورة غير نشطة.'}
              </>
            ) : null
          }
          actionLabel="تأكيد التغيير"
          cancelLabel="إلغاء"
          tone="primary"
          isActionLoading={updateStatusMut.isPending}
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
  );
}

async function fetchCycleApplicationPeriods(
  cycleIds: readonly string[],
): Promise<Record<string, CycleApplicationPeriod>> {
  const entries = await Promise.all(
    cycleIds.map(async (cycleId) => {
      try {
        const draft = await applicationSettingsService.getCycleDraft(cycleId);
        const period = resolveCycleApplicationPeriodFromDraft(draft);
        return period ? ([cycleId, period] as const) : null;
      } catch {
        return null;
      }
    }),
  );

  return Object.fromEntries(
    entries.filter((entry): entry is readonly [string, CycleApplicationPeriod] =>
      entry !== null,
    ),
  );
}

function formatApplicationPeriod(period: CycleApplicationPeriod): string {
  return `${period.startDate || '—'} → ${period.endDate || '—'}`;
}

function CycleDateCell({ value }: { value: string }): JSX.Element {
  return (
    <span
      className="inline-flex min-w-[7.5rem] justify-center rounded-md border border-border-subtle bg-ink-50 px-2.5 py-1 font-numeric text-xs text-ink-700 shadow-xs tnum"
      dir="ltr"
    >
      {value || '—'}
    </span>
  );
}
