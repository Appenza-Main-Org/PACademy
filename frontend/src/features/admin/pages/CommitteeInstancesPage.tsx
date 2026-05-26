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
import {
  ChevronsDownUp,
  ChevronsUpDown,
  MoveRight,
  RefreshCcw,
  Trash2,
} from 'lucide-react';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import {
  Accordion,
  AlertDialog,
  Button,
  Card,
  DatePicker,
  Dialog,
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
  useTransferCommitteeInstanceMutation,
  useTransferCommitteeInstanceDayMutation,
  useUpdateCommitteeInstanceMutation,
  type ReservationTransferConflict,
  type TransferCapacityMode,
} from '@/features/committees';
import { isConflictError } from '@/shared/lib/errors';
import type {
  AdmissionCycle,
  CommitteeInstance,
} from '@/shared/types/domain';
import {
  CommitteeInstanceAddForm,
  useActiveCategoriesForCycle,
} from '@/features/admin/admission-setup';
import {
  resolveExpandedDates,
  useDayExpansionStore,
} from './committee-instances/expansionStore';

interface InstanceRow extends CommitteeInstance {
  categoryLabelAr: string;
  committeeName: string;
}

interface DayGroup {
  date: string;
  rows: InstanceRow[];
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

/** Convert a local `Date` to its yyyy-mm-dd ISO string so the DatePicker
 *  value can be reconciled against existing day groups. */
function localDateToIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isPastDay(date: string): boolean {
  return date < todayIsoLocal();
}

function committeeSetSignature(rows: readonly InstanceRow[]): string {
  return rows
    .map((row) => `${row.categoryKey}|${row.definitionCode}`)
    .sort()
    .join('::');
}

function hasSameCommitteeSet(
  sourceRows: readonly InstanceRow[],
  destinationRows: readonly InstanceRow[],
): boolean {
  return (
    sourceRows.length > 0 &&
    sourceRows.length === destinationRows.length &&
    committeeSetSignature(sourceRows) === committeeSetSignature(destinationRows)
  );
}

export function CommitteeInstancesPage(): JSX.Element {
  const activeCycleQuery = useActiveCycle();
  const allInstancesQuery = useCommitteeInstances();
  const definitionsQuery = useLookup('committees');
  const categoriesQuery = useLookup('applicant-categories');

  const activeCycle = activeCycleQuery.data ?? null;
  const activeCycleId = activeCycle?.id ?? null;

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

  const definitionNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of definitionsQuery.data ?? []) map.set(d.code, d.name);
    return map;
  }, [definitionsQuery.data]);

  const rows = useMemo<InstanceRow[]>(() => {
    if (!activeCycleId) return [];
    return (allInstancesQuery.data ?? [])
      .filter((i) => i.cycleId === activeCycleId)
      .map((inst) => ({
        ...inst,
        capacity: normalizeNonNegativeInteger(inst.capacity),
        reserved: normalizeNonNegativeInteger(inst.reserved),
        categoryLabelAr: categoryLabelByKey.get(inst.categoryKey) ?? inst.categoryKey,
        committeeName: definitionNameByCode.get(inst.definitionCode) ?? inst.definitionCode,
      }));
  }, [
    allInstancesQuery.data,
    activeCycleId,
    categoryLabelByKey,
    definitionNameByCode,
  ]);

  /* Group rows by date; sort dates ascending. Within each day, primary
   * sort by category label then committee name so visually consecutive
   * committees from the same category cluster together. Every day the
   * wizard authored is rendered — past, present, future — so admins
   * can audit completed exam days and keep parity with what they see
   * in the admission-setup wizard. Transfer destinations remain
   * restricted to today+ via the DatePicker's `min` (further down). */
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
      .map(([date, rs]) => ({
        date,
        rows: [...rs].sort((a, b) => {
          const c = arabicCmp(a.categoryLabelAr, b.categoryLabelAr);
          return c !== 0 ? c : arabicCmp(a.committeeName, b.committeeName);
        }),
      }));
  }, [rows]);

  const loading =
    activeCycleQuery.isLoading ||
    allInstancesQuery.isLoading ||
    definitionsQuery.isLoading ||
    categoriesQuery.isLoading;

  /* Expansion state — persisted per cycle in localStorage. Default is
   * "all days expanded" until the admin touches a section, after which
   * their explicit set wins until they hit reset. */
  const byCycle = useDayExpansionStore((s) => s.byCycle);
  const setExpanded = useDayExpansionStore((s) => s.setExpanded);
  const allDayDates = useMemo(() => dayGroups.map((g) => g.date), [dayGroups]);
  const expandedDates = useMemo(
    () => resolveExpandedDates(byCycle, activeCycleId, allDayDates),
    [byCycle, activeCycleId, allDayDates],
  );

  const handleExpansionChange = (next: string[]): void => {
    if (!activeCycleId) return;
    setExpanded(activeCycleId, next);
  };

  const expandAll = (): void => {
    if (!activeCycleId) return;
    setExpanded(activeCycleId, allDayDates);
  };

  const collapseAll = (): void => {
    if (!activeCycleId) return;
    setExpanded(activeCycleId, []);
  };

  const allExpanded = allDayDates.length > 0 && expandedDates.length === allDayDates.length;
  const allCollapsed = expandedDates.length === 0;

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
            <Button
              variant="ghost"
              size="sm"
              onClick={expandAll}
              disabled={allExpanded}
              leadingIcon={<ChevronsUpDown size={14} strokeWidth={1.75} />}
            >
              توسيع الكل
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={collapseAll}
              disabled={allCollapsed}
              leadingIcon={<ChevronsDownUp size={14} strokeWidth={1.75} />}
            >
              طي الكل
            </Button>
          </div>
          <Card>
            <Accordion
              type="multiple"
              value={expandedDates}
              onValueChange={(next) => handleExpansionChange(next as string[])}
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
                          {num(group.rows.length)} لجنة
                        </span>
                      </span>
                    }
                    actions={
                      <DayActions
                        cycleId={activeCycleId}
                        group={group}
                        dayGroups={dayGroups}
                      />
                    }
                  />
                  <Accordion.Content>
                    <CommitteeRowsTable
                      rows={group.rows}
                      dayGroups={dayGroups}
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
 * Drives the «حذف اليوم» and «نقل اليوم» flows as inline buttons next
 * to each day header. Both surface reservation-aware confirmation
 * dialogs when any committee on the day has reserved > 0, so the admin
 * sees what's at stake before committing the action.                     */

