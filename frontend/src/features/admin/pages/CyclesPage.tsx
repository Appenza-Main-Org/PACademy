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
  CalendarDays,
  CalendarRange,
  Gauge,
  Layers3,
  Pencil,
  Plus,
  Power,
  Settings2,
  Users,
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
import { date as formatDate, num } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import { useCycles, useCycleSetActive } from '../api/cycles.queries';
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

  const cycleSummary = useMemo(() => {
    const rows = data ?? [];
    return {
      total: rows.length,
      review: rows.filter((c) => toListStatus(c.status) === 'review').length,
      published: rows.filter((c) => toListStatus(c.status) === 'published').length,
      applicants: rows.reduce((sum, c) => sum + c.applicantCount, 0),
    };
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
      key: 'window',
      label: 'فترة التقديم',
      sortable: true,
      getSortValue: (c) => new Date(c.openDate),
      render: (c) => (
        <div className="min-w-[9rem] text-2xs leading-5 text-ink-600">
          <div className="font-medium text-ink-800">
            {formatDate(c.openDate, 'short')}
          </div>
          <div>{formatDate(c.closeDate, 'short')}</div>
        </div>
      ),
    },
    {
      key: 'capacity',
      label: 'السعة والمتقدمون',
      sortable: true,
      getSortValue: (c) => c.applicantCount,
      render: (c) => {
        const fill = cycleFillPercent(c);
        return (
          <div className="min-w-[9rem]">
            <div className="flex items-center justify-between gap-3 text-2xs text-ink-600">
              <span>
                <span className="font-numeric tnum font-semibold text-ink-900">
                  {num(c.applicantCount)}
                </span>{' '}
                متقدم
              </span>
              <span className="font-numeric tnum">{fill}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-pill bg-ink-100">
              <span
                className="block h-full rounded-pill bg-teal-500"
                style={{ inlineSize: `${fill}%` }}
              />
            </div>
            <p className="m-0 mt-1 font-ar text-2xs text-ink-500">
              من {num(c.expectedCapacity)} مقعد متوقع
            </p>
          </div>
        );
      },
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

        return (
          <div className="flex min-w-[13rem] flex-wrap items-center justify-end gap-1.5">
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

        <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          {activeCycle ? (
            <Card variant="elevated" className="overflow-hidden p-0">
              <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_17rem]">
                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex size-10 items-center justify-center rounded-md bg-teal-50 text-teal-700">
                      <CalendarRange size={20} strokeWidth={1.75} />
                    </span>
                    <Badge tone="success" dot>
                      {ACTIVE_LABEL}
                    </Badge>
                    <Badge tone={LIST_STATUS_TONE[toListStatus(activeCycle.status)]}>
                      {LIST_STATUS_LABEL[toListStatus(activeCycle.status)]}
                    </Badge>
                  </div>

                  <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="m-0 font-ar text-xs font-medium text-ink-500">
                        الدورة النشطة الآن
                      </p>
                      <h2 className="m-0 mt-1 font-ar-display text-2xl font-bold leading-9 text-ink-900">
                        {activeCycle.nameAr}
                      </h2>
                    </div>
                    <Button
                      variant="primary"
                      leadingIcon={<Settings2 size={14} strokeWidth={1.75} />}
                      onClick={() => openSetupWizard(activeCycle.id)}
                    >
                      إعداد التقديم
                    </Button>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <CycleMetric
                      icon={<CalendarDays size={16} strokeWidth={1.75} />}
                      label="السنة"
                      value={num(activeCycle.year)}
                    />
                    <CycleMetric
                      icon={<Layers3 size={16} strokeWidth={1.75} />}
                      label="الفئات المفتوحة"
                      value={num(countOpenCategories(activeCycle))}
                    />
                    <CycleMetric
                      icon={<Users size={16} strokeWidth={1.75} />}
                      label="المتقدمون"
                      value={num(activeCycle.applicantCount)}
                    />
                    <CycleMetric
                      icon={<Gauge size={16} strokeWidth={1.75} />}
                      label="نسبة الإشغال"
                      value={`${cycleFillPercent(activeCycle)}%`}
                    />
                  </div>
                </div>

                <div className="border-t border-border-subtle bg-teal-50/40 p-5 lg:border-t-0 lg:border-s">
                  <p className="m-0 font-ar text-xs font-semibold text-ink-800">
                    نافذة التقديم
                  </p>
                  <div className="mt-3 space-y-3">
                    <DateLine label="البداية" value={formatDate(activeCycle.openDate, 'short')} />
                    <DateLine label="النهاية" value={formatDate(activeCycle.closeDate, 'short')} />
                    <DateLine label="المتبقي" value={cycleRemainingLabel(activeCycle)} />
                  </div>
                </div>
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

          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="m-0 font-ar text-sm font-bold text-ink-900">
                  ملخص الدورات
                </h3>
                <p className="m-0 mt-1 font-ar text-2xs text-ink-500">
                  قراءة سريعة قبل إدارة الجدول.
                </p>
              </div>
              <Badge tone="info">{num(cycleSummary.total)} دورات</Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <SummaryTile label="قيد المراجعة" value={num(cycleSummary.review)} />
              <SummaryTile label="منشورة" value={num(cycleSummary.published)} />
              <SummaryTile
                label="إجمالي المتقدمين"
                value={num(cycleSummary.applicants)}
                className="col-span-2"
              />
            </div>
          </Card>
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

      </CenteredShell>
    </TooltipProvider>
  );
}

function countOpenCategories(cycle: AdmissionCycle): number {
  return Object.values(cycle.openCategories ?? {}).filter((config) => config?.isOpen)
    .length;
}

function cycleFillPercent(cycle: AdmissionCycle): number {
  if (cycle.expectedCapacity <= 0) return 0;
  return Math.min(100, Math.round((cycle.applicantCount / cycle.expectedCapacity) * 100));
}

function cycleRemainingLabel(cycle: AdmissionCycle): string {
  const close = new Date(cycle.closeDate).getTime();
  if (Number.isNaN(close)) return '—';
  const days = Math.ceil((close - Date.now()) / 86_400_000);
  if (days < 0) return 'انتهت';
  if (days === 0) return 'اليوم';
  return `${num(days)} يوم`;
}

interface CycleMetricProps {
  icon: JSX.Element;
  label: string;
  value: string;
}

function CycleMetric({ icon, label, value }: CycleMetricProps): JSX.Element {
  return (
    <div className="rounded-md border border-border-subtle bg-ink-50/60 p-3">
      <div className="flex items-center gap-2 text-ink-500">
        <span className="text-teal-700">{icon}</span>
        <span className="font-ar text-2xs font-medium">{label}</span>
      </div>
      <p className="m-0 mt-2 font-numeric text-xl font-semibold leading-none text-ink-900">
        {value}
      </p>
    </div>
  );
}

function DateLine({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-surface-card px-3 py-2">
      <span className="font-ar text-2xs text-ink-500">{label}</span>
      <span className="font-ar text-xs font-semibold text-ink-900">{value}</span>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('rounded-md border border-border-subtle bg-ink-50/60 p-3', className)}>
      <p className="m-0 font-ar text-2xs text-ink-500">{label}</p>
      <p className="m-0 mt-1 font-numeric text-lg font-semibold leading-none text-ink-900">
        {value}
      </p>
    </div>
  );
}
