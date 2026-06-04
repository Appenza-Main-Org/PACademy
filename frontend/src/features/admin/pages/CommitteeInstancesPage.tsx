/**
 * /admin/committees-exam-config — committee instances management.
 *
 * Lists every CommitteeInstance configured for the **active cycle**,
 * grouped by exam day. Each day section lists the committees sitting on
 * that day with their category and reserved-applicant count. Same record
 * set the admission-setup wizard step authors at
 * `/admin/cycles/admission-setup/wizard/committees`.
 *
 * Cycle scope:
 *   - The page is locked to the currently active cycle. No URL-based
 *     selection, no in-page picker — admins manage other cycles via
 *     the admission-setup wizard.
 *   - When no cycle is active the page renders an empty state nudging
 *     the admin to activate one.
 *
 * المحجوز column:
 *   - Renders a single integer. Capacity is not surfaced here at all,
 *     and the displayed value is **clamped** to `سعة اللجنة` so the UI
 *     never shows a reservation count higher than the configured
 *     capacity — even if the underlying record has drifted (e.g. an
 *     historic over-allocation that the new invariant should mask).
 */

import { useEffect, useMemo, useState } from 'react';
import { RefreshCcw, Trash2 } from 'lucide-react';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import {
  Accordion,
  AlertDialog,
  Button,
  Card,
  EmptyState,
  LoadingState,
  PageHeader,
  toast,
} from '@/shared/components';
import { date as fmtDate, num } from '@/shared/lib/format';
import { ROUTES } from '@/config/routes';
import { useActiveCycle } from '../api/cycles.queries';
import { useLookup } from '@/features/lookups';
import {
  useCommitteeInstances,
  useRefreshReservedCountsMutation,
  useRemoveCommitteeInstanceMutation,
  useRemoveCommitteeInstanceDayMutation,
  useUpdateCommitteeInstanceMutation,
} from '@/features/committees';
import type {
  AdmissionCycle,
  CommitteeInstance,
} from '@/shared/types/domain';
import {
  CommitteeInstanceAddForm,
  useActiveCategoriesForCycle,
} from '@/features/admin/admission-setup';
import {
  useAcademyExams,
  useCycleExamPlans,
} from '@/features/admin/api/examPlans.queries';
import {
  resolveExpandedDates,
  useDayExpansionStore,
} from './committee-instances/expansionStore';

interface InstanceRow extends CommitteeInstance {
  categoryLabelAr: string;
  /** Underlying committee definition name. Kept on the row so delete
   *  dialogs, aria-labels, and the «حجوزات» list keep showing the
   *  concrete committee — only the visible exam-name column is wired
   *  off this value. */
  committeeName: string;
  /** Joined exam plan for the row's category, e.g.
   *  «اختبار اللياقة · الكشف الطبي · المقابلة». Sourced from the
   *  admission-setup «إدارة الاختبارات» wizard step. */
  examLabel: string;
}

/** Aggregate view-row: one entry per (categoryKey × date) collapsing
 *  every underlying CommitteeInstance for that category-day. The add
 *  form's mental model is «pick a category» — fan-out to physical
 *  committees is internal — so the management page mirrors that:
 *  one visible row per category. Capacity and reservations cascade
 *  through `instances` on edit/delete. */
interface AggregatedRow {
  id: string;
  date: string;
  categoryKey: string;
  categoryLabelAr: string;
  examLabel: string;
  committeeCount: number;
  /** Uniform per-committee capacity, or null when underlying instances
   *  disagree (rare; only happens if some committees were edited from
   *  the wizard surface individually). */
  perCommitteeCapacity: number | null;
  totalReserved: number;
  reservedRefreshedAt: string;
  instances: InstanceRow[];
}

interface DayGroup {
  date: string;
  rows: AggregatedRow[];
  /** Underlying committee-instance count, surfaced in the day header
   *  badge so admins still see «X لجنة» reflecting physical committees,
   *  not the aggregated category count. */
  instanceCount: number;
}