interface DayActionsProps {
  cycleId: string;
  group: DayGroup;
  /** Every day group in the cycle — the transfer dialog uses this to
   *  preview destination-day rows for the upfront capacity-conflict
   *  alert. */
  dayGroups: DayGroup[];
}

function DayActions({
  cycleId,
  group,
  dayGroups,
}: DayActionsProps): JSX.Element {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const hasOtherDays = dayGroups.some((g) => g.date !== group.date);
  const dayPassed = isPastDay(group.date);
  const hasBookings = group.rows.some((r) => effectiveReserved(r) > 0);

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<MoveRight size={14} strokeWidth={1.75} />}
          disabled={!hasOtherDays || dayPassed}
          onClick={() => setTransferOpen(true)}
          title={dayPassed ? 'لا يمكن نقل حجوزات يوم سابق' : undefined}
        >
          نقل اليوم
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-terra-700 hover:bg-terra-50 hover:text-terra-800"
          leadingIcon={<Trash2 size={14} strokeWidth={1.75} />}
          disabled={dayPassed || hasBookings}
          onClick={() => setDeleteOpen(true)}
          title={
            dayPassed
              ? 'لا يمكن حذف يوم سابق'
              : hasBookings
                ? 'لا يمكن حذف يوم به حجوزات'
                : undefined
          }
        >
          حذف اليوم
        </Button>
      </div>

      <DeleteDayDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        cycleId={cycleId}
        group={group}
      />
      <TransferDayDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        cycleId={cycleId}
        group={group}
        dayGroups={dayGroups}
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
  const reservedRows = group.rows.filter((r) => effectiveReserved(r) > 0);
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
          ? 'هناك متقدمون محجوزون في لجان هذا اليوم. الحذف سيُسقط جميع الحجوزات أدناه. هل تريد المتابعة؟'
          : `سيتم حذف ${num(group.rows.length)} موعد لجنة في هذا اليوم. لا توجد حجوزات.`
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
              <span className="truncate">{r.committeeName}</span>
              <span className="font-numeric tnum">{num(effectiveReserved(r))} محجوز</span>
            </li>
          ))}
        </ul>
      )}
    </AlertDialog>
  );
}

/* ── Transfer-day flow ───────────────────────────────────────────── *
 * The transfer moves **reservations only** — committee instances stay
 * in place on the source day with their capacity intact; only their
 * reserved counts move forward to the destination.
 *
 * Two-stage flow inside one Dialog:
 *
 *   1. pick — calendar (DatePicker, min=today) to choose the destination
 *      day. Past dates are disabled at the cell level; same-day and
 *      programmatic past values get a re-check at submit. Helper text
 *      tells the admin up front whether the destination already has the
 *      matching committee (top up its reservations) or not (clone the
 *      source config forward).
 *
 *   2. capacity-conflict — surfaces only when the service returns
 *      `ConflictError('RESERVATIONS_OVER_DESTINATION_CAPACITY')` because
 *      some destination committees can't absorb the incoming reservation.
 *      The admin can either:
 *        - bump destination capacity inline for every blocking row
 *          (the popup pre-fills `requiredCapacity`), then re-submit, or
 *        - go back and pick a different day, or cancel entirely.
 *
 * Both branches end with a success toast «تم نقل N حجز إلى {date}» and
 * the dialog closes.                                                       */

