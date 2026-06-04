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
  RefreshCcw,
  Trash2,
} from 'lucide-react';
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
      }));
  }, [
    allInstancesQuery.data,
    activeCycleId,
    activeCategoryCodes,
    categoryLabelByKey,
    definitionNameByCode,
  ]);

  /* Group rows by date; sort dates ascending. Within each day, primary
   * sort by category label then committee name so visually consecutive
   * committees from the same category cluster together. Every day the
   * wizard authored is rendered — past, present, future — so admins
   * can audit completed exam days and keep parity with what they see
   * in the admission-setup wizard. */
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
  const hasBookings = group.rows.some((r) => effectiveReserved(r) > 0);
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
          ? 'لا يمكن حذف هذا اليوم لأن به حجوزات قائمة للمتقدمين. راجع الحجوزات قبل محاولة حذف الموعد.'
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
              اسم اللجنة
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
}

function CommitteeRowActions({
  row,
}: CommitteeRowActionsProps): JSX.Element {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const dayPassed = isPastDay(row.date);
  const reserved = effectiveReserved(row);
  const hasBookings = reserved > 0;
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
            ? `لا يمكن حذف هذا الموعد لأن به حجوزات قائمة للمتقدمين (${num(reserved)} حجز).`
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
