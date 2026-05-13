/**
 * ScheduleCategoryPanel — form + table for a single applicant
 * category's exam-date schedule.
 *
 * Used in two places:
 *   1. /admin/committee/schedule (each of the 4 fixed Radix tabs)
 *   2. /admin/admission-setup/wizard/committees?subtab=bindings
 *      (scoped to the wizard's active category)
 *
 * Form: DatePicker + capacity Input (1..999) + إضافة button.
 * Table: 4 columns (اللجنة, تاريخ الاختبار, سعة اللجنة, إجراءات).
 * Capacity cell is inline-editable — click → numeric input →
 * Enter / blur to commit, Escape to cancel.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  DatePicker,
  EmptyState,
  Input,
  toast,
} from '@/shared/components';
import type {
  DataTableColumn,
  DataTableSort,
} from '@/shared/components';
import { date as fmtDate, num } from '@/shared/lib/format';
import {
  useAddScheduleBatchMutation,
  useCommittees,
  useRemoveScheduleEntryMutation,
  useScheduleByCategory,
  useUpdateScheduleEntryMutation,
} from '../api/committee.queries';
import {
  type ApplicantCategoryKey,
  type Committee,
  type ExamScheduleEntry,
} from '@/shared/types/domain';

interface ScheduleCategoryPanelProps {
  categoryKey: ApplicantCategoryKey;
  categoryLabel: string;
  /** When true, hides the category-label subtitle on the form card —
   *  the embedding context (wizard sub-tab) already shows the category
   *  via its outer tab strip. */
  compact?: boolean;
}