function normalizeNonNegativeInteger(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

/** Reserved is hard-capped at capacity for display purposes — the
 *  invariant the user requested: «المحجوز can't exceed سعة اللجنة».
 *  Capacity = 0 falls back to the raw value (defensive: an unset
 *  capacity shouldn't blank the count). */
function effectiveReserved(row: { reserved: unknown; capacity: unknown }): number {
  const reserved = normalizeNonNegativeInteger(row.reserved);
  const capacity = normalizeNonNegativeInteger(row.capacity);
  if (capacity <= 0) return reserved;
  return Math.min(reserved, capacity);
}

/** Today, normalised to local midnight, as a yyyy-mm-dd ISO string.
 *  Past days are filtered against this — admins shouldn't see or be
 *  able to transfer to days that have already happened. */
function todayIsoLocal(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isPastDay(date: string): boolean {
  return date < todayIsoLocal();
}

export function CommitteeInstancesPage(): JSX.Element {
  const activeCycleQuery = useActiveCycle();
  const allInstancesQuery = useCommitteeInstances();
  const definitionsQuery = useLookup('committees');
  const categoriesQuery = useLookup('applicant-categories');

  const activeCycle = activeCycleQuery.data ?? null;
  const activeCycleId = activeCycle?.id ?? null;

  /* Exam plans drive the «اسم الاختبار» column. Each category in the
   * active cycle has an ordered exam plan authored at
   * /admin/cycles/admission-setup/wizard/exams. We join the plan's
   * exam names (in order) and show that string for every committee
   * row under the matching category — committees themselves don't
   * link to a specific exam in the domain model. */
  const academyExamsQuery = useAcademyExams();
  const cycleExamPlansQuery = useCycleExamPlans(activeCycleId);

  /* Active categories for the cycle — feeds the inline «إضافة موعد اختبار»
   * form so admins can author the same (committee × date × capacity)
   * rows the admission-setup wizard would. The cycleId arg is currently
   * advisory (see lib/activeCategories.ts) but passed through anyway so
   * the call site keeps the right shape for the day it becomes
   * cycle-scoped. */
  const activeCategoriesQuery = useActiveCategoriesForCycle(activeCycleId ?? '');
  const activeCategoriesForForm = useMemo(
    () =>
      (activeCategoriesQuery.data ?? [])
        .map((c) => ({
          key: c.code,
          labelAr: c.nameAr,
        })),
    [activeCategoriesQuery.data],
  );

  const categoryLabelByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of categoriesQuery.data ?? []) map.set(r.code, r.name);
    return map;
  }, [categoriesQuery.data]);
  const activeCategoryCodes = useMemo(
    () =>
      new Set(
        (categoriesQuery.data ?? [])
          .filter((category) => category.isActive)
          .map((category) => category.code),
      ),
    [categoriesQuery.data],
  );

  const definitionNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of definitionsQuery.data ?? []) map.set(d.code, d.name);
    return map;
  }, [definitionsQuery.data]);

  const examNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of academyExamsQuery.data ?? []) map.set(e.id, e.nameAr);
    return map;
  }, [academyExamsQuery.data]);

  /** categoryKey → «اختبار اللياقة · الكشف الطبي · …» */
  const examLabelByCategory = useMemo(() => {
    const map = new Map<string, string>();
    for (const plan of cycleExamPlansQuery.data ?? []) {
      const names = [...plan.exams]
        .sort((a, b) => a.order - b.order)
        .map((entry) => examNameById.get(entry.examId))
        .filter((label): label is string => Boolean(label && label.length > 0));
      if (names.length > 0) map.set(plan.categoryId, names.join(' · '));
    }
    return map;
  }, [cycleExamPlansQuery.data, examNameById]);

  const rows = useMemo<InstanceRow[]>(() => {
    if (!activeCycleId) return [];
    return (allInstancesQuery.data ?? [])
      .filter((i) => i.cycleId === activeCycleId)
      .filter((i) => activeCategoryCodes.has(i.categoryKey))
      .map((inst) => ({
        ...inst,
        capacity: normalizeNonNegativeInteger(inst.capacity),
        reserved: normalizeNonNegativeInteger(inst.reserved),
        categoryLabelAr: categoryLabelByKey.get(inst.categoryKey) ?? inst.categoryKey,
        committeeName: definitionNameByCode.get(inst.definitionCode) ?? inst.definitionCode,
        examLabel: examLabelByCategory.get(inst.categoryKey) ?? '',
      }));
  }, [
    allInstancesQuery.data,
    activeCycleId,
    activeCategoryCodes,
    categoryLabelByKey,
    definitionNameByCode,
    examLabelByCategory,
  ]);

  /* Group rows by date, then aggregate underlying committee instances
   * by category so each category appears once per day. The add form's
   * unit-of-work is «category × date», fanning out to physical
   * committees internally — this page mirrors that mental model.
   * Every day the wizard authored is rendered — past, present, future —
   * so admins can audit completed exam days and keep parity with what
   * they see in the admission-setup wizard. */
  const dayGroups = useMemo<DayGroup[]>(() => {
    const arabicCmp = (a: string, b: string): number =>
      a.localeCompare(b, 'ar', { numeric: true });
    const bucket = new Map<string, InstanceRow[]>();
    for (const r of rows) {
      const list = bucket.get(r.date);
      if (list) list.push(r);
      else bucket.set(r.date, [r]);
    }
    return Array.from(bucket.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, rs]) => {
        const byCategory = new Map<string, InstanceRow[]>();
        for (const r of rs) {
          const list = byCategory.get(r.categoryKey);
          if (list) list.push(r);
          else byCategory.set(r.categoryKey, [r]);
        }
        const aggregated: AggregatedRow[] = Array.from(byCategory.entries()).map(
          ([categoryKey, instances]) => {
            const capacities = instances.map((i) => i.capacity);
            const uniform = capacities.every((c) => c === capacities[0]);
            const totalReserved = instances.reduce(
              (sum, i) => sum + effectiveReserved(i),
              0,
            );
            const latestRefresh = instances.reduce(
              (acc, i) =>
                acc === '' || i.reservedRefreshedAt > acc ? i.reservedRefreshedAt : acc,
              '',
            );
            return {
              id: `${date}|${categoryKey}`,
              date,
              categoryKey,
              categoryLabelAr: instances[0].categoryLabelAr,
              examLabel: instances[0].examLabel,
              committeeCount: instances.length,
              perCommitteeCapacity: uniform ? capacities[0] : null,
              totalReserved,
              reservedRefreshedAt: latestRefresh,
              instances,
            };
          },
        );
        aggregated.sort((a, b) => arabicCmp(a.categoryLabelAr, b.categoryLabelAr));
        return {
          date,
          rows: aggregated,
          instanceCount: rs.length,
        };
      });
  }, [rows]);

  const loading =
    activeCycleQuery.isLoading ||
    allInstancesQuery.isLoading ||
    definitionsQuery.isLoading ||
    categoriesQuery.isLoading ||
    academyExamsQuery.isLoading ||
    cycleExamPlansQuery.isLoading;

  /* Expansion state — single open day at a time so admins can focus.
   * Persisted per cycle in localStorage; opening a different day
   * implicitly collapses the previous one. Store keeps its array shape
   * for backward compat with existing entries; we treat the first
   * element as the currently-open date. */
  const byCycle = useDayExpansionStore((s) => s.byCycle);
  const setExpanded = useDayExpansionStore((s) => s.setExpanded);
  const allDayDates = useMemo(() => dayGroups.map((g) => g.date), [dayGroups]);
  const expandedDates = useMemo(
    () => resolveExpandedDates(byCycle, activeCycleId, allDayDates),
    [byCycle, activeCycleId, allDayDates],
  );
  const openDate = expandedDates[0] ?? '';

  const handleOpenChange = (next: string): void => {
    if (!activeCycleId) return;
    setExpanded(activeCycleId, next ? [next] : []);
  };

  const refreshMut = useRefreshReservedCountsMutation();
  const handleRefresh = (): void => {
    if (!activeCycleId) return;
    refreshMut.mutate(
      { cycleId: activeCycleId },
      {
        onSuccess: (touched) => {
          toast(`تم تحديث ${num(touched.length)} موعد لجنة`, 'success');
        },
        onError: (err) => toast((err as Error).message, 'danger'),
      },
    );
  };

  return (
    <CenteredShell>
      <PageHeader
        title="إدارة مواعيد الاختبارات واللجان"
        subtitle="مواعيد اللجان داخل الدورة النشطة، مُجمَّعة باليوم. أضِف يوماً جديداً من النموذج أدناه، أو حرّر السعة ومواعيد اللجان مباشرةً من جداول الأيام."
        breadcrumbs={[
          { label: 'إدارة المنظومة', href: ROUTES.admin.dashboard },
          { label: 'إدارة مواعيد الاختبارات واللجان' },
        ]}
      />

      <CycleHeaderBlock cycle={activeCycle} />

      {activeCycle && activeCategoriesForForm.length > 0 && (
        <CommitteeInstanceAddForm
          cycle={activeCycle}
          active={activeCategoriesForForm}
        />
      )}

      {loading ? (
        <LoadingState variant="card-grid" />
      ) : !activeCycleId ? (
        <Card>
          <div className="p-6">
            <EmptyState
              variant="generic"
              title="لا توجد دورة نشطة"
              description="فعّل دورة من «دورات القبول» لعرض مواعيد لجانها هنا."
            />
          </div>
        </Card>
      ) : dayGroups.length === 0 ? (
        <Card>
          <div className="p-6">
            <EmptyState
              variant="generic"
              title={`لا توجد مواعيد لجان في ${activeCycle?.nameAr ?? 'الدورة النشطة'}`}
              description="استخدم نموذج «إضافة موعد اختبار» أعلاه لإنشاء أول يوم لجان، أو افتح معالج إعداد التقديم من «دورات القبول»."
            />
          </div>
        </Card>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              isLoading={refreshMut.isPending}
              leadingIcon={<RefreshCcw size={14} strokeWidth={1.75} />}
            >
              تحديث
            </Button>
          </div>
          <Card>
            <Accordion
              type="single"
              collapsible
              value={openDate}
              onValueChange={(next) => handleOpenChange(next as string)}
            >
              {dayGroups.map((group) => (
                <Accordion.Item key={group.date} value={group.date}>
                  <Accordion.HeaderRow
                    trigger={
                      <span className="flex w-full items-center justify-between gap-2 pe-2">
                        <span className="font-ar-display text-sm font-bold text-ink-900">
                          {fmtDate(group.date, 'full')}
                        </span>
                        <span className="text-2xs text-ink-500">
                          {num(group.instanceCount)} لجنة
                        </span>
                      </span>
                    }
                    actions={
                      <DayActions
                        cycleId={activeCycleId}
                        group={group}
                      />
                    }
                  />
                  <Accordion.Content>
                    <CommitteeRowsTable
                      rows={group.rows}
                    />
                  </Accordion.Content>
                </Accordion.Item>
              ))}
            </Accordion>
          </Card>
        </>
      )}
    </CenteredShell>
  );
}

