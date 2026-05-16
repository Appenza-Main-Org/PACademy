/**
 * إدارة مواعيد الاختبارات واللجان — bindings panel (wizard step).
 *
 * Form: a 3-row grid (labels / inputs+button / helpers) so the "إضافة"
 * button sits flush with the bottom edge of the input boxes regardless
 * of helper-text presence.
 *
 * Grid: rows are always grouped by exam date inside a Radix Accordion.
 * The `اليوم` value lives in the section header, so each section's
 * body keeps only three data columns — `الفئة`, `اللجنة`, `سعة اللجنة`
 * — plus the per-row delete action. Rows are always primary-sorted by
 * `الفئة` so a custom `MergedCategoryTable` can `rowSpan` consecutive
 * matches into a single vertically-centred cell.
 *
 * Add semantics: idempotent merge. When the user submits, the panel
 * splits the (category × committee × date) targets into two buckets —
 * rows that already exist accumulate their capacity via update; rows
 * that don't are inserted via `addScheduleEntries`. A summary toast
 * reports both counts.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import {
  Accordion,
  Button,
  Card,
  CardHeader,
  DatePicker,
  EmptyState,
  Input,
  MultiSelect,
  toast,
} from '@/shared/components';
import type { ComboboxOption } from '@/shared/components';
import { date as fmtDate, num } from '@/shared/lib/format';
import { ROUTES } from '@/config/routes';
import {
  scheduleKeys,
  useAddScheduleEntriesMutation,
  useCommittees,
  useRemoveScheduleEntryMutation,
  useUpdateScheduleEntryMutation,
} from '@/features/committees/api/committee.queries';
import { committeeService } from '@/features/committees/api/committee.service';
import type {
  AdmissionCycle,
  ApplicantCategoryKey,
  ExamScheduleEntry,
} from '@/shared/types/domain';

export interface CommitteeBindingsPanelProps {
  cycle: AdmissionCycle;
  active: Array<{ key: ApplicantCategoryKey; labelAr: string }>;
}

interface BindingRow {
  id: string;
  committeeId: string;
  committeeName: string;
  date: string;
  capacity: number;
  categoryKey: ApplicantCategoryKey;
  categoryLabel: string;
}

/* ── Numeric-input guards ────────────────────────────────────────────
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

function toIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function CommitteeBindingsPanel({
  active,
}: CommitteeBindingsPanelProps): JSX.Element {
  const committeesQuery = useCommittees();
  const allCommittees = committeesQuery.data ?? [];
  const committeeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of allCommittees) map.set(c.id, c.name);
    return map;
  }, [allCommittees]);

  const addEntriesMut = useAddScheduleEntriesMutation();
  const removeMut = useRemoveScheduleEntryMutation();
  const updateMut = useUpdateScheduleEntryMutation();

  /* ── form state ───────────────────────────────────────────────── */
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [pickedDate, setPickedDate] = useState<Date | null>(null);
  const [capacityStr, setCapacityStr] = useState<string>('');

  const capacityRaw = Number(capacityStr);
  const capacityValid =
    capacityStr.length > 0 &&
    Number.isInteger(capacityRaw) &&
    capacityRaw >= 1;
  const dateValid = pickedDate !== null;
  const categoriesValid = selectedCategories.length >= 1;

  /* ── grid data: one query per active category ─────────────────── */
  const scheduleQueries = useQueries({
    queries: active.map((a) => ({
      queryKey: scheduleKeys.byCategory(a.key),
      queryFn: () => committeeService.listSchedule(a.key),
    })),
  });
  const scheduleLoading = scheduleQueries.some((q) => q.isLoading);
  const submitting = addEntriesMut.isPending || updateMut.isPending;

  const canSubmit =
    dateValid &&
    capacityValid &&
    categoriesValid &&
    !submitting &&
    !scheduleLoading;

  const categoryOptions = useMemo<ComboboxOption[]>(
    () => active.map((a) => ({ value: a.key, label: a.labelAr })),
    [active],
  );

  const formCommitteeCount = useMemo(() => {
    return selectedCategories.reduce((sum, key) => {
      return (
        sum +
        allCommittees.filter(
          (c) => c.categoryKey === (key as ApplicantCategoryKey) && !c.deletedAt,
        ).length
      );
    }, 0);
  }, [allCommittees, selectedCategories]);

  const handleAdd = async (): Promise<void> => {
    if (!canSubmit || !pickedDate) return;
    const iso = toIsoDate(pickedDate);

    /* Build (category × committee × date) targets for the selected
     * categories. */
    const targets: Array<{
      categoryKey: ApplicantCategoryKey;
      committeeId: string;
      date: string;
      capacity: number;
    }> = [];
    for (const key of selectedCategories) {
      const catKey = key as ApplicantCategoryKey;
      const cats = allCommittees.filter(
        (c) => c.categoryKey === catKey && !c.deletedAt,
      );
      for (const committee of cats) {
        targets.push({
          categoryKey: catKey,
          committeeId: committee.id,
          date: iso,
          capacity: capacityRaw,
        });
      }
    }

    /* Partition: rows already present accumulate; rows missing are
     * inserted. Existing rows live in the per-category schedule query
     * caches we already streamed via `useQueries`. */
    const existingByKey = new Map<string, ExamScheduleEntry>();
    scheduleQueries.forEach((q) => {
      const rows = q.data ?? [];
      for (const e of rows) existingByKey.set(`${e.committeeId}|${e.date}`, e);
    });

    const updates: Array<{
      id: string;
      categoryKey: ApplicantCategoryKey;
      nextCapacity: number;
    }> = [];
    const inserts: typeof targets = [];
    for (const t of targets) {
      const existing = existingByKey.get(`${t.committeeId}|${t.date}`);
      if (existing) {
        updates.push({
          id: existing.id,
          categoryKey: t.categoryKey,
          nextCapacity: existing.capacity + t.capacity,
        });
      } else {
        inserts.push(t);
      }
    }

    try {
      await Promise.all([
        ...updates.map((u) =>
          updateMut.mutateAsync({
            id: u.id,
            categoryKey: u.categoryKey,
            patch: { capacity: u.nextCapacity },
          }),
        ),
        inserts.length > 0
          ? addEntriesMut.mutateAsync(inserts)
          : Promise.resolve(null),
      ]);
      const added = inserts.length;
      const merged = updates.length;
      const message =
        added > 0 && merged > 0
          ? `تمت إضافة ${num(added)} موعد جديد ودمج ${num(merged)} موعد قائم`
          : added > 0
            ? `تمت إضافة ${num(added)} موعد`
            : `تم دمج ${num(merged)} موعد قائم`;
      toast(message, 'success');
      setSelectedCategories([]);
      setPickedDate(null);
      setCapacityStr('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذّر إضافة المواعيد';
      toast(message, 'danger');
    }
  };

  const handleRemove = (row: BindingRow): void => {
    if (typeof window !== 'undefined') {
      const ok = window.confirm('سيتم حذف هذا الموعد. هل تريد المتابعة؟');
      if (!ok) return;
    }
    removeMut.mutate(
      { id: row.id, categoryKey: row.categoryKey },
      {
        onSuccess: () => toast('تم حذف الموعد', 'success'),
        onError: (err) => toast((err as Error).message, 'danger'),
      },
    );
  };

  const rows = useMemo<BindingRow[]>(() => {
    const out: BindingRow[] = [];
    scheduleQueries.forEach((q, idx) => {
      const cat = active[idx];
      if (!cat || !q.data) return;
      for (const entry of q.data) {
        out.push({
          id: entry.id,
          committeeId: entry.committeeId,
          committeeName: committeeNameById.get(entry.committeeId) ?? entry.committeeId,
          date: entry.date,
          capacity: entry.capacity,
          categoryKey: cat.key,
          categoryLabel: cat.labelAr,
        });
      }
    });
    return out;
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [
    active,
    committeeNameById,
    scheduleQueries.map((q) => q.dataUpdatedAt).join('|'),
    scheduleQueries.map((q) => q.data?.length ?? 0).join('|'),
  ]);

  /* ── grouping by exam date ─────────────────────────────────────── *
   * Within each date section rows are primary-sorted by الفئة (then by
   * committee name as a stable secondary key) so the rowspan-merge in
   * `MergedCategoryTable` lands on truly-consecutive matches. */
  const dateGroups = useMemo<
    { date: string; rows: BindingRow[] }[]
  >(() => {
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
      { id: row.id, categoryKey: row.categoryKey, patch: { capacity: next } },
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
      <Card variant="elevated">
        <CardHeader
          title="إضافة موعد اختبار"
          subtitle={
            selectedCategories.length === 0
              ? 'اختر فئة واحدة على الأقل ليتم إنشاء موعد لكل لجنة فيها.'
              : `سيتم إنشاء موعد لكل لجنة في الفئات المحددة (${num(formCommitteeCount)} موعد).`
          }
        />
        {/*
         * 2-row grid keeps the "إضافة" button anchored to the input
         * baseline:
         *  row 1 = labels   ·  row 2 = inputs + button
         * The `auto auto` row track plus `items-end` on row 2
         * gives the button (matching block-size `h-9`) a bottom flush
         * with the inputs.
         */}
        <div className="grid grid-rows-[auto_auto] items-end gap-x-3 gap-y-1 p-4 md:grid-cols-[1fr_1fr_220px_auto]">
          {/* ── row 1: labels ───────────────────────────────────── */}
          <FieldLabel htmlFor="bindings-cats">الفئات</FieldLabel>
          <FieldLabel>اليوم</FieldLabel>
          <FieldLabel htmlFor="bindings-capacity">سعة اللجنة</FieldLabel>
          <span aria-hidden />

          {/* ── row 2: inputs + button ──────────────────────────── */}
          <MultiSelect
            ariaLabel="الفئات"
            options={categoryOptions}
            value={selectedCategories}
            onChange={setSelectedCategories}
            placeholder="اختر فئة أو أكثر…"
            centered
          />
          <DatePicker
            value={pickedDate}
            onChange={setPickedDate}
            placeholder="اختر اليوم…"
          />
          <Input
            id="bindings-capacity"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label="سعة اللجنة"
            value={capacityStr}
            onChange={(e) => setCapacityStr(sanitizeDigits(e.target.value))}
            onKeyDown={(e) => {
              if (isBlockedNumericKey(e)) e.preventDefault();
            }}
            onPaste={(e) => {
              const data = e.clipboardData.getData('text');
              const cleaned = sanitizeDigits(data);
              if (cleaned !== data) {
                e.preventDefault();
                setCapacityStr((prev) => prev + cleaned);
              }
            }}
          />
          <Button
            variant="primary"
            size="md"
            onClick={handleAdd}
            disabled={!canSubmit}
            isLoading={submitting}
            className="self-end"
          >
            إضافة
          </Button>
        </div>
      </Card>

      <DateGroupedView
        groups={dateGroups}
        loading={scheduleLoading}
        isCapacitySaving={updateMut.isPending}
        onCapacityCommit={handleCapacityCommit}
        onDelete={handleRemove}
      />
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────── */

interface FieldLabelProps {
  htmlFor?: string;
  children: string;
}

function FieldLabel({ htmlFor, children }: FieldLabelProps): JSX.Element {
  return (
    <label
      htmlFor={htmlFor}
      className="text-sm font-medium text-ink-700"
    >
      {children}
      <span className="ms-1 text-terra-500" aria-hidden>
        *
      </span>
    </label>
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
    const out: { label: string; rows: BindingRow[] }[] = [];
    for (const r of rows) {
      const last = out[out.length - 1];
      if (last && last.label === r.categoryLabel) last.rows.push(r);
      else out.push({ label: r.categoryLabel, rows: [r] });
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
            group.rows.map((row, idx) => (
              <tr key={row.id} className="border-t border-border-subtle">
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
