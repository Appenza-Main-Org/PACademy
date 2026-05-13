/**
 * إدارة مواعيد الاختبارات واللجان — bindings panel (wizard step).
 *
 * A single flat surface (no per-category Tabs): the operator picks one
 * or more applicant categories in the "إضافة موعد اختبار" form, sets a
 * date and capacity, and the panel fans out one row per (category ×
 * committee) into `examSchedule`.
 *
 * The grid below renders every active category's entries together with
 * a category column. When sorted by `الفئة` the rows collapse into an
 * Accordion, one section per category (default: all expanded). Sorting
 * by any other column reverts to a flat table.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
  useAddScheduleBatchMutation,
  useCommittees,
  useRemoveScheduleEntryMutation,
  useUpdateScheduleEntryMutation,
} from '@/features/committees/api/committee.queries';
import { committeeService } from '@/features/committees/api/committee.service';
import type {
  AdmissionCycle,
  ApplicantCategoryKey,
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

const CATEGORY_SORT_KEY = 'categoryLabel' as const;

function toIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function CommitteeBindingsPanel({
  active,
}: CommitteeBindingsPanelProps): JSX.Element {
  /* The `?categoryId=` search-param used to scope the previous Tabs is
   * obsolete — wipe it once on mount so deep links don't carry stale
   * scoping into the new flat view. */
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (!searchParams.has('categoryId')) return;
    const sp = new URLSearchParams(searchParams);
    sp.delete('categoryId');
    setSearchParams(sp, { replace: true });
  }, [searchParams, setSearchParams]);

  const committeesQuery = useCommittees();
  const allCommittees = committeesQuery.data ?? [];
  const committeeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of allCommittees) map.set(c.id, c.name);
    return map;
  }, [allCommittees]);

  const addBatchMut = useAddScheduleBatchMutation();
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
  const canSubmit =
    dateValid && capacityValid && categoriesValid && !addBatchMut.isPending;

  const categoryOptions = useMemo<ComboboxOption[]>(
    () => active.map((a) => ({ value: a.key, label: a.labelAr })),
    [active],
  );

  const handleAdd = async (): Promise<void> => {
    if (!canSubmit || !pickedDate) return;
    const iso = toIsoDate(pickedDate);
    try {
      const results = await Promise.all(
        selectedCategories.map((key) =>
          addBatchMut.mutateAsync({
            categoryKey: key as ApplicantCategoryKey,
            date: iso,
            capacity: capacityRaw,
          }),
        ),
      );
      const totalRows = results.reduce((sum, rows) => sum + rows.length, 0);
      toast(
        `تمت إضافة ${num(totalRows)} موعد بتاريخ ${fmtDate(iso, 'full')} عبر ${num(selectedCategories.length)} فئة`,
        'success',
      );
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

  /* ── grid data: one query per active category ─────────────────── */
  const scheduleQueries = useQueries({
    queries: active.map((a) => ({
      queryKey: scheduleKeys.byCategory(a.key),
      queryFn: () => committeeService.listSchedule(a.key),
    })),
  });
  const scheduleLoading = scheduleQueries.some((q) => q.isLoading);

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
    // tanstack `useQueries` returns a fresh array reference per render — depend
    // on a fingerprint of the row payload instead so the memo only recomputes
    // when data actually changes.
    scheduleQueries.map((q) => q.dataUpdatedAt).join('|'),
    scheduleQueries.map((q) => q.data?.length ?? 0).join('|'),
  ]);

  /* ── sort state ───────────────────────────────────────────────── */
  const [sort, setSort] = useState<DataTableSort<BindingRow> | null>({
    key: CATEGORY_SORT_KEY,
    direction: 'asc',
  });

  const sortedRows = useMemo<BindingRow[]>(() => {
    if (!sort) return rows;
    const dir = sort.direction === 'asc' ? 1 : -1;
    const arabicCmp = (a: string, b: string): number =>
      a.localeCompare(b, 'ar', { numeric: true });
    return [...rows].sort((a, b) => {
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
  }, [rows, sort]);

  const groupedByCategory = useMemo<{
    key: ApplicantCategoryKey;
    label: string;
    rows: BindingRow[];
  }[]>(() => {
    const buckets = new Map<ApplicantCategoryKey, BindingRow[]>();
    for (const a of active) buckets.set(a.key, []);
    for (const r of sortedRows) {
      const bucket = buckets.get(r.categoryKey);
      if (bucket) bucket.push(r);
    }
    /* Preserve the active-categories order (which already follows
     * `sortOrder`) but flip when desc so the grouping reflects the
     * Arabic-collation header sort. */
    const ordered = [...active];
    ordered.sort((a, b) => {
      const cmp = a.labelAr.localeCompare(b.labelAr, 'ar', { numeric: true });
      return sort?.direction === 'desc' ? -cmp : cmp;
    });
    return ordered.map((a) => ({
      key: a.key,
      label: a.labelAr,
      rows: buckets.get(a.key) ?? [],
    }));
  }, [active, sortedRows, sort?.direction]);

  const isGrouped = sort?.key === CATEGORY_SORT_KEY;

  /* ── columns ──────────────────────────────────────────────────── */
  const baseColumns: DataTableColumn<BindingRow>[] = [
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
      numeric: true,
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
  ];

  const actionsColumn: DataTableColumn<BindingRow> = {
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
  };

  const flatColumns: DataTableColumn<BindingRow>[] = [...baseColumns, actionsColumn];

  /* In grouped mode the section header already states the category,
   * so we drop that column from the per-section table to avoid the
   * redundant repeated value. */
  const groupedColumns: DataTableColumn<BindingRow>[] = [
    ...baseColumns.filter((c) => c.key !== 'categoryLabel'),
    actionsColumn,
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

  const formCommitteeCount = selectedCategories.reduce((sum, key) => {
    return (
      sum +
      allCommittees.filter(
        (c) => c.categoryKey === (key as ApplicantCategoryKey) && !c.deletedAt,
      ).length
    );
  }, 0);

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
        <div className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_220px_auto]">
          <MultiSelect
            label="الفئات"
            required
            options={categoryOptions}
            value={selectedCategories}
            onChange={setSelectedCategories}
            placeholder="اختر فئة أو أكثر…"
            helper="فئة واحدة على الأقل"
          />
          <DatePicker
            label="تاريخ الاختبار"
            required
            value={pickedDate}
            onChange={setPickedDate}
            placeholder="اختر تاريخ الاختبار…"
          />
          <Input
            type="number"
            inputMode="numeric"
            label="سعة اللجنة"
            required
            min={1}
            step={1}
            value={capacityStr}
            onChange={(e) => setCapacityStr(e.target.value)}
            helper="1 أو أكثر"
          />
          <div className="flex items-end">
            <Button
              variant="primary"
              size="md"
              onClick={handleAdd}
              disabled={!canSubmit}
              isLoading={addBatchMut.isPending}
            >
              إضافة
            </Button>
          </div>
        </div>
      </Card>

      {isGrouped ? (
        <GroupedView
          groups={groupedByCategory}
          columns={groupedColumns}
          loading={scheduleLoading}
          sort={sort}
          onSortChange={setSort}
        />
      ) : (
        <Card>
          <DataTable
            data={sortedRows}
            columns={flatColumns}
            rowKey={(r) => r.id}
            loading={scheduleLoading}
            sort={sort}
            onSortChange={setSort}
            empty={
              <EmptyState
                variant="generic"
                title="لم تُضف مواعيد اختبارات بعد"
                description="استخدم النموذج أعلاه لإضافة أول موعد."
              />
            }
            zebraStripes
          />
        </Card>
      )}
    </div>
  );
}