/* ── Per-day actions ─────────────────────────────────────────────── *
 * Drives the «حذف اليوم» flow next to each day header. Booked days keep
 * deletion disabled and surface a visible validation message so admins
 * can immediately see why the action is unavailable.                     */

interface DayActionsProps {
  cycleId: string;
  group: DayGroup;
}

function DayActions({
  cycleId,
  group,
}: DayActionsProps): JSX.Element {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const dayPassed = isPastDay(group.date);
  const hasBookings = group.rows.some((r) => r.totalReserved > 0);
  const deleteBlockedMessage = dayPassed
    ? 'لا يمكن حذف يوم اختبار سابق.'
    : hasBookings
      ? 'لا يمكن حذف هذا اليوم لأن به حجوزات قائمة للمتقدمين.'
      : null;

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="text-terra-700 hover:bg-terra-50 hover:text-terra-800"
          leadingIcon={<Trash2 size={14} strokeWidth={1.75} />}
          disabled={dayPassed || hasBookings}
          onClick={() => setDeleteOpen(true)}
          title={deleteBlockedMessage ?? undefined}
        >
          حذف اليوم
        </Button>
        {deleteBlockedMessage && (
          <span className="max-w-64 text-end text-3xs text-terra-700">
            {deleteBlockedMessage}
          </span>
        )}
      </div>

      <DeleteDayDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        cycleId={cycleId}
        group={group}
      />
    </>
  );
}

