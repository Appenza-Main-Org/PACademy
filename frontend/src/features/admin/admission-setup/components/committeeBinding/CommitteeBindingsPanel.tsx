/**
 * إدارة مواعيد الاختبارات واللجان — bindings panel (wizard step).
 *
 * Form: a 3-row grid (labels / inputs+button / helpers) so the "إضافة"
 * button sits flush with the bottom edge of the input boxes regardless
 * of helper-text presence.
 *
 * Grid: rows are always grouped by exam date inside a Radix Accordion.
 * Each section's body is a flat DataTable with the four canonical
 * columns (`الفئة`, `اليوم`, `اللجنة`, `سعة اللجنة`) and is sortable —
 * the `اليوم` column is kept inside each section even though it's
 * redundant with the section header, so column order stays canonical
 * across views.
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
  DataTable,
  DatePicker,
  EmptyState,
  Input,
  MultiSelect,
  toast,
} from '@/shared/components';
import type {
  ComboboxOption,
  DataTableColumn,
  DataTableSort,
} from '@/shared/components';
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

  /* ── shared in-table sort (Arabic-collation aware) ────────────── */
  const [sort, setSort] = useState<DataTableSort<BindingRow> | null>({
    key: 'categoryLabel',
    direction: 'asc',
  });

  const sortRows = (input: readonly BindingRow[]): BindingRow[] => {
    if (!sort) return [...input];
    const dir = sort.direction === 'asc' ? 1 : -1;
    const arabicCmp = (a: string, b: string): number =>
      a.localeCompare(b, 'ar', { numeric: true });
    return [...input].sort((a, b) => {
      switch (sort.key) {
        case 'categoryLabel':
          return arabicCmp(a.categoryLabel, b.categoryLabel) * dir;
        case 'committeeName':
          return arabicCmp(a.committeeName, b.committeeName) * dir;
        case 'date':
          return a.date.localeCompare(b.date) * dir;
        case 'capacity':
          return (a.capacity - b.capacity) * dir;
        default:
          return 0;
      }
    });
  };

  /* ── grouping by exam date ─────────────────────────────────────── */
  const dateGroups = useMemo<
    { date: string; rows: BindingRow[] }[]
  >(() => {
    const bucket = new Map<string, BindingRow[]>();
    for (const r of rows) {
      const list = bucket.get(r.date);
      if (list) list.push(r);
      else bucket.set(r.date, [r]);
    }
    return Array.from(bucket.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, rs]) => ({ date, rows: sortRows(rs) }));
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [rows, sort]);

  /* ── columns ──────────────────────────────────────────────────── */
  const columns: DataTableColumn<BindingRow>[] = [
    {
      key: 'categoryLabel',
      label: 'الفئة',
      sortable: true,
      render: (r) => <span className="text-2xs text-ink-900">{r.categoryLabel}</span>,
    },
    {
      key: 'date',
      label: 'اليوم',
      sortable: true,
      render: (r) => (
        <span className="font-numeric tnum text-2xs text-ink-700">
          {fmtDate(r.date, 'full')}
        </span>
      ),
    },
    {
      key: 'committeeName',
      label: 'اللجنة',
      sortable: true,
      render: (r) => <span className="text-2xs text-ink-900">{r.committeeName}</span>,
    },
    {
      key: 'capacity',
      label: 'سعة اللجنة',
      sortable: true,
      align: 'start',
      render: (r) => (
        <CapacityCell
          row={r}
          isSaving={updateMut.isPending}
          onCommit={(next) =>
            updateMut.mutate(
              { id: r.id, categoryKey: r.categoryKey, patch: { capacity: next } },
              {
                onSuccess: () => toast('تم تحديث السعة', 'success'),
                onError: (err) => toast((err as Error).message, 'danger'),
              },
            )
          }
        />
      ),
    },
    {
      key: '_actions',
      label: <span className="sr-only">إجراءات</span>,
      align: 'end',
      render: (r) => (
        <button
          type="button"
          aria-label="حذف الموعد"
          onClick={() => handleRemove(r)}
          className="inline-flex items-center justify-center rounded-md p-1.5 text-ink-500 transition-colors hover:bg-terra-50 hover:text-terra-700 focus-visible:shadow-focus-teal focus-visible:outline-none"
        >
          <Trash2 size={14} strokeWidth={1.75} aria-hidden />
        </button>
      ),
    },
  ];

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
         * 3-row grid keeps the "إضافة" button anchored to the input
         * baseline regardless of helper-text presence:
         *  row 1 = labels   ·  row 2 = inputs + button  ·  row 3 = helpers
         * The `auto auto auto` row track plus `items-end` on row 2
         * gives the button (matching block-size `h-9`) a bottom flush
         * with the inputs.
         */}
        <div className="grid grid-rows-[auto_auto_auto] items-end gap-x-3 gap-y-1 p-4 md:grid-cols-[1fr_1fr_220px_auto]">
          {/* ── row 1: labels ───────────────────────────────────── */}
          <FieldLabel htmlFor="bindings-cats">الفئات</FieldLabel>
          <FieldLabel>تاريخ الاختبار</FieldLabel>
          <FieldLabel htmlFor="bindings-capacity">سعة اللجنة</FieldLabel>
          <span aria-hidden />

          {/* ── row 2: inputs + button ──────────────────────────── */}
          <MultiSelect
            ariaLabel="الفئات"
            options={categoryOptions}
            value={selectedCategories}
            onChange={setSelectedCategories}
            placeholder="اختر فئة أو أكثر…"
          />
          <DatePicker
            value={pickedDate}
            onChange={setPickedDate}
            placeholder="اختر تاريخ الاختبار…"
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

          {/* ── row 3: helpers ──────────────────────────────────── */}
          <FieldHelper>فئة واحدة على الأقل</FieldHelper>
          <span aria-hidden />
          <FieldHelper>1 أو أكثر</FieldHelper>
          <span aria-hidden />
        </div>
      </Card>

      <DateGroupedView
        groups={dateGroups}
        columns={columns}
        loading={scheduleLoading}
        sort={sort}
        onSortChange={setSort}
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

function FieldHelper({ children }: { children: string }): JSX.Element {
  return <p className="text-xs text-ink-500">{children}</p>;
}

/* ── Grouped accordion (by date) ─────────────────────────────────── */

interface DateGroupedViewProps {
  groups: { date: string; rows: BindingRow[] }[];
  columns: DataTableColumn<BindingRow>[];
  loading: boolean;
  sort: DataTableSort<BindingRow> | null;
  onSortChange: (next: DataTableSort<BindingRow> | null) => void;
}

function DateGroupedView({
  groups,
  columns,
  loading,
  sort,
  onSortChange,
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
              <span className="flex items-center gap-2">
                <span>{fmtDate(g.date, 'full')}</span>
                <span className="rounded-pill bg-ink-100 px-2 py-0.5 font-numeric tnum text-2xs text-ink-700">
                  {num(g.rows.length)}
                </span>
              </span>
            </Accordion.Trigger>
            <Accordion.Content>
              <DataTable
                data={g.rows}
                columns={columns}
                rowKey={(r) => r.id}
                loading={loading}
                sort={sort}
                onSortChange={onSortChange}
                empty={
                  <EmptyState
                    variant="generic"
                    title="لا توجد مواعيد لهذا اليوم بعد"
                    description="استخدم النموذج أعلاه لإضافة موعد."
                  />
                }
                zebraStripes
              />
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion>
    </Card>
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
