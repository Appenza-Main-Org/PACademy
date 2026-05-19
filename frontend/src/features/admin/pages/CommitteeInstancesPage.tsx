/**
 * /admin/committees-exam-config — committee instances management.
 *
 * Lists every CommitteeInstance configured for the **currently selected
 * cycle**, grouped by exam day. Each day section lists the committees
 * sitting on that day with their category, capacity, and inline-editable
 * capacity. Same record set the admission-setup wizard step authors at
 * `/admin/cycles/admission-setup/wizard/committees`.
 *
 * Cycle scope:
 *   - The cycle id is read from the `?cycle=…` URL search param so the
 *     selection survives navigation back to the page.
 *   - Default: the active cycle (`useActiveCycle()`), falling back to the
 *     first cycle that has at least one instance.
 *   - When more than one cycle exists in the system, a SearchSelect
 *     surfaces next to the page header for switching.
 */

import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Check,
  ChevronsDownUp,
  ChevronsUpDown,
  MoveRight,
  MoreVertical,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import {
  Accordion,
  AlertDialog,
  Button,
  Card,
  Dialog,
  DropdownMenu,
  EmptyState,
  LoadingState,
  PageHeader,
  SearchSelect,
  toast,
} from '@/shared/components';
import { date as fmtDate, num } from '@/shared/lib/format';
import { ROUTES } from '@/config/routes';
import { useActiveCycle, useCycles } from '../api/cycles.queries';
import { useLookup } from '@/features/lookups';
import {
  useCommitteeInstances,
  useRemoveCommitteeInstanceDayMutation,
  useTransferCommitteeInstanceDayMutation,
  useUpdateCommitteeInstanceMutation,
} from '@/features/committees';
import type { AdmissionCycle, CommitteeInstance } from '@/shared/types/domain';
import {
  resolveExpandedDates,
  useDayExpansionStore,
} from './committee-instances/expansionStore';

const BLOCKED_NUMERIC_KEYS = new Set(['-', '+', 'e', 'E', '.', ',']);

function sanitizeDigits(s: string): string {
  return s.replace(/\D+/g, '');
}

function isBlockedNumericKey(event: KeyboardEvent<HTMLInputElement>): boolean {
  return BLOCKED_NUMERIC_KEYS.has(event.key);
}

interface InstanceRow extends CommitteeInstance {
  categoryLabelAr: string;
  committeeName: string;
}

interface DayGroup {
  date: string;
  rows: InstanceRow[];
}