/* ── Delete-day confirmation ─────────────────────────────────────── */

interface DeleteDayDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  cycleId: string;
  group: DayGroup;
}

function DeleteDayDialog({
  open,
  onOpenChange,
  cycleId,
  group,
}: DeleteDayDialogProps): JSX.Element {
  const removeDayMut = useRemoveCommitteeInstanceDayMutation();
  const reservedRows = group.rows.filter((r) => r.totalReserved > 0);
  const hasReservations = reservedRows.length > 0;
  const dayPassed = isPastDay(group.date);

  const handleDelete = (): void => {
    if (hasReservations || dayPassed) return;
    removeDayMut.mutate(
      { cycleId, date: group.date },
      {
        onSuccess: (removed) => {
          toast(`تم حذف ${num(removed.length)} موعد في ${fmtDate(group.date, 'full')}`, 'success');
          onOpenChange(false);
        },
        onError: (err) => toast((err as Error).message, 'danger'),
      },
    );
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`حذف يوم ${fmtDate(group.date, 'full')}`}
      description={
        dayPassed
          ? 'لا يمكن حذف يوم اختبار سابق.'
          : hasReservations
          ? 'لا يمكن حذف هذا اليوم لأن به حجوزات قائمة للمتقدمين. راجع الحجوزات قبل محاولة حذف الموعد.'
          : `سيتم حذف ${num(group.instanceCount)} موعد لجنة في هذا اليوم. لا توجد حجوزات.`
      }
      actionLabel="حذف"
      tone="danger"
      onAction={handleDelete}
      isActionDisabled={hasReservations || dayPassed}
      isActionLoading={removeDayMut.isPending}
    >
      {hasReservations && (
        <ul className="mt-3 max-h-48 overflow-auto rounded-md border border-terra-200 bg-terra-50 p-2 text-2xs text-terra-700">
          {reservedRows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-0.5">
              <span className="truncate">{r.categoryLabelAr}</span>
              <span className="font-numeric tnum">{num(r.totalReserved)} محجوز</span>
            </li>
          ))}
        </ul>
      )}
    </AlertDialog>
  );
}

