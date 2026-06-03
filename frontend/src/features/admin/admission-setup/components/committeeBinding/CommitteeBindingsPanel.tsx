/**
 * إدارة مواعيد الاختبارات واللجان — bindings panel (wizard step).
 *
 * Sources:
 *   - Committee **definitions** (the catalog) come from the
 *     `/admin/lookups/committees` lookup, read via `useLookup('committees')`.
 *     Definitions filtered by `applicantCategoryId === currentCategory`.
 *   - Per-cycle, per-date assignments are persisted as `CommitteeInstance`
 *     records via `committeeInstanceService` — the same record set the
 *     `/admin/committees` management page lists + edits. Edits in either
 *     surface update the same entity.
 *
 * UX: a 3-row grid (labels / inputs+button / helpers). The form picks
 * one or more applicant-categories, then the date + capacity. On submit
 * the panel fans out to every active definition in each picked category
 * and creates one instance per (definition × date). Already-existing
 * (cycle × definition × date) rows accumulate capacity through update;
 * missing ones come through insert. A summary toast reports both counts.
 *
 * Grid: rows are grouped by exam date inside a Radix Accordion. Each
 * section's body keeps three data columns — `الفئة`, `اللجنة`, `سعة اللجنة`
 * — plus the per-row delete. Rows are primary-sorted by `الفئة` so the
 * `MergedCategoryTable` can `rowSpan` consecutive matches into a single
 * vertically-centred cell.
 *
 * Wizard state contract: this panel persists only committee **codes**
 * (lookups['committees'].code) on the instance row. Display names are
 * resolved at render time from the lookup, never mirrored on the
 * instance. That's why dropping a definition from the lookup is enough
 * to drop it from every cycle that references it.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import {
  Accordion,
  AlertDialog,
  Button,
  Card,
  EmptyState,
  toast,
} from '@/shared/components';
import { date as fmtDate, num } from '@/shared/lib/format';
import { ROUTES } from '@/config/routes';
import { useLookup } from '@/features/lookups';
import {
  useCommitteeInstances,
  useRemoveCommitteeInstanceMutation,
  useUpdateCommitteeInstanceMutation,
} from '@/features/committees';
import type {
  AdmissionCycle,
} from '@/shared/types/domain';
import { CommitteeInstanceAddForm } from './CommitteeInstanceAddForm';

export interface CommitteeBindingsPanelProps {
  cycle: AdmissionCycle;
  active: Array<{ key: string; labelAr: string }>;
}

interface BindingRow {
  id: string;
  definitionCode: string;
  committeeName: string;
  date: string;
  capacity: number;
  categoryKey: string;
  categoryLabel: string;
}

/* ── Numeric-input guards (shared with inline capacity editor) ───────
 * `type="number"` lets users paste/keystroke `-`, `+`, `e`, `.` and end
 * up with a value the JS layer reads as `NaN` (or worse: a negative).
 * We swap to `type="text"` with `inputMode="numeric"`, sanitize the
 * value on change, and block the offending keystrokes outright. */

const BLOCKED_NUMERIC_KEYS = new Set(['-', '+', 'e', 'E', '.', ',']);

function sanitizeDigits(s: string): string {
  return s.replace(/\D+/g, '');
}

function isBlockedNumericKey(event: KeyboardEvent<HTMLInputElement>): boolean {
  return BLOCKED_NUMERIC_KEYS.has(event.key);
}