/** Convert a Date → ISO yyyy-mm-dd (date-only, no UTC drift). */
function toIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function ScheduleCategoryPanel({
  categoryKey,
  categoryLabel,
  compact,
}: ScheduleCategoryPanelProps): JSX.Element {
  const committeesQuery = useCommittees();
  const scheduleQuery = useScheduleByCategory(categoryKey);
  const addBatchMut = useAddScheduleBatchMutation();
  const removeMut = useRemoveScheduleEntryMutation();
  const updateMut = useUpdateScheduleEntryMutation();

  const allCommittees = committeesQuery.data ?? [];
  const categoryCommittees = useMemo<Committee[]>(
    () => allCommittees.filter((c) => c.categoryKey === categoryKey && !c.deletedAt),
    [allCommittees, categoryKey],
  );

  const committeeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of allCommittees) map.set(c.id, c.name);
    return map;
  }, [allCommittees]);

  const [pickedDate, setPickedDate] = useState<Date | null>(null);
  const [capacityStr, setCapacityStr] = useState<string>('');

  const capacity = Number(capacityStr);
  const capacityValid =
    capacityStr.length > 0 &&
    Number.isInteger(capacity) &&
    capacity >= 1 &&
    capacity <= 999;
  const dateValid = pickedDate !== null;
  const canSubmit = dateValid && capacityValid && categoryCommittees.length > 0;

  const handleAdd = async (): Promise<void> => {
    if (!canSubmit || !pickedDate) return;
    const iso = toIsoDate(pickedDate);
    try {
      const created = await addBatchMut.mutateAsync({
        categoryKey,
        date: iso,
        capacity,
      });
      toast(
        `تمت إضافة ${num(created.length)} لجنة بتاريخ ${fmtDate(iso, 'full')}`,
        'success',
      );
      setPickedDate(null);
      setCapacityStr('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذّر إضافة المواعيد';
      toast(message, 'danger');
    }
  };

  const handleRemove = (entry: ExamScheduleEntry): void => {
    if (typeof window !== 'undefined') {
      const ok = window.confirm('سيتم حذف هذا الموعد. هل تريد المتابعة؟');
      if (!ok) return;
    }
    removeMut.mutate(
      { id: entry.id, categoryKey },
      {
        onSuccess: () => toast('تم حذف الموعد', 'success'),
        onError: (err) => toast((err as Error).message, 'danger'),
      },
    );
  };

  const [sort, setSort] = useState<DataTableSort<ExamScheduleEntry> | null>({
    key: 'date',
    direction: 'asc',
  });

  const entries = scheduleQuery.data ?? [];

  const columns: DataTableColumn<ExamScheduleEntry>[] = [
    {
      key: 'committee',
      label: 'اللجنة',
      render: (e) => (
        <span className="text-2xs text-ink-900">
          {committeeNameById.get(e.committeeId) ?? e.committeeId}
        </span>
      ),
    },
    {
      key: 'date',
      label: 'تاريخ الاختبار',
      sortable: true,
      render: (e) => (
        <span className="font-numeric tnum text-2xs text-ink-700">
          {fmtDate(e.date, 'full')}
        </span>
      ),
    },
    {
      key: 'capacity',
      label: 'سعة اللجنة',
      sortable: true,
      numeric: true,
      render: (e) => (
        <CapacityCell
          entry={e}
          isSaving={updateMut.isPending}
          onCommit={(next) =>
            updateMut.mutate(
              { id: e.id, categoryKey, patch: { capacity: next } },
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
      render: (e) => (
        <button
          type="button"
          aria-label="حذف الموعد"
          onClick={() => handleRemove(e)}
          className="inline-flex items-center justify-center rounded-md p-1.5 text-ink-500 transition-colors hover:bg-terra-50 hover:text-terra-700 focus-visible:shadow-focus-teal focus-visible:outline-none"
        >
          <Trash2 size={14} strokeWidth={1.75} aria-hidden />
        </button>
      ),
    },
  ];

  const sorted = useMemo(() => {
    if (!sort) return entries;
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...entries].sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sort.key];
      const bv = (b as unknown as Record<string, unknown>)[sort.key];
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), 'ar') * dir;
    });
  }, [entries, sort]);

  return (
    <div className="flex flex-col gap-4">
      <Card variant="elevated">
        <CardHeader
          title="إضافة موعد اختبار"
          subtitle={
            compact
              ? `يتم إنشاء موعد لكل لجنة (${num(categoryCommittees.length)} لجنة).`
              : `فئة ${categoryLabel} — يتم إنشاء موعد لكل لجنة (${num(categoryCommittees.length)} لجنة).`
          }
        />
        <div className="grid gap-3 p-4 md:grid-cols-[1fr_220px_auto]">
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
            max={999}
            step={1}
            value={capacityStr}
            onChange={(e) => setCapacityStr(e.target.value)}
            helper="من 1 إلى 999"
          />
          <div className="flex items-end">
            <Button
              variant="primary"
              size="md"
              onClick={handleAdd}
              disabled={!canSubmit || addBatchMut.isPending}
              isLoading={addBatchMut.isPending}
            >
              إضافة
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <DataTable
          data={sorted}
          columns={columns}
          rowKey={(e) => e.id}
          loading={scheduleQuery.isLoading}
          sort={sort}
          onSortChange={setSort}
          empty={
            <EmptyState
              variant="generic"
              title="لم تُضف مواعيد اختبارات بعد"
              description="استخدم النموذج أعلاه لإضافة أول موعد لهذه الفئة."
            />
          }
          zebraStripes
        />
      </Card>
    </div>
  );
}

/* ── Inline-editable capacity cell ─────────────────────────────────── */

interface CapacityCellProps {
  entry: ExamScheduleEntry;
  isSaving: boolean;
  onCommit: (next: number) => void;
}

function CapacityCell({ entry, isSaving, onCommit }: CapacityCellProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(entry.capacity));
  const inputRef = useRef<HTMLInputElement>(null);

  /* Reset the draft whenever the cached entry's capacity changes from
   * the outside (mutation finished, query invalidated). */
  useEffect(() => {
    setDraft(String(entry.capacity));
  }, [entry.capacity]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = (): void => {
    const next = Number(draft);
    if (!Number.isInteger(next) || next < 1 || next > 999) {
      toast('السعة يجب أن تكون عدداً صحيحاً بين 1 و 999', 'danger');
      return;
    }
    if (next === entry.capacity) {
      setEditing(false);
      return;
    }
    onCommit(next);
    setEditing(false);
  };

  const cancel = (): void => {
    setDraft(String(entry.capacity));
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
        <span className="font-numeric tnum">{num(entry.capacity)}</span>
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
        max={999}
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