/* ── Cycle field at the top of the page ─────────────────────────── *
 * Read-only — the page is locked to the active cycle, so there's no
 * picker. The block just surfaces which cycle the rows below belong
 * to for clarity.                                                         */

interface CycleHeaderBlockProps {
  cycle: AdmissionCycle | null;
}

function CycleHeaderBlock({ cycle }: CycleHeaderBlockProps): JSX.Element {
  return (
    <Card variant="elevated" className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-2xs font-medium uppercase tracking-wide text-ink-500">
            الدورة النشطة
          </span>
          <span className="font-ar-display text-md font-bold text-ink-900">
            {cycle ? cycle.nameAr : 'لا توجد دورة نشطة'}
          </span>
        </div>
      </div>
    </Card>
  );
}

/* ── Per-day aggregated rows ─────────────────────────────────────── *
 * One row per (categoryKey × date). The «عدد اللجان» column surfaces
 * how many physical committees underlie the row; capacity/reserved/
 * delete actions cascade through `row.instances`.                       */

interface CommitteeRowsTableProps {
  rows: AggregatedRow[];
}

function CommitteeRowsTable({
  rows,
}: CommitteeRowsTableProps): JSX.Element {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-surface-sunken">
          <tr>
            <th className="px-4 py-2 text-start text-2xs font-medium uppercase tracking-wide text-ink-500">
              الفئة
            </th>
            <th className="px-4 py-2 text-start text-2xs font-medium uppercase tracking-wide text-ink-500">
              تاريخ الاختبار
            </th>
            <th className="px-4 py-2 text-start text-2xs font-medium uppercase tracking-wide text-ink-500">
              اسم الاختبار
            </th>
            <th className="px-4 py-2 text-center text-2xs font-medium uppercase tracking-wide text-ink-500">
              عدد اللجان
            </th>
            <th className="px-4 py-2 text-center text-2xs font-medium uppercase tracking-wide text-ink-500">
              سعة اللجنة
            </th>
            <th className="px-4 py-2 text-center text-2xs font-medium uppercase tracking-wide text-ink-500">
              المحجوز
            </th>
            <th className="px-4 py-2 text-center text-2xs font-medium uppercase tracking-wide text-ink-500">
              آخر تحديث
            </th>
            <th className="px-4 py-2 text-center text-2xs font-medium uppercase tracking-wide text-ink-500">
              إجراءات
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border-subtle hover:bg-ink-50/40">
              <td className="px-4 py-2 align-middle text-ink-900">
                {row.categoryLabelAr}
              </td>
              <td className="px-4 py-2 align-middle">
                <DateCell value={row.date} />
              </td>
              <td className="px-4 py-2 align-middle text-ink-900">
                {row.examLabel || <span className="text-ink-400">—</span>}
              </td>
              <td className="px-4 py-2 align-middle text-center font-numeric tnum text-ink-900">
                {num(row.committeeCount)}
              </td>
              <td className="px-4 py-2 align-middle text-center">
                <CapacityCell row={row} />
              </td>
              <td className="px-4 py-2 align-middle text-center font-numeric tnum text-ink-900">
                {num(row.totalReserved)}
              </td>
              <td className="px-4 py-2 align-middle text-center">
                <LastUpdatedCell value={row.reservedRefreshedAt} />
              </td>
              <td className="px-4 py-2 align-middle text-center">
                <CommitteeRowActions
                  row={row}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Per-row (category-day) actions ──────────────────────────────── *
 * Delete cascades through every underlying CommitteeInstance for the
 * (categoryKey × date). Blocking conditions check the aggregate
 * `totalReserved` and the shared `date`.                                  */

interface CommitteeRowActionsProps {
  row: AggregatedRow;
}

function CommitteeRowActions({
  row,
}: CommitteeRowActionsProps): JSX.Element {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const dayPassed = isPastDay(row.date);
  const hasBookings = row.totalReserved > 0;
  const deleteBlockedMessage = dayPassed
    ? 'لا يمكن حذف موعد في يوم سابق.'
    : hasBookings
      ? 'لا يمكن حذف هذا الموعد لأن به حجوزات قائمة للمتقدمين.'
      : null;

  return (
    <>
      <div className="flex flex-col items-center justify-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="text-terra-700 hover:bg-terra-50 hover:text-terra-800"
          leadingIcon={<Trash2 size={13} strokeWidth={1.75} />}
          disabled={dayPassed || hasBookings}
          title={deleteBlockedMessage ?? undefined}
          onClick={() => setDeleteOpen(true)}
        >
          حذف
        </Button>
        {deleteBlockedMessage && (
          <span className="max-w-40 text-center text-3xs text-terra-700">
            {deleteBlockedMessage}
          </span>
        )}
      </div>
      <DeleteCommitteeDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        row={row}
      />
    </>
  );
}

interface DeleteCommitteeDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  row: AggregatedRow;
}