export function CommitteeBindingsPanel({
  cycle,
  active,
}: CommitteeBindingsPanelProps): JSX.Element {
  const definitionsQuery = useLookup('committees');
  const allDefinitions = definitionsQuery.data ?? [];

  const definitionNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const def of allDefinitions) map.set(def.code, def.name);
    return map;
  }, [allDefinitions]);

  /* Instances scoped to this cycle — the wizard surface only reads/writes
   * its own cycle's rows. The `/admin/committees-exam-config` management
   * page reads across all cycles. */
  const instancesQuery = useCommitteeInstances({ cycleId: cycle.id });
  const removeMut = useRemoveCommitteeInstanceMutation();
  const updateMut = useUpdateCommitteeInstanceMutation();
  const [rowToRemove, setRowToRemove] = useState<BindingRow | null>(null);

  const loading = instancesQuery.isLoading || definitionsQuery.isLoading;

  const handleRemove = (row: BindingRow): void => {
    setRowToRemove(row);
  };

  const confirmRemove = (): void => {
    if (!rowToRemove) return;
    removeMut.mutate(rowToRemove.id, {
      onSuccess: () => {
        setRowToRemove(null);
        toast('تم حذف الموعد', 'success');
      },
      onError: (err) => toast((err as Error).message, 'danger'),
    });
  };

  /* Build view rows by joining instances (this cycle) with the active
   * category list (for label) and the definitions lookup (for name).
   * Instances whose category isn't currently active in the cycle stay
   * filtered out — admins flip them back on by reactivating the category
   * upstream. */
  const activeLabelByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of active) map.set(a.key, a.labelAr);
    return map;
  }, [active]);

  const rows = useMemo<BindingRow[]>(() => {
    const out: BindingRow[] = [];
    for (const inst of instancesQuery.data ?? []) {
      const categoryLabel = activeLabelByKey.get(inst.categoryKey);
      if (!categoryLabel) continue;
      out.push({
        id: inst.id,
        definitionCode: inst.definitionCode,
        committeeName: definitionNameByCode.get(inst.definitionCode) ?? inst.definitionCode,
        date: inst.date,
        capacity: inst.capacity,
        categoryKey: inst.categoryKey,
        categoryLabel,
      });
    }
    return out;
  }, [activeLabelByKey, definitionNameByCode, instancesQuery.data]);

  /* ── grouping by exam date ─────────────────────────────────────── *
   * Within each date section rows are primary-sorted by الفئة (then by
   * committee name as a stable secondary key) so the rowspan-merge in
   * `MergedCategoryTable` lands on truly-consecutive matches. */
  const dateGroups = useMemo<{ date: string; rows: BindingRow[] }[]>(() => {
    const arabicCmp = (a: string, b: string): number =>
      a.localeCompare(b, 'ar', { numeric: true });
    const bucket = new Map<string, BindingRow[]>();
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
          const c = arabicCmp(a.categoryLabel, b.categoryLabel);
          return c !== 0 ? c : arabicCmp(a.committeeName, b.committeeName);
        }),
      }));
  }, [rows]);

  const handleCapacityCommit = (row: BindingRow, next: number): void => {
    updateMut.mutate(
      { id: row.id, patch: { capacity: next } },
      {
        onSuccess: () => toast('تم تحديث السعة', 'success'),
        onError: (err) => toast((err as Error).message, 'danger'),
      },
    );
  };

  if (active.length === 0) {
    return (
      <EmptyState
        variant="generic"
        title="لا توجد فئات مفعّلة في هذه الدورة"
        description="ارجع إلى الخطوة الأولى لتفعيل فئة واحدة على الأقل."
        action={
          <Link to={ROUTES.admin.admissionSetup.wizard('application_settings')}>
            <Button variant="primary">العودة إلى إعدادات التقديم</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <CommitteeInstanceAddForm cycle={cycle} active={active} />

      <DateGroupedView
        groups={dateGroups}
        loading={loading}
        isCapacitySaving={updateMut.isPending}
        onCapacityCommit={handleCapacityCommit}
        onDelete={handleRemove}
      />

      <AlertDialog
        open={rowToRemove !== null}
        onOpenChange={(open) => {
          if (!open) setRowToRemove(null);
        }}
        title="حذف موعد اختبار"
        description={
          rowToRemove
            ? `سيتم حذف موعد ${rowToRemove.committeeName} بتاريخ ${fmtDate(rowToRemove.date, 'full')}.`
            : undefined
        }
        actionLabel="حذف الموعد"
        cancelLabel="إلغاء"
        onAction={confirmRemove}
        tone="danger"
        isActionLoading={removeMut.isPending}
      />
    </div>
  );
}

/* ── Grouped accordion (by date) ─────────────────────────────────── */

interface DateGroupedViewProps {
  groups: { date: string; rows: BindingRow[] }[];
  loading: boolean;
  isCapacitySaving: boolean;
  onCapacityCommit: (row: BindingRow, next: number) => void;
  onDelete: (row: BindingRow) => void;
}

function DateGroupedView({
  groups,
  loading,
  isCapacitySaving,
  onCapacityCommit,
  onDelete,
}: DateGroupedViewProps): JSX.Element {
  const allDates = useMemo(() => groups.map((g) => g.date), [groups]);
  const [open, setOpen] = useState<string[]>(allDates);

  /* Auto-expand new dates as they appear (e.g. after the user adds a
   * new موعد) — track which dates we've already seen. */
  const seenRef = useRef<Set<string>>(new Set(allDates));
  useEffect(() => {
    const fresh = allDates.filter((d) => !seenRef.current.has(d));
    if (fresh.length === 0) return;
    seenRef.current = new Set(allDates);
    setOpen((prev) => Array.from(new Set([...prev, ...fresh])));
  }, [allDates]);

  if (!loading && groups.length === 0) {
    return (
      <Card>
        <div className="p-6">
          <EmptyState
            variant="generic"
            title="لم تُضف مواعيد اختبارات بعد"
            description="استخدم النموذج أعلاه لإضافة أول موعد."
          />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <Accordion
        type="multiple"
        value={open}
        onValueChange={(next) => setOpen(next as string[])}
      >
        {groups.map((g) => (
          <Accordion.Item key={g.date} value={g.date}>
            <Accordion.Trigger>
              <span>{fmtDate(g.date, 'full')}</span>
            </Accordion.Trigger>
            <Accordion.Content>
              <MergedCategoryTable
                rows={g.rows}
                isCapacitySaving={isCapacitySaving}
                onCapacityCommit={onCapacityCommit}
                onDelete={onDelete}
              />
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion>
    </Card>
  );
}

/* ── Per-section table with vertically-merged category cells ──────── *
 * Rows arrive already primary-sorted by `categoryLabel`, so we can
 * fold consecutive matches into a single `rowSpan`-ed `<td>`. The
 * merged cell uses `vertical-align: middle` for block-axis centering
 * and a subtle background tint + inline-end border to mark the group
 * boundary against the next column. Other cells stay per-row, so the
 * delete action on any row only affects that single row. */

interface MergedCategoryTableProps {
  rows: BindingRow[];
  isCapacitySaving: boolean;
  onCapacityCommit: (row: BindingRow, next: number) => void;
  onDelete: (row: BindingRow) => void;
}

function MergedCategoryTable({
  rows,
  isCapacitySaving,
  onCapacityCommit,
  onDelete,
}: MergedCategoryTableProps): JSX.Element {
  const groups = useMemo(() => {
    const out: { label: string; rows: Array<{ row: BindingRow; serial: number }> }[] = [];
    let serial = 0;
    for (const r of rows) {
      serial += 1;
      const last = out[out.length - 1];
      if (last && last.label === r.categoryLabel) last.rows.push({ row: r, serial });
      else out.push({ label: r.categoryLabel, rows: [{ row: r, serial }] });
    }
    return out;
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          variant="generic"
          title="لا توجد مواعيد لهذا اليوم بعد"
          description="استخدم النموذج أعلاه لإضافة موعد."
        />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-ink-50/80">
          <tr>
            <th className="w-14 px-3 py-2 text-center text-2xs font-medium text-ink-600 font-numeric tnum">
              م
            </th>
            <th className="px-3 py-2 text-start text-2xs font-medium text-ink-600">
              الفئة
            </th>
            <th className="px-3 py-2 text-start text-2xs font-medium text-ink-600">
              اللجنة
            </th>
            <th className="px-3 py-2 text-start text-2xs font-medium text-ink-600">
              سعة اللجنة
            </th>
            <th className="px-3 py-2">
              <span className="sr-only">إجراءات</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.flatMap((group) =>
            group.rows.map(({ row, serial }, idx) => (
              <tr key={row.id} className="border-t border-border-subtle">
                <th
                  scope="row"
                  className="px-3 py-2 text-center align-middle font-numeric text-2xs font-medium text-ink-500 tnum"
                >
                  <span dir="ltr">{serial.toLocaleString('en-US')}</span>
                </th>
                {idx === 0 && (
                  <td
                    rowSpan={group.rows.length}
                    className="border-e border-ink-100 bg-ink-50/50 px-3 py-2 align-middle text-2xs text-ink-900"
                  >
                    {group.label}
                  </td>
                )}
                <td className="px-3 py-2 align-middle text-2xs text-ink-900">
                  {row.committeeName}
                </td>
                <td className="px-3 py-2 align-middle">
                  <CapacityCell
                    row={row}
                    isSaving={isCapacitySaving}
                    onCommit={(next) => onCapacityCommit(row, next)}
                  />
                </td>
                <td className="px-3 py-2 align-middle text-end">
                  <button
                    type="button"
                    aria-label="حذف الموعد"
                    onClick={() => onDelete(row)}
                    className="inline-flex items-center justify-center rounded-md p-1.5 text-ink-500 transition-colors hover:bg-terra-50 hover:text-terra-700 focus-visible:shadow-focus-teal focus-visible:outline-none"
                  >
                    <Trash2 size={14} strokeWidth={1.75} aria-hidden />
                  </button>
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ── Inline-editable capacity cell ───────────────────────────────── */

interface CapacityCellProps {
  row: BindingRow;
  isSaving: boolean;
  onCommit: (next: number) => void;
}

function CapacityCell({ row, isSaving, onCommit }: CapacityCellProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(row.capacity));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(String(row.capacity));
  }, [row.capacity]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = (): void => {
    const next = Number(draft);
    if (!Number.isInteger(next) || next < 1) {
      toast('السعة يجب أن تكون عدداً صحيحاً 1 أو أكثر', 'danger');
      return;
    }
    if (next === row.capacity) {
      setEditing(false);
      return;
    }
    onCommit(next);
    setEditing(false);
  };

  const cancel = (): void => {
    setDraft(String(row.capacity));
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="تعديل السعة"
        className="group inline-flex items-center justify-start gap-1.5 rounded-md px-1 py-0.5 text-ink-900 transition-colors hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
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
    <div className="inline-flex items-center gap-1">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        onChange={(e) => setDraft(sanitizeDigits(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          } else if (isBlockedNumericKey(e)) {
            e.preventDefault();
          }
        }}
        onPaste={(e) => {
          const data = e.clipboardData.getData('text');
          const cleaned = sanitizeDigits(data);
          if (cleaned !== data) {
            e.preventDefault();
            setDraft((prev) => prev + cleaned);
          }
        }}
        disabled={isSaving}
        aria-label="السعة"
        style={{ inlineSize: 'fit-content', minInlineSize: '4ch' }}
        className="rounded-md border border-border-default bg-surface-elevated px-2 py-0.5 text-start font-numeric tnum text-2xs text-ink-900 focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none"
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
        onClick={cancel}
        disabled={isSaving}
        className="inline-flex items-center justify-center rounded-md p-1 text-ink-500 transition-colors hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none disabled:opacity-50"
      >
        <X size={12} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