/* ── Grouped view (sort=الفئة) ────────────────────────────────────── */

interface GroupedViewProps {
  groups: { key: ApplicantCategoryKey; label: string; rows: BindingRow[] }[];
  columns: DataTableColumn<BindingRow>[];
  loading: boolean;
  sort: DataTableSort<BindingRow> | null;
  onSortChange: (next: DataTableSort<BindingRow> | null) => void;
}

function GroupedView({
  groups,
  columns,
  loading,
  sort,
  onSortChange,
}: GroupedViewProps): JSX.Element {
  const allKeys = useMemo(() => groups.map((g) => g.key), [groups]);
  const [open, setOpen] = useState<string[]>(allKeys);

  /* Keep newly-active categories expanded by default — track the set
   * of keys we've seen and add any new ones to the open list. */
  const seenRef = useRef<Set<string>>(new Set(allKeys));
  useEffect(() => {
    const fresh = allKeys.filter((k) => !seenRef.current.has(k));
    if (fresh.length === 0) return;
    seenRef.current = new Set(allKeys);
    setOpen((prev) => [...prev, ...fresh]);
  }, [allKeys]);

  const total = groups.reduce((sum, g) => sum + g.rows.length, 0);
  if (!loading && total === 0) {
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
          <Accordion.Item key={g.key} value={g.key}>
            <Accordion.Trigger>
              <span className="flex items-center gap-2">
                <span>{g.label}</span>
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
                    title="لا توجد مواعيد لهذه الفئة بعد"
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
        className="group inline-flex items-center justify-end gap-1.5 rounded-md px-2 py-1 text-ink-900 transition-colors hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
      >
        <Pencil
          size={11}
          strokeWidth={1.75}
          className="text-ink-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        />
        <span className="font-numeric tnum">{num(row.capacity)}</span>
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-1">
      <input
        ref={inputRef}
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        disabled={isSaving}
        aria-label="السعة"
        className="w-20 rounded-md border border-border-default bg-surface-elevated px-2 py-1 text-end font-numeric tnum text-2xs text-ink-900 focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none"
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