function DeleteCommitteeDialog({
  open,
  onOpenChange,
  row,
}: DeleteCommitteeDialogProps): JSX.Element {
  const removeMut = useRemoveCommitteeInstanceMutation();
  const blocked = row.totalReserved > 0 || isPastDay(row.date);

  /* Cascade through every underlying instance for the aggregated
   * (categoryKey × date) — N parallel removes; surfaces the first
   * failure if any, then leaves the cache to refresh from the
   * mutation's onSuccess. */
  const handleDelete = async (): Promise<void> => {
    if (blocked) return;
    try {
      await Promise.all(row.instances.map((i) => removeMut.mutateAsync(i.id)));
      toast(
        `تم حذف ${num(row.instances.length)} موعد لجنة لفئة ${row.categoryLabelAr}`,
        'success',
      );
      onOpenChange(false);
    } catch (err) {
      toast((err as Error).message, 'danger');
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`حذف مواعيد ${row.categoryLabelAr}`}
      description={
        isPastDay(row.date)
          ? 'لا يمكن حذف مواعيد في يوم سابق.'
          : row.totalReserved > 0
            ? `لا يمكن حذف هذه المواعيد لأن بها حجوزات قائمة للمتقدمين (${num(row.totalReserved)} حجز).`
            : `سيتم حذف ${num(row.committeeCount)} موعد لجنة لفئة ${row.categoryLabelAr} بتاريخ ${fmtDate(row.date, 'full')}. لا يمكن التراجع.`
      }
      actionLabel="حذف"
      tone="danger"
      onAction={() => {
        void handleDelete();
      }}
      isActionDisabled={blocked}
      isActionLoading={removeMut.isPending}
    />
  );
}