export function CommitteeInstancesPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const cyclesQuery = useCycles({ includeDeleted: false });
  const activeCycleQuery = useActiveCycle();
  const allInstancesQuery = useCommitteeInstances();
  const definitionsQuery = useLookup('committees');
  const categoriesQuery = useLookup('applicant-categories');

  /* Cycle resolution: explicit `?cycle=` wins; else active cycle id; else
   * the first cycle that has any instances; else null. Stored back into
   * the URL search param when the user picks one so the selection is
   * shareable + survives back/forward nav. */
  const cycleIdsWithInstances = useMemo(() => {
    const set = new Set<string>();
    for (const i of allInstancesQuery.data ?? []) set.add(i.cycleId);
    return set;
  }, [allInstancesQuery.data]);

  const explicitCycleId = searchParams.get('cycle');
  const resolvedCycleId = useMemo<string | null>(() => {
    if (explicitCycleId) return explicitCycleId;
    if (activeCycleQuery.data?.id) return activeCycleQuery.data.id;
    const first = (cyclesQuery.data ?? []).find((c) => cycleIdsWithInstances.has(c.id));
    if (first) return first.id;
    return cyclesQuery.data?.[0]?.id ?? null;
  }, [
    explicitCycleId,
    activeCycleQuery.data,
    cyclesQuery.data,
    cycleIdsWithInstances,
  ]);

  const setCycleId = (next: string | null): void => {
    setSearchParams((prev) => {
      const sp = new URLSearchParams(prev);
      if (next) sp.set('cycle', next);
      else sp.delete('cycle');
      return sp;
    });
  };

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
    if (!resolvedCycleId) return [];
    return (allInstancesQuery.data ?? [])
      .filter((i) => i.cycleId === resolvedCycleId)
      .map((inst) => ({
        ...inst,
        categoryLabelAr: categoryLabelByKey.get(inst.categoryKey) ?? inst.categoryKey,
        committeeName: definitionNameByCode.get(inst.definitionCode) ?? inst.definitionCode,
      }));
  }, [
    allInstancesQuery.data,
    resolvedCycleId,
    categoryLabelByKey,
    definitionNameByCode,
  ]);

  /* Group rows by date; sort dates ascending. Within each day, primary
   * sort by category label then committee name so visually consecutive
   * committees from the same category cluster together. */
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

  const cycleOptions = useMemo(
    () =>
      (cyclesQuery.data ?? []).map((c) => ({
        value: c.id,
        label: c.nameAr,
        keywords: c.labelEn ?? '',
      })),
    [cyclesQuery.data],
  );

  const selectedCycle = useMemo<AdmissionCycle | null>(() => {
    if (!resolvedCycleId) return null;
    return (cyclesQuery.data ?? []).find((c) => c.id === resolvedCycleId) ?? null;
  }, [cyclesQuery.data, resolvedCycleId]);

  const showCycleSelector = (cyclesQuery.data ?? []).length > 1;

  const loading =
    allInstancesQuery.isLoading ||
    cyclesQuery.isLoading ||
    definitionsQuery.isLoading ||
    categoriesQuery.isLoading;

  /* Expansion state — persisted per cycle in localStorage. Default is
   * "all days expanded" until the admin touches a section, after which
   * their explicit set wins until they hit reset. */
  const byCycle = useDayExpansionStore((s) => s.byCycle);
  const setExpanded = useDayExpansionStore((s) => s.setExpanded);
  const allDayDates = useMemo(() => dayGroups.map((g) => g.date), [dayGroups]);
  const expandedDates = useMemo(
    () => resolveExpandedDates(byCycle, resolvedCycleId, allDayDates),
    [byCycle, resolvedCycleId, allDayDates],
  );

  const handleExpansionChange = (next: string[]): void => {
    if (!resolvedCycleId) return;
    setExpanded(resolvedCycleId, next);
  };

  const expandAll = (): void => {
    if (!resolvedCycleId) return;
    setExpanded(resolvedCycleId, allDayDates);
  };

  const collapseAll = (): void => {
    if (!resolvedCycleId) return;
    setExpanded(resolvedCycleId, []);
  };

  const allExpanded = allDayDates.length > 0 && expandedDates.length === allDayDates.length;
  const allCollapsed = expandedDates.length === 0;

  return (
    <CenteredShell>
      <PageHeader
        title="إدارة مواعيد اللجان"
        subtitle="مواعيد اللجان داخل الدورة المختارة، مُجمَّعة باليوم. اللجان نفسها تُدار في الأكواد المرجعية؛ مواعيد كل دورة تُنشأ من معالج إعداد التقديم وتُحرّر هنا."
        breadcrumbs={[
          { label: 'إدارة المنظومة', href: ROUTES.admin.dashboard },
          { label: 'مواعيد اللجان' },
        ]}
      />

      <CycleHeaderBlock
        cycle={selectedCycle}
        showSelector={showCycleSelector}
        options={cycleOptions}
        onChange={setCycleId}
      />

      {loading ? (
        <LoadingState variant="card-grid" />
      ) : dayGroups.length === 0 ? (
        <Card>
          <div className="p-6">
            <EmptyState
              variant="generic"
              title={
                selectedCycle
                  ? `لا توجد مواعيد لجان في ${selectedCycle.nameAr}`
                  : 'لا توجد مواعيد لجان لعرضها'
              }
              description="افتح إعداد التقديم في «دورات القبول» لإنشاء أول موعد."
            />
          </div>
        </Card>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
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
                      resolvedCycleId ? (
                        <DayActionsMenu
                          cycleId={resolvedCycleId}
                          group={group}
                          otherDays={dayGroups
                            .filter((g) => g.date !== group.date)
                            .map((g) => g.date)}
                        />
                      ) : null
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
  const reservedRows = group.rows.filter((r) => r.reserved > 0);
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
              <span className="font-numeric tnum">
                {num(r.reserved)} / {num(r.capacity)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </AlertDialog>
  );
}

/* ── Transfer-day flow ───────────────────────────────────────────── *
 * Two-step: pick a target date (SearchSelect of other days in the same
 * cycle), then — only if any reservations exist — a confirmation panel
 * that lists what's moving. Both steps render inside the same Dialog so
 * the admin can step back to change the target without re-opening.      */

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
  const [target, setTarget] = useState<string | null>(null);
  const [stage, setStage] = useState<'pick' | 'confirm'>('pick');

  /* Reset internal state every time the dialog opens. */
  useEffect(() => {
    if (open) {
      setTarget(null);
      setStage('pick');
    }
  }, [open]);

  const reservedRows = group.rows.filter((r) => r.reserved > 0);
  const hasReservations = reservedRows.length > 0;

  const targetOptions = useMemo(
    () =>
      otherDays
        .slice()
        .sort()
        .map((d) => ({
          value: d,
          label: fmtDate(d, 'full'),
          keywords: d,
        })),
    [otherDays],
  );

  const handleProceed = (): void => {
    if (!target) return;
    if (hasReservations) {
      setStage('confirm');
      return;
    }
    submitTransfer();
  };

  const submitTransfer = (): void => {
    if (!target) return;
    transferMut.mutate(
      { cycleId, fromDate: group.date, toDate: target },
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
            اختر اليوم المستهدف لنقل جميع لجان هذا اليوم إليه.
            {hasReservations &&
              ' سيتم نقل الحجوزات الحالية مع كل لجنة دون فقد، ودمج التكرارات مع المواعيد الموجودة.'}
          </p>
          <SearchSelect
            ariaLabel="اليوم المستهدف"
            value={target}
            onChange={setTarget}
            options={targetOptions}
            placeholder="اختر يوماً…"
            emptyText="لا توجد أيام أخرى لهذه الدورة"
          />
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button variant="primary" onClick={handleProceed} disabled={!target}>
              {hasReservations ? 'متابعة' : 'نقل'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-700">
            ستُنقل اللجان التالية إلى{' '}
            <span className="font-ar-display font-bold text-ink-900">
              {target ? fmtDate(target, 'full') : ''}
            </span>
            . الحجوزات تنتقل مع كل لجنة كما هي.
          </p>
          <ul className="max-h-48 overflow-auto rounded-md border border-terra-200 bg-terra-50 p-2 text-2xs text-terra-700">
            {reservedRows.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 py-0.5"
              >
                <span className="truncate">{r.committeeName}</span>
                <span className="font-numeric tnum">
                  {num(r.reserved)} / {num(r.capacity)}
                </span>
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

/* ── Cycle field at the top of the page ─────────────────────────── */

interface CycleHeaderBlockProps {
  cycle: AdmissionCycle | null;
  showSelector: boolean;
  options: ReadonlyArray<{ value: string; label: string; keywords?: string }>;
  onChange: (next: string | null) => void;
}

function CycleHeaderBlock({
  cycle,
  showSelector,
  options,
  onChange,
}: CycleHeaderBlockProps): JSX.Element {
  return (
    <Card variant="elevated" className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-2xs font-medium uppercase tracking-wide text-ink-500">
            الدورة
          </span>
          <span className="font-ar-display text-md font-bold text-ink-900">
            {cycle ? cycle.nameAr : 'لم تُحدد بعد'}
          </span>
        </div>
        {showSelector && (
          <div className="min-w-[18rem]">
            <SearchSelect
              ariaLabel="اختر الدورة"
              value={cycle?.id ?? null}
              onChange={(next) => onChange(next)}
              options={options}
              placeholder="اختر دورة…"
            />
          </div>
        )}
      </div>
    </Card>
  );
}

/* ── Per-day committee rows ──────────────────────────────────────── */

interface CommitteeRowsTableProps {
  rows: InstanceRow[];
}

function CommitteeRowsTable({ rows }: CommitteeRowsTableProps): JSX.Element {
  const updateMut = useUpdateCommitteeInstanceMutation();

  const handleCapacityCommit = (row: InstanceRow, next: number): void => {
    if (next === row.capacity) return;
    updateMut.mutate(
      { id: row.id, patch: { capacity: next } },
      {
        onSuccess: () => toast('تم تحديث السعة', 'success'),
        onError: (err) => toast((err as Error).message, 'danger'),
      },
    );
  };

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
              سعة اللجنة
            </th>
            <th className="px-4 py-2 text-end text-2xs font-medium uppercase tracking-wide text-ink-500">
              المحجوز
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
              <td className="px-4 py-2 align-middle text-end">
                <CapacityCell
                  row={row}
                  isSaving={updateMut.isPending}
                  onCommit={(next) => handleCapacityCommit(row, next)}
                />
              </td>
              <td className="px-4 py-2 align-middle text-end">
                <ReservedCell row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Reserved-vs-capacity cell ───────────────────────────────────── *
 * Visual emphasis tracks utilisation:
 *   reserved ≥ capacity         → terra-700 on terra-50 (over capacity)
 *   reserved ≥ 0.9 × capacity   → gold-700 on gold-50 (approaching)
 *   else                        → plain ink-700                                 */

interface ReservedCellProps {
  row: InstanceRow;
}

function ReservedCell({ row }: ReservedCellProps): JSX.Element {
  const ratio = row.capacity > 0 ? row.reserved / row.capacity : 0;
  const overCapacity = row.reserved >= row.capacity;
  const approaching = !overCapacity && ratio >= 0.9;
  const tone = overCapacity
    ? 'bg-terra-50 text-terra-700 ring-1 ring-inset ring-terra-200'
    : approaching
      ? 'bg-gold-50 text-gold-700 ring-1 ring-inset ring-gold-200'
      : 'text-ink-700';
  const label = overCapacity
    ? 'تجاوز السعة'
    : approaching
      ? 'يقترب من السعة'
      : undefined;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-numeric tnum text-2xs ${tone}`}
      aria-label={
        label
          ? `${num(row.reserved)} من ${num(row.capacity)} (${label})`
          : `${num(row.reserved)} من ${num(row.capacity)}`
      }
      title={label}
    >
      <span>{num(row.reserved)}</span>
      <span aria-hidden className="text-ink-400">/</span>
      <span>{num(row.capacity)}</span>
    </span>
  );
}

/* ── Inline-editable capacity cell ────────────────────────────────── */

interface CapacityCellProps {
  row: InstanceRow;
  isSaving: boolean;
  onCommit: (next: number) => void;
}

function CapacityCell({ row, isSaving, onCommit }: CapacityCellProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(String(row.capacity));

  /* Keep draft in sync if upstream capacity changes (e.g. via the wizard
   * step) while the field is collapsed. Only mirrors when not editing so
   * the user's in-progress edit isn't stomped. */
  useEffect(() => {
    if (!editing) setDraft(String(row.capacity));
  }, [editing, row.capacity]);

  const commit = (): void => {
    const next = Number(draft);
    if (!Number.isInteger(next) || next < 1) {
      toast('السعة يجب أن تكون عدداً صحيحاً 1 أو أكثر', 'danger');
      return;
    }
    onCommit(next);
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(String(row.capacity));
          setEditing(true);
        }}
        aria-label="تعديل السعة"
        className="group inline-flex items-center justify-end gap-1.5 rounded-md px-1 py-0.5 text-ink-900 transition-colors hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
      >
        <span className="font-numeric tnum">{num(row.capacity)}</span>
        <Pencil
          size={11}
          strokeWidth={1.75}
          className="text-ink-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        />
      </button>
    );
  }

  return (
    <div className="inline-flex items-center justify-end gap-1">
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(sanitizeDigits(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setEditing(false);
          } else if (isBlockedNumericKey(e)) {
            e.preventDefault();
          }
        }}
        disabled={isSaving}
        aria-label="السعة"
        style={{ inlineSize: 'fit-content', minInlineSize: '4ch' }}
        className="rounded-md border border-border-default bg-surface-elevated px-2 py-0.5 text-end font-numeric tnum text-2xs text-ink-900 focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none"
      />
      <button
        type="button"
        aria-label="حفظ السعة"
        onClick={commit}
        disabled={isSaving}
        className="inline-flex items-center justify-center rounded-md p-1 text-teal-700 transition-colors hover:bg-teal-50 focus-visible:shadow-focus-teal focus-visible:outline-none disabled:opacity-50"
      >
        <Check size={12} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        aria-label="إلغاء"
        onClick={() => setEditing(false)}
        disabled={isSaving}
        className="inline-flex items-center justify-center rounded-md p-1 text-ink-500 transition-colors hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none disabled:opacity-50"
      >
        <X size={12} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