interface TransferDayDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  cycleId: string;
  group: DayGroup;
  /** Every day group in the cycle. Used to (a) gate the calendar's
   *  same-day check and (b) compute the upfront destination-capacity
   *  conflict preview when the admin picks a target with existing
   *  committees. */
  dayGroups: DayGroup[];
}

interface PreviewConflict {
  definitionCode: string;
  committeeName: string;
  sourceReserved: number;
  destinationCapacity: number;
  destinationReserved: number;
  freeSeats: number;
  requiredCapacity: number;
}

function TransferDayDialog({
  open,
  onOpenChange,
  cycleId,
  group,
  dayGroups,
}: TransferDayDialogProps): JSX.Element {
  const transferMut = useTransferCommitteeInstanceDayMutation();
  const [target, setTarget] = useState<Date | null>(null);
  const [mode, setMode] = useState<TransferCapacityMode>('move-only');
  const [conflicts, setConflicts] = useState<ReservationTransferConflict[] | null>(null);

  /* Reset internal state every time the dialog opens. */
  useEffect(() => {
    if (open) {
      setTarget(null);
      setMode('move-only');
      setConflicts(null);
    }
  }, [open]);

  const reservedRows = group.rows.filter((r) => effectiveReserved(r) > 0);
  const hasReservations = reservedRows.length > 0;
  const totalSourceReservations = reservedRows.reduce(
    (sum, r) => sum + effectiveReserved(r),
    0,
  );

  /* `min` boundary on the calendar = today. The DatePicker disables every
   * day before this in its grid so the admin can't even click a past
   * day, let alone submit one. We re-check below so a programmatically-
   * set value can't slip through. */
  const todayIso = todayIsoLocal();
  const rowsByDate = useMemo(() => {
    const map = new Map<string, InstanceRow[]>();
    for (const g of dayGroups) map.set(g.date, g.rows);
    return map;
  }, [dayGroups]);

  const targetIso = target ? localDateToIso(target) : null;
  const isSameDay = targetIso === group.date;
  const isPastTarget = targetIso !== null && targetIso < todayIso;
  const destinationExists = targetIso !== null && rowsByDate.has(targetIso);
  const destinationRows = targetIso ? rowsByDate.get(targetIso) ?? [] : [];
  const hasMatchingDestinationSet =
    targetIso !== null && hasSameCommitteeSet(group.rows, destinationRows);

  const targetInvalidReason = !targetIso
    ? null
    : isPastTarget
      ? 'لا يمكن اختيار يوم سابق.'
      : isSameDay
        ? 'هذا هو نفس اليوم الحالي — اختر يوماً مختلفاً.'
        : !hasMatchingDestinationSet
          ? 'اليوم المستهدف يجب أن يحتوي نفس لجان المصدر لكل فئة.'
        : null;
  const targetValid = targetIso !== null && targetInvalidReason === null;

  /* Upfront capacity-conflict preview. Mirrors the service's check in
   * committeeInstance.service.ts so the admin sees over-capacity rows
   * the moment they pick a target — instead of finding out only after
   * clicking "نقل الحجوزات". The real check still runs server-side at
   * submit time; if the admin proceeds anyway, the second-stage
   * CapacityConflictPanel lets them bump capacity inline. */
  const previewConflicts = useMemo<PreviewConflict[]>(() => {
    if (!targetValid || !targetIso || !destinationExists) return [];
    const destRows = rowsByDate.get(targetIso) ?? [];
    const destByCode = new Map<string, InstanceRow>();
    for (const r of destRows) destByCode.set(r.definitionCode, r);
    const out: PreviewConflict[] = [];
    for (const source of reservedRows) {
      const destination = destByCode.get(source.definitionCode);
      if (!destination) continue;
      const sourceReserved = effectiveReserved(source);
      const destReserved = effectiveReserved(destination);
      const freeSeats = destination.capacity - destReserved;
      if (freeSeats < sourceReserved) {
        out.push({
          definitionCode: source.definitionCode,
          committeeName: source.committeeName,
          sourceReserved,
          destinationCapacity: destination.capacity,
          destinationReserved: destReserved,
          freeSeats: Math.max(0, freeSeats),
          requiredCapacity: destReserved + sourceReserved,
        });
      }
    }
    return out;
  }, [targetValid, targetIso, destinationExists, rowsByDate, reservedRows]);
  const hasPreviewConflicts = mode === 'move-only' && previewConflicts.length > 0;

  const submit = (capacityOverrides?: Record<string, number>): void => {
    if (!targetIso || !targetValid) return;
    transferMut.mutate(
      { cycleId, fromDate: group.date, toDate: targetIso, mode, capacityOverrides },
      {
        onSuccess: ({ totalReservationsMoved }) => {
          const message = `تم نقل ${num(totalReservationsMoved)} حجز إلى ${fmtDate(targetIso, 'full')}`;
          toast(message, 'success');
          onOpenChange(false);
        },
        onError: (err) => {
          if (
            isConflictError(err) &&
            err.conflictCode === 'RESERVATIONS_OVER_DESTINATION_CAPACITY'
          ) {
            const payload = err.payload as { conflicts: ReservationTransferConflict[] };
            setConflicts(payload.conflicts);
            return;
          }
          toast((err as Error).message, 'danger');
        },
      },
    );
  };

  /* Disable «نقل» when there's literally nothing to move — the
   * committee day-section can be transfer-empty if every row is at 0
   * reserved. */
  const nothingToTransfer = !hasReservations;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`نقل حجوزات يوم ${fmtDate(group.date, 'full')}`}
      size="md"
    >
      {conflicts !== null ? (
        <CapacityConflictPanel
          conflicts={conflicts}
          targetIso={targetIso}
          isSubmitting={transferMut.isPending}
          onCancel={() => setConflicts(null)}
          onResubmit={(overrides) => submit(overrides)}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-700">
            {nothingToTransfer
              ? 'لا توجد حجوزات في هذا اليوم لنقلها.'
              : `سيتم نقل ${num(totalSourceReservations)} حجز عبر ${num(reservedRows.length)} لجنة. تبقى اللجان وسعتها في يوم ${fmtDate(group.date, 'full')} كما هي بدون تغيير، وتنتقل الحجوزات فقط إلى اليوم المستهدف.`}
          </p>
          <TransferModeChooser value={mode} onChange={setMode} />
          <DatePicker
            value={target}
            onChange={setTarget}
            min={todayIso}
            placeholder="اختر يوماً من التقويم…"
            label="اليوم المستهدف"
            error={targetInvalidReason ?? undefined}
            helper={
              targetIso !== null && targetValid
                ? destinationExists
                  ? 'سيتم إضافة الحجوزات إلى اللجان المطابقة في اليوم المستهدف.'
                  : 'اختر يوماً يحتوي نفس لجان المصدر لكل فئة.'
                : undefined
            }
          />
          {targetIso !== null && targetValid && hasReservations && (
            <TransferCapacityPreview
              sources={reservedRows}
              destinationRows={destinationRows}
              mode={mode}
            />
          )}
          {hasPreviewConflicts && (
            <div
              role="alert"
              className="rounded-md border border-terra-200 bg-terra-50 p-3 text-2xs text-terra-700"
            >
              <p className="font-medium">
                تنبيه: سعة بعض لجان اليوم المستهدف لا تكفي لاستيعاب الحجوزات
                المنقولة. عدّل السعة من الجدول أعلاه أو اختر يوماً آخر، أو
                تابع لزيادة السعة من نافذة النقل.
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {previewConflicts.map((c) => (
                  <li
                    key={c.definitionCode}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5"
                  >
                    <span className="truncate font-medium">{c.committeeName}</span>
                    <span className="font-numeric tnum">
                      السعة الحالية {num(c.destinationCapacity)} · المحجوز{' '}
                      {num(c.destinationReserved)} · المطلوب{' '}
                      {num(c.requiredCapacity)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hasReservations && (
            <ul className="max-h-40 overflow-auto rounded-md border border-border-subtle bg-surface-sunken p-2 text-2xs text-ink-700">
              {reservedRows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 py-0.5"
                >
                  <span className="truncate">{r.committeeName}</span>
                  <span className="font-numeric tnum">
                    {num(effectiveReserved(r))} حجز
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              onClick={() => submit()}
              disabled={!targetValid || nothingToTransfer}
              isLoading={transferMut.isPending}
            >
              {mode === 'move-and-add-capacity'
                ? 'نقل الحجوزات وزيادة السعة'
                : 'نقل الحجوزات فقط'}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

/* ── Capacity-conflict popup ─────────────────────────────────────── *
 * Renders one editable capacity row per blocking destination. Defaults
 * each input to the `requiredCapacity` the service returned — admins can
 * raise it further, but not lower it below the threshold. On submit,
 * passes a sparse `capacityOverrides` map back to the parent dialog,
 * which re-runs the transfer atomically.                                   */

interface CapacityConflictPanelProps {
  conflicts: ReservationTransferConflict[];
  targetIso: string | null;
  isSubmitting: boolean;
  onCancel: () => void;
  onResubmit: (overrides: Record<string, number>) => void;
}

function CapacityConflictPanel({
  conflicts,
  targetIso,
  isSubmitting,
  onCancel,
  onResubmit,
}: CapacityConflictPanelProps): JSX.Element {
  /* The lookup join gives us the Arabic committee name; the service
   * returns the bare lookup code on `committeeName` so we keep the
   * payload typesafe and the UI does the friendly join. */
  const definitionsQuery = useLookup('committees');
  const definitionNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of definitionsQuery.data ?? []) map.set(d.code, d.name);
    return map;
  }, [definitionsQuery.data]);

  /* Draft input per destination, keyed by destinationInstanceId. */
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      conflicts.map((c) => [c.destinationInstanceId, String(c.requiredCapacity)]),
    ),
  );

  /* Re-seed the draft whenever the conflicts array shifts identity (e.g.
   * a fresh round-trip after an admin re-submits and a different row
   * fails). */
  useEffect(() => {
    setDraft(
      Object.fromEntries(
        conflicts.map((c) => [c.destinationInstanceId, String(c.requiredCapacity)]),
      ),
    );
  }, [conflicts]);

  const rowValidity = conflicts.map((c) => {
    const value = Number(draft[c.destinationInstanceId] ?? '');
    if (!Number.isInteger(value) || value < 1 || value > 999) return false;
    return value >= c.requiredCapacity;
  });
  const allValid = rowValidity.every(Boolean);

  const handleSubmit = (): void => {
    const overrides: Record<string, number> = {};
    for (const c of conflicts) {
      const value = Number(draft[c.destinationInstanceId]);
      overrides[c.destinationInstanceId] = value;
    }
    onResubmit(overrides);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border border-terra-200 bg-terra-50 p-3 text-2xs text-terra-700">
        <p className="font-medium">
          سعة بعض لجان اليوم المستهدف{targetIso ? ` (${fmtDate(targetIso, 'full')})` : ''} لا تكفي
          لاستيعاب الحجوزات.
        </p>
        <p className="mt-1">
          زِد سعة كل لجنة لتصل على الأقل إلى الحد المطلوب، أو ارجع لاختيار يوم آخر.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-surface-sunken">
            <tr>
              <th className="px-3 py-2 text-start text-2xs font-medium uppercase tracking-wide text-ink-500">
                اللجنة
              </th>
              <th className="px-3 py-2 text-end text-2xs font-medium uppercase tracking-wide text-ink-500">
                المحجوز الوارد
              </th>
              <th className="px-3 py-2 text-end text-2xs font-medium uppercase tracking-wide text-ink-500">
                السعة الحالية
              </th>
              <th className="px-3 py-2 text-end text-2xs font-medium uppercase tracking-wide text-ink-500">
                السعة الجديدة
              </th>
            </tr>
          </thead>
          <tbody>
            {conflicts.map((c, idx) => {
              const id = c.destinationInstanceId;
              const value = draft[id] ?? '';
              const valid = rowValidity[idx];
              return (
                <tr key={id} className="border-t border-border-subtle">
                  <td className="px-3 py-2 align-middle text-2xs text-ink-900">
                    {definitionNameByCode.get(c.committeeName) ?? c.committeeName}
                  </td>
                  <td className="px-3 py-2 align-middle text-end font-numeric tnum text-2xs text-ink-900">
                    {num(c.sourceReserved)}
                  </td>
                  <td className="px-3 py-2 align-middle text-end font-numeric tnum text-2xs text-ink-600">
                    {num(c.destinationCapacity)}
                  </td>
                  <td className="px-3 py-2 align-middle text-end">
                    <div className="inline-flex flex-col items-end gap-0.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        aria-label={`السعة الجديدة للجنة ${c.committeeName}`}
                        value={value}
                        onChange={(e) => {
                          const sanitized = e.target.value.replace(/\D+/g, '');
                          setDraft((prev) => ({ ...prev, [id]: sanitized }));
                        }}
                        disabled={isSubmitting}
                        style={{ inlineSize: '6ch' }}
                        className={`rounded-md border bg-surface-elevated px-2 py-0.5 text-end font-numeric tnum text-2xs text-ink-900 focus-visible:outline-none ${
                          valid
                            ? 'border-border-default focus-visible:border-teal-500 focus-visible:shadow-focus-teal'
                            : 'border-terra-400 focus-visible:shadow-[var(--ring-terra)]'
                        }`}
                      />
                      <span className="text-3xs text-ink-500">
                        الحد الأدنى {num(c.requiredCapacity)}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          رجوع
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!allValid}
          isLoading={isSubmitting}
        >
          زيادة السعة ونقل الحجوزات
        </Button>
      </div>
    </div>
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

/* ── Per-day committee rows ──────────────────────────────────────── */

interface CommitteeRowsTableProps {
  rows: InstanceRow[];
  dayGroups: DayGroup[];
}

function CommitteeRowsTable({
  rows,
  dayGroups,
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
              اللجنة
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
              <td className="px-4 py-2 align-middle text-ink-900">
                {row.committeeName}
              </td>
              <td className="px-4 py-2 align-middle text-center">
                <CapacityCell row={row} />
              </td>
              <td className="px-4 py-2 align-middle text-center font-numeric tnum text-ink-900">
                {num(effectiveReserved(row))}
              </td>
              <td className="px-4 py-2 align-middle text-center">
                <LastUpdatedCell value={row.reservedRefreshedAt} />
              </td>
              <td className="px-4 py-2 align-middle text-center">
                <CommitteeRowActions
                  row={row}
                  dayGroups={dayGroups}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Per-committee row actions ───────────────────────────────────── */

interface CommitteeRowActionsProps {
  row: InstanceRow;
  dayGroups: DayGroup[];
}

function CommitteeRowActions({
  row,
  dayGroups,
}: CommitteeRowActionsProps): JSX.Element {
  const [transferOpen, setTransferOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const dayPassed = isPastDay(row.date);
  const reserved = effectiveReserved(row);
  const hasBookings = reserved > 0;
  const hasOtherDays = dayGroups.some((g) => g.date !== row.date);

  return (
    <>
      <div className="flex items-center justify-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<MoveRight size={13} strokeWidth={1.75} />}
          disabled={dayPassed || !hasOtherDays || !hasBookings}
          title={
            dayPassed
              ? 'لا يمكن نقل حجوزات يوم سابق'
              : !hasBookings
                ? 'لا توجد حجوزات لنقلها'
                : undefined
          }
          onClick={() => setTransferOpen(true)}
        >
          نقل
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-terra-700 hover:bg-terra-50 hover:text-terra-800"
          leadingIcon={<Trash2 size={13} strokeWidth={1.75} />}
          disabled={dayPassed || hasBookings}
          title={
            dayPassed
              ? 'لا يمكن حذف يوم سابق'
              : hasBookings
                ? 'لا يمكن حذف لجنة لها حجوزات'
                : undefined
          }
          onClick={() => setDeleteOpen(true)}
        >
          حذف
        </Button>
      </div>
      <TransferCommitteeDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        row={row}
        dayGroups={dayGroups}
      />
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
  row: InstanceRow;
}

function DeleteCommitteeDialog({
  open,
  onOpenChange,
  row,
}: DeleteCommitteeDialogProps): JSX.Element {
  const removeMut = useRemoveCommitteeInstanceMutation();
  const reserved = effectiveReserved(row);
  const blocked = reserved > 0 || isPastDay(row.date);

  const handleDelete = (): void => {
    if (blocked) return;
    removeMut.mutate(row.id, {
      onSuccess: () => {
        toast('تم حذف موعد اللجنة', 'success');
        onOpenChange(false);
      },
      onError: (err) => toast((err as Error).message, 'danger'),
    });
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`حذف ${row.committeeName}`}
      description={
        isPastDay(row.date)
          ? 'لا يمكن حذف لجنة في يوم سابق.'
          : reserved > 0
            ? `لا يمكن حذف هذه اللجنة لأن بها ${num(reserved)} حجز قائم. انقل الحجوزات أولاً.`
            : `سيتم حذف موعد ${row.committeeName} بتاريخ ${fmtDate(row.date, 'full')}. لا يمكن التراجع.`
      }
      actionLabel="حذف"
      tone="danger"
      onAction={handleDelete}
      isActionDisabled={blocked}
      isActionLoading={removeMut.isPending}
    />
  );
}

interface TransferCommitteeDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  row: InstanceRow;
  dayGroups: DayGroup[];
}

function TransferCommitteeDialog({
  open,
  onOpenChange,
  row,
  dayGroups,
}: TransferCommitteeDialogProps): JSX.Element {
  const transferMut = useTransferCommitteeInstanceMutation();
  const [target, setTarget] = useState<Date | null>(null);
  const [mode, setMode] = useState<TransferCapacityMode>('move-only');
  const [conflicts, setConflicts] = useState<ReservationTransferConflict[] | null>(null);

  useEffect(() => {
    if (open) {
      setTarget(null);
      setMode('move-only');
      setConflicts(null);
    }
  }, [open]);

  const todayIso = todayIsoLocal();
  const rowsByDate = useMemo(() => {
    const map = new Map<string, InstanceRow[]>();
    for (const g of dayGroups) map.set(g.date, g.rows);
    return map;
  }, [dayGroups]);
  const targetIso = target ? localDateToIso(target) : null;
  const isSameDay = targetIso === row.date;
  const isPastTarget = targetIso !== null && targetIso < todayIso;
  const targetInvalidReason = !targetIso
    ? null
    : isPastTarget
      ? 'لا يمكن اختيار يوم سابق.'
      : isSameDay
        ? 'هذا هو نفس اليوم الحالي — اختر يوماً مختلفاً.'
        : null;
  const targetValid = targetIso !== null && targetInvalidReason === null;
  const destinationRows = targetIso ? rowsByDate.get(targetIso) ?? [] : [];
  const hasMatchingDestination = destinationRows.some(
    (destination) =>
      destination.definitionCode === row.definitionCode &&
      destination.categoryKey === row.categoryKey,
  );
  const sourceReserved = effectiveReserved(row);
  const canSubmit = targetValid && sourceReserved > 0 && hasMatchingDestination;

  const submit = (capacityOverrides?: Record<string, number>): void => {
    if (!targetIso || !targetValid || sourceReserved <= 0) return;
    transferMut.mutate(
      { id: row.id, toDate: targetIso, mode, capacityOverrides },
      {
        onSuccess: ({ totalReservationsMoved }) => {
          toast(`تم نقل ${num(totalReservationsMoved)} حجز إلى ${fmtDate(targetIso, 'full')}`, 'success');
          onOpenChange(false);
        },
        onError: (err) => {
          if (
            isConflictError(err) &&
            err.conflictCode === 'RESERVATIONS_OVER_DESTINATION_CAPACITY'
          ) {
            const payload = err.payload as { conflicts: ReservationTransferConflict[] };
            setConflicts(payload.conflicts);
            return;
          }
          toast((err as Error).message, 'danger');
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`نقل حجوزات ${row.committeeName}`}
      size="md"
    >
      {conflicts !== null ? (
        <CapacityConflictPanel
          conflicts={conflicts}
          targetIso={targetIso}
          isSubmitting={transferMut.isPending}
          onCancel={() => setConflicts(null)}
          onResubmit={(overrides) => submit(overrides)}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-700">
            سيتم نقل {num(sourceReserved)} حجز من {fmtDate(row.date, 'full')} إلى اليوم المستهدف.
          </p>
          <TransferModeChooser value={mode} onChange={setMode} />
          <DatePicker
            value={target}
            onChange={setTarget}
            min={todayIso}
            placeholder="اختر يوماً من التقويم…"
            label="اليوم المستهدف"
            error={targetInvalidReason ?? undefined}
            helper={
              targetIso !== null && targetValid
                ? hasMatchingDestination
                  ? 'سيتم نقل الحجوزات إلى نفس اللجنة في اليوم المستهدف.'
                  : 'اليوم المستهدف لا يحتوي نفس اللجنة لهذه الفئة.'
                : undefined
            }
          />
          {targetIso !== null && targetValid && hasMatchingDestination && (
            <TransferCapacityPreview
              sources={[row]}
              destinationRows={destinationRows}
              mode={mode}
            />
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              onClick={() => submit()}
              disabled={!canSubmit}
              isLoading={transferMut.isPending}
            >
              {mode === 'move-and-add-capacity'
                ? 'نقل وزيادة السعة'
                : 'نقل فقط'}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function TransferModeChooser({
  value,
  onChange,
}: {
  value: TransferCapacityMode;
  onChange: (next: TransferCapacityMode) => void;
}): JSX.Element {
  const options: Array<{ value: TransferCapacityMode; label: string; hint: string }> = [
    {
      value: 'move-only',
      label: 'نقل فقط',
      hint: 'ينقل الحجوزات إذا كانت السعة المتبقية تكفي.',
    },
    {
      value: 'move-and-add-capacity',
      label: 'نقل مع زيادة سعة الوجهة',
      hint: 'يزيد سعة اللجنة المستهدفة بعدد الحجوزات المنقولة.',
    },
  ];

  return (
    <div className="grid gap-2 md:grid-cols-2" role="group" aria-label="طريقة النقل">
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`rounded-md border px-3 py-2 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
              active
                ? 'border-teal-300 bg-teal-50 text-teal-800'
                : 'border-border-default bg-surface-card text-ink-700 hover:border-border-strong hover:bg-ink-50'
            }`}
          >
            <span className="block text-sm font-semibold">{option.label}</span>
            <span className="mt-0.5 block text-2xs text-ink-500">{option.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

function TransferCapacityPreview({
  sources,
  destinationRows,
  mode,
}: {
  sources: readonly InstanceRow[];
  destinationRows: readonly InstanceRow[];
  mode: TransferCapacityMode;
}): JSX.Element {
  const destinationByDefinition = new Map<string, InstanceRow>();
  for (const row of destinationRows) destinationByDefinition.set(row.definitionCode, row);

  return (
    <div className="rounded-md border border-border-subtle bg-surface-sunken p-3">
      <div className="mb-2 text-xs font-semibold text-ink-900">معاينة السعة قبل النقل</div>
      <ul className="m-0 flex max-h-48 list-none flex-col gap-1 overflow-y-auto p-0 pe-1">
        {sources.map((source) => {
          const destination = destinationByDefinition.get(source.definitionCode);
          const moved = effectiveReserved(source);
          const destinationCapacity = destination?.capacity ?? source.capacity;
          const destinationReserved = destination ? effectiveReserved(destination) : 0;
          const remainingBefore = Math.max(0, destinationCapacity - destinationReserved);
          const addedCapacity = mode === 'move-and-add-capacity' && destination ? moved : 0;
          const capacityAfter = destinationCapacity + addedCapacity;
          const remainingAfter = Math.max(0, capacityAfter - destinationReserved - moved);
          const needsMoreCapacity = destination !== undefined && remainingBefore < moved;
          return (
            <li
              key={source.id}
              className="grid gap-1 rounded-md border border-border-subtle bg-surface-card px-3 py-2 text-2xs text-ink-700 md:grid-cols-[minmax(0,1fr)_auto]"
            >
              <span className="truncate font-medium text-ink-900">{source.committeeName}</span>
              <span className="font-numeric tnum">
                سينقل {num(moved)} · السعة الحالية {num(destinationCapacity)} · المتبقي الآن{' '}
                {num(remainingBefore)} · المتبقي بعد النقل {num(remainingAfter)}
              </span>
              {!destination && (
                <span className="md:col-span-2 text-2xs text-ink-500">
                  لا يوجد موعد مطابق في اليوم المستهدف، سيتم إنشاء موعد جديد بنفس السعة.
                </span>
              )}
              {addedCapacity > 0 && (
                <span className="md:col-span-2 text-2xs text-teal-700">
                  ستزيد سعة الوجهة بمقدار {num(addedCapacity)}.
                </span>
              )}
              {mode === 'move-only' && needsMoreCapacity && (
                <span className="md:col-span-2 text-2xs text-terra-700">
                  السعة المتبقية لا تكفي للنقل بدون زيادة سعة الوجهة.
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── سعة اللجنة inline-edit cell ──────────────────────────────────── *
 * Renders the capacity as an inline number input. Commits on Enter or
 * blur when the value has actually changed; reverts on Esc. The service
 * enforces the [1, 999] envelope and silently clamps `reserved` down if
 * the new capacity is below the current reservation count
 * (committeeInstance.service.ts), so the field accepts any positive
 * integer and the service handles the rest.                              */

interface CapacityCellProps {
  row: InstanceRow;
}

function CapacityCell({ row }: CapacityCellProps): JSX.Element {
  const updateMut = useUpdateCommitteeInstanceMutation();
  const [value, setValue] = useState<string>(() => String(row.capacity));
  const dayPassed = isPastDay(row.date);

  /* External value can shift (refresh-reserved, mutation invalidation).
   * Re-sync whenever the row's persisted capacity changes — unless the
   * user is actively typing on this cell (the input is the focused
   * element), in which case we leave their draft alone. */
  useEffect(() => {
    const ownerDoc = typeof document !== 'undefined' ? document : null;
    const inputEl = ownerDoc?.activeElement as HTMLInputElement | null;
    if (inputEl?.dataset.capacityCellId === row.id) return;
    setValue(String(row.capacity));
  }, [row.capacity, row.id]);

  const commit = (): void => {
    if (dayPassed) {
      setValue(String(row.capacity));
      toast('لا يمكن تعديل سعة يوم سابق', 'warning');
      return;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 999) {
      toast('السعة يجب أن تكون عدداً صحيحاً بين 1 و 999', 'danger');
      setValue(String(row.capacity));
      return;
    }
    if (parsed === row.capacity) return;
    updateMut.mutate(
      { id: row.id, patch: { capacity: parsed } },
      {
        onError: (err) => {
          toast((err as Error).message, 'danger');
          setValue(String(row.capacity));
        },
      },
    );
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      max={999}
      value={value}
      data-capacity-cell-id={row.id}
      aria-label={`سعة ${row.committeeName}`}
      disabled={updateMut.isPending || dayPassed}
      title={dayPassed ? 'لا يمكن تعديل يوم سابق' : undefined}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.currentTarget as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          setValue(String(row.capacity));
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      className="mx-auto block w-16 rounded-md border border-border-subtle bg-surface-card px-2 py-1 text-center font-numeric tnum text-sm text-ink-900 transition-colors hover:border-ink-300 focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
    />
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