/* ── سعة اللجنة inline-edit cell ──────────────────────────────────── *
 * The aggregated row's capacity is the per-committee value — same value
 * the add form takes. Committing fans the new value out to every
 * underlying CommitteeInstance in parallel. When underlying capacities
 * disagree (`perCommitteeCapacity === null`), the field is replaced by
 * a «متفاوتة» label; admins fix that via the admission-setup wizard's
 * per-committee editor. The service enforces the [1, 999] envelope and
 * silently clamps `reserved` down if the new capacity is below the
 * current reservation count (committeeInstance.service.ts).               */

interface CapacityCellProps {
  row: AggregatedRow;
}

function CapacityCell({ row }: CapacityCellProps): JSX.Element {
  const updateMut = useUpdateCommitteeInstanceMutation();
  const initial = row.perCommitteeCapacity;
  const [value, setValue] = useState<string>(() =>
    initial === null ? '' : String(initial),
  );
  const dayPassed = isPastDay(row.date);
  const nonUniform = initial === null;

  /* External value can shift (refresh-reserved, mutation invalidation).
   * Re-sync whenever the row's persisted capacity changes — unless the
   * user is actively typing on this cell (the input is the focused
   * element), in which case we leave their draft alone. */
  useEffect(() => {
    const ownerDoc = typeof document !== 'undefined' ? document : null;
    const inputEl = ownerDoc?.activeElement as HTMLInputElement | null;
    if (inputEl?.dataset.capacityCellId === row.id) return;
    setValue(initial === null ? '' : String(initial));
  }, [initial, row.id]);

  const commit = (): void => {
    if (dayPassed || nonUniform) {
      setValue(initial === null ? '' : String(initial));
      if (dayPassed) toast('لا يمكن تعديل سعة يوم سابق', 'warning');
      return;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 999) {
      toast('السعة يجب أن تكون عدداً صحيحاً بين 1 و 999', 'danger');
      setValue(initial === null ? '' : String(initial));
      return;
    }
    if (parsed === initial) return;
    /* Fan the new capacity out to every underlying instance. Promise.all
     * so the cache invalidation fires once all writes settle; first
     * failure surfaces. */
    void Promise.all(
      row.instances.map((i) =>
        updateMut.mutateAsync({ id: i.id, patch: { capacity: parsed } }),
      ),
    ).catch((err: unknown) => {
      toast((err as Error).message, 'danger');
      setValue(initial === null ? '' : String(initial));
    });
  };

  if (nonUniform) {
    return (
      <span
        className="inline-block font-numeric tnum text-2xs text-ink-500"
        title="السعة متفاوتة بين اللجان — حرّرها من معالج إعداد التقديم"
      >
        متفاوتة
      </span>
    );
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      max={999}
      value={value}
      data-capacity-cell-id={row.id}
      aria-label={`سعة لجان ${row.categoryLabelAr} في ${row.date}`}
      disabled={updateMut.isPending || dayPassed}
      title={dayPassed ? 'لا يمكن تعديل يوم سابق' : undefined}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.currentTarget as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          setValue(initial === null ? '' : String(initial));
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      className="mx-auto block w-16 rounded-md border border-border-subtle bg-surface-card px-2 py-1 text-center font-numeric tnum text-sm text-ink-900 transition-colors hover:border-ink-300 focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
    />
  );
}

interface DateCellProps {
  value: string;
}

function DateCell({ value }: DateCellProps): JSX.Element {
  return (
    <span
      className="inline-block min-w-[7rem] whitespace-nowrap font-numeric tnum text-2xs text-ink-700"
      title={fmtDate(value, 'full')}
    >
      {fmtDate(value, 'short')}
    </span>
  );
}

/* ── آخر تحديث cell ───────────────────────────────────────────────── *
 * Renders the relative-time stamp (e.g. «منذ 5 دقيقة») with the absolute
 * ISO timestamp surfaced as a tooltip so the admin can fall through to
 * the exact value when needed.                                          */

interface LastUpdatedCellProps {
  value: string;
}

function LastUpdatedCell({ value }: LastUpdatedCellProps): JSX.Element {
  const absolute = fmtDate(value, 'full');
  return (
    <span
      className="text-2xs text-ink-600"
      title={absolute}
      aria-label={`آخر تحديث: ${absolute}`}
    >
      {fmtDate(value, 'rel')}
    </span>
  );
}
