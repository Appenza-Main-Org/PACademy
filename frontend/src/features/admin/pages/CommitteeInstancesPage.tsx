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
  MoreVertical,
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
  DropdownMenu,
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
  useRemoveCommitteeInstanceDayMutation,
  useTransferCommitteeInstanceDayMutation,
} from '@/features/committees';
import type { AdmissionCycle, CommitteeInstance } from '@/shared/types/domain';
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

/** Reserved is hard-capped at capacity for display purposes — the
 *  invariant the user requested: «المحجوز can't exceed سعة اللجنة».
 *  Capacity = 0 falls back to the raw value (defensive: an unset
 *  capacity shouldn't blank the count). */
function effectiveReserved(row: { reserved: number; capacity: number }): number {
  if (!row.capacity || row.capacity <= 0) return row.reserved;
  return Math.min(row.reserved, row.capacity);
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

export function CommitteeInstancesPage(): JSX.Element {
  const activeCycleQuery = useActiveCycle();
  const allInstancesQuery = useCommitteeInstances();
  const definitionsQuery = useLookup('committees');
  const categoriesQuery = useLookup('applicant-categories');

  const activeCycle = activeCycleQuery.data ?? null;
  const activeCycleId = activeCycle?.id ?? null;

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
   * committees from the same category cluster together. Past days are
   * filtered out — admins can't change a day that has already happened,
   * so it doesn't earn a slot in the management view. */
  const todayIso = todayIsoLocal();
  const dayGroups = useMemo<DayGroup[]>(() => {
    const arabicCmp = (a: string, b: string): number =>
      a.localeCompare(b, 'ar', { numeric: true });
    const bucket = new Map<string, InstanceRow[]>();
    for (const r of rows) {
      if (r.date < todayIso) continue;
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
  }, [rows, todayIso]);

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
        subtitle="مواعيد اللجان داخل الدورة النشطة، مُجمَّعة باليوم. اللجان نفسها تُدار في الأكواد المرجعية؛ مواعيد كل دورة تُنشأ من معالج إعداد التقديم وتُحرّر هنا."
        breadcrumbs={[
          { label: 'إدارة المنظومة', href: ROUTES.admin.dashboard },
          { label: 'إدارة مواعيد الاختبارات واللجان' },
        ]}
      />

      <CycleHeaderBlock cycle={activeCycle} />

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
              title={`لا توجد مواعيد قادمة في ${activeCycle?.nameAr ?? 'الدورة النشطة'}`}
              description="افتح إعداد التقديم في «دورات القبول» لإنشاء موعد جديد. الأيام السابقة لا تظهر هنا."
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
                      <DayActionsMenu
                        cycleId={activeCycleId}
                        group={group}
                        otherDays={dayGroups
                          .filter((g) => g.date !== group.date)
                          .map((g) => g.date)}
                      />
                    }
                  />
                  <Accordion.Content>
                    <CommitteeRowsTable rows={group.rows} />
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

/* ── Per-day actions menu ────────────────────────────────────────── *
 * Drives the «حذف اليوم» and «نقل اليوم» flows. Both surface
 * reservation-aware confirmation dialogs when any committee on the day
 * has reserved > 0, so the admin sees what's at stake before committing
 * the action.                                                            */

interface DayActionsMenuProps {
  cycleId: string;
  group: DayGroup;
  /** Dates of every other day in the same cycle — the target candidates
   *  for the «نقل اليوم» dropdown. Empty when this is the only day. */
  otherDays: string[];
}

function DayActionsMenu({
  cycleId,
  group,
  otherDays,
}: DayActionsMenuProps): JSX.Element {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="إجراءات اليوم"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-700 focus-visible:shadow-focus-teal focus-visible:outline-none"
          >
            <MoreVertical size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item
            leadingIcon={<MoveRight size={14} strokeWidth={1.75} />}
            disabled={otherDays.length === 0}
            onSelect={() => setTransferOpen(true)}
          >
            نقل اليوم
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item
            destructive
            leadingIcon={<Trash2 size={14} strokeWidth={1.75} />}
            onSelect={() => setDeleteOpen(true)}
          >
            حذف اليوم
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>

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
        otherDays={otherDays}
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

  const handleDelete = (): void => {
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
        hasReservations
          ? 'هناك متقدمون محجوزون في لجان هذا اليوم. الحذف سيُسقط جميع الحجوزات أدناه. هل تريد المتابعة؟'
          : `سيتم حذف ${num(group.rows.length)} موعد لجنة في هذا اليوم. لا توجد حجوزات.`
      }
      actionLabel={hasReservations ? 'حذف رغم الحجوزات' : 'حذف'}
      tone="danger"
      onAction={handleDelete}
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
 * Two-step: pick a target date from a calendar (DatePicker, min=today —
 * past dates are disabled at the cell level and re-checked at submit),
 * then — only if any reservations exist — a confirmation panel that
 * lists what's moving. Both steps render inside the same Dialog so the
 * admin can step back to change the target without re-opening.
 *
 * Target-day semantics:
 *   - If the picked date already has committees on it in the same cycle,
 *     the transfer merges per-committee (capacity sums + reserved sums).
 *   - If the picked date is brand new, the committees just move forward
 *     with their existing capacity + reservations intact.
 *
 * Both branches are handled by committeeInstanceService.transferDay; this
 * dialog only chooses the target and emits the right post-success copy.   */

interface TransferDayDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  cycleId: string;
  group: DayGroup;
  otherDays: string[];
}

function TransferDayDialog({
  open,
  onOpenChange,
  cycleId,
  group,
  otherDays,
}: TransferDayDialogProps): JSX.Element {
  const transferMut = useTransferCommitteeInstanceDayMutation();
  const [target, setTarget] = useState<Date | null>(null);
  const [stage, setStage] = useState<'pick' | 'confirm'>('pick');

  /* Reset internal state every time the dialog opens. */
  useEffect(() => {
    if (open) {
      setTarget(null);
      setStage('pick');
    }
  }, [open]);

  const reservedRows = group.rows.filter((r) => effectiveReserved(r) > 0);
  const hasReservations = reservedRows.length > 0;

  /* `min` boundary on the calendar = today. The DatePicker disables every
   * day before this in its grid so the admin can't even click a past
   * day, let alone submit one. We re-check below so a programmatically-
   * set value can't slip through. */
  const todayIso = todayIsoLocal();
  const otherDaySet = useMemo(() => new Set(otherDays), [otherDays]);

  const targetIso = target ? localDateToIso(target) : null;
  const isSameDay = targetIso === group.date;
  const isPastTarget = targetIso !== null && targetIso < todayIso;
  const willMerge = targetIso !== null && otherDaySet.has(targetIso);

  const targetInvalidReason = !targetIso
    ? null
    : isPastTarget
      ? 'لا يمكن اختيار يوم سابق.'
      : isSameDay
        ? 'هذا هو نفس اليوم الحالي — اختر يوماً مختلفاً.'
        : null;
  const targetValid = targetIso !== null && targetInvalidReason === null;

  const handleProceed = (): void => {
    if (!targetValid) return;
    if (hasReservations) {
      setStage('confirm');
      return;
    }
    submitTransfer();
  };

  const submitTransfer = (): void => {
    if (!targetIso || !targetValid) return;
    transferMut.mutate(
      { cycleId, fromDate: group.date, toDate: targetIso },
      {
        onSuccess: ({ moved, merged }) => {
          const total = moved.length + merged.length;
          const message =
            merged.length > 0
              ? `تم نقل ${num(total)} موعد (${num(merged.length)} دمج مع مواعيد قائمة)`
              : `تم نقل ${num(total)} موعد`;
          toast(message, 'success');
          onOpenChange(false);
        },
        onError: (err) => toast((err as Error).message, 'danger'),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`نقل يوم ${fmtDate(group.date, 'full')}`}
      size="md"
    >
      {stage === 'pick' ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-700">
            اختر اليوم المستهدف من التقويم لنقل جميع لجان هذا اليوم إليه.
            {hasReservations &&
              ' سيتم نقل الحجوزات الحالية مع كل لجنة دون فقد.'}
          </p>
          <DatePicker
            value={target}
            onChange={setTarget}
            min={todayIso}
            placeholder="اختر يوماً من التقويم…"
            label="اليوم المستهدف"
            error={targetInvalidReason ?? undefined}
            helper={
              willMerge
                ? 'هذا اليوم يحتوي مواعيد بالفعل. سيتم دمج كل لجنة مع نظيرتها في اليوم المستهدف (جمع السعة والحجوزات).'
                : targetIso !== null && targetValid
                  ? 'هذا يوم جديد. سيتم إنشاء مواعيد اللجان فيه بنفس السعة والحجوزات الحالية.'
                  : undefined
            }
          />
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button variant="primary" onClick={handleProceed} disabled={!targetValid}>
              {hasReservations ? 'متابعة' : willMerge ? 'دمج ونقل' : 'نقل'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-700">
            ستُنقل اللجان التالية إلى{' '}
            <span className="font-ar-display font-bold text-ink-900">
              {targetIso ? fmtDate(targetIso, 'full') : ''}
            </span>
            .{' '}
            {willMerge
              ? 'سيتم دمج كل لجنة مع نظيرتها في اليوم المستهدف (جمع السعة والحجوزات).'
              : 'الحجوزات تنتقل مع كل لجنة كما هي.'}
          </p>
          <ul className="max-h-48 overflow-auto rounded-md border border-terra-200 bg-terra-50 p-2 text-2xs text-terra-700">
            {reservedRows.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 py-0.5"
              >
                <span className="truncate">{r.committeeName}</span>
                <span className="font-numeric tnum">{num(effectiveReserved(r))} محجوز</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setStage('pick')}>
              رجوع
            </Button>
            <Button
              variant="primary"
              onClick={submitTransfer}
              isLoading={transferMut.isPending}
            >
              تأكيد النقل
            </Button>
          </div>
        </div>
      )}
    </Dialog>
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
}

function CommitteeRowsTable({ rows }: CommitteeRowsTableProps): JSX.Element {
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
            <th className="px-4 py-2 text-end text-2xs font-medium uppercase tracking-wide text-ink-500">
              المحجوز
            </th>
            <th className="px-4 py-2 text-end text-2xs font-medium uppercase tracking-wide text-ink-500">
              آخر تحديث
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
              <td className="px-4 py-2 align-middle text-end font-numeric tnum text-ink-900">
                {num(effectiveReserved(row))}
              </td>
              <td className="px-4 py-2 align-middle text-end">
                <LastUpdatedCell value={row.reservedRefreshedAt} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
