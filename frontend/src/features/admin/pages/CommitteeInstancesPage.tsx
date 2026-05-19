/**
 * /admin/committees-exam-config — committee instances management.
 *
 * Lists every CommitteeInstance configured across cycles. Each row is a
 * cycle-bound, dated, capacity-bearing assignment that pairs a lookup
 * CommitteeDefinition with a (cycle × date) slot. The same record set
 * the admission-setup wizard step authors at
 * `/admin/cycles/admission-setup/wizard/committees`.
 *
 * Editable inline: `date` and `capacity`. Saving writes through the
 * shared `committeeInstanceService`, so changes round-trip to the wizard
 * surface on next render.
 *
 * Columns:
 *   - الدورة            — cycle (filter: enum)
 *   - الفئة             — applicant-category (filter: enum)
 *   - اللجنة            — committee name resolved from the lookup
 *   - تاريخ الاختبار     — date (inline edit, filter: date range)
 *   - سعة اللجنة         — capacity (inline edit, filter: number range)
 *   - إجراءات           — delete
 */

import { useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import {
  Card,
  DataTable,
  DatePicker,
  EmptyState,
  PageHeader,
  toast,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import { date as fmtDate, num } from '@/shared/lib/format';
import { ROUTES } from '@/config/routes';
import { useCycles } from '../api/cycles.queries';
import { useLookup } from '@/features/lookups';
import {
  useCommitteeInstances,
  useRemoveCommitteeInstanceMutation,
  useUpdateCommitteeInstanceMutation,
} from '@/features/committees';
import type { AdmissionCycle, CommitteeInstance } from '@/shared/types/domain';

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

function fromIsoDate(iso: string): Date | null {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

interface InstanceRow extends CommitteeInstance {
  cycleLabelAr: string;
  categoryLabelAr: string;
  committeeName: string;
}

export function CommitteeInstancesPage(): JSX.Element {
  const instancesQuery = useCommitteeInstances();
  const cyclesQuery = useCycles({ includeDeleted: false });
  const definitionsQuery = useLookup('committees');
  const categoriesQuery = useLookup('applicant-categories');
  const removeMut = useRemoveCommitteeInstanceMutation();
  const updateMut = useUpdateCommitteeInstanceMutation();

  const cycleById = useMemo(() => {
    const map = new Map<string, AdmissionCycle>();
    for (const c of cyclesQuery.data ?? []) map.set(c.id, c);
    return map;
  }, [cyclesQuery.data]);

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
    return (instancesQuery.data ?? []).map((inst) => ({
      ...inst,
      cycleLabelAr: cycleById.get(inst.cycleId)?.nameAr ?? inst.cycleId,
      categoryLabelAr: categoryLabelByKey.get(inst.categoryKey) ?? inst.categoryKey,
      committeeName: definitionNameByCode.get(inst.definitionCode) ?? inst.definitionCode,
    }));
  }, [instancesQuery.data, cycleById, categoryLabelByKey, definitionNameByCode]);

  const cycleOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.cycleId))).map((id) => ({
        value: id,
        label: cycleById.get(id)?.nameAr ?? id,
      })),
    [rows, cycleById],
  );

  const categoryOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.categoryKey))).map((key) => ({
        value: key,
        label: categoryLabelByKey.get(key) ?? key,
      })),
    [rows, categoryLabelByKey],
  );

  const handleDateCommit = (row: InstanceRow, nextIso: string): void => {
    if (nextIso === row.date) return;
    updateMut.mutate(
      { id: row.id, patch: { date: nextIso } },
      {
        onSuccess: () => toast('تم تحديث التاريخ', 'success'),
        onError: (err) => toast((err as Error).message, 'danger'),
      },
    );
  };

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

  const handleDelete = (row: InstanceRow): void => {
    if (typeof window !== 'undefined') {
      const ok = window.confirm('سيتم حذف هذا الموعد. هل تريد المتابعة؟');
      if (!ok) return;
    }
    removeMut.mutate(row.id, {
      onSuccess: () => toast('تم حذف الموعد', 'success'),
      onError: (err) => toast((err as Error).message, 'danger'),
    });
  };

  const columns: DataTableColumn<InstanceRow>[] = [
    {
      key: 'cycleLabelAr',
      label: 'الدورة',
      sortable: true,
      accessor: 'cycleLabelAr',
      filter: {
        kind: 'enum',
        getValue: (r) => r.cycleId,
        options: cycleOptions,
      },
    },
    {
      key: 'categoryLabelAr',
      label: 'الفئة',
      sortable: true,
      accessor: 'categoryLabelAr',
      filter: {
        kind: 'enum',
        getValue: (r) => r.categoryKey,
        options: categoryOptions,
      },
    },
    {
      key: 'committeeName',
      label: 'اللجنة',
      sortable: true,
      accessor: 'committeeName',
      filter: {
        kind: 'text',
        getValue: (r) => r.committeeName,
        placeholder: 'بحث…',
      },
    },
    {
      key: 'date',
      label: 'تاريخ الاختبار',
      sortable: true,
      accessor: 'date',
      filter: {
        kind: 'date',
        getValue: (r) => r.date,
      },
      render: (row) => (
        <DateCell
          row={row}
          isSaving={updateMut.isPending}
          onCommit={(iso) => handleDateCommit(row, iso)}
        />
      ),
    },
    {
      key: 'capacity',
      label: 'سعة اللجنة',
      sortable: true,
      numeric: true,
      getSortValue: (r) => r.capacity,
      filter: {
        kind: 'number',
        getValue: (r) => r.capacity,
      },
      render: (row) => (
        <CapacityCell
          row={row}
          isSaving={updateMut.isPending}
          onCommit={(next) => handleCapacityCommit(row, next)}
        />
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'end',
      render: (row) => (
        <button
          type="button"
          aria-label="حذف الموعد"
          onClick={() => handleDelete(row)}
          className="inline-flex items-center justify-center rounded-md p-1.5 text-ink-500 transition-colors hover:bg-terra-50 hover:text-terra-700 focus-visible:shadow-focus-teal focus-visible:outline-none"
        >
          <Trash2 size={14} strokeWidth={1.75} aria-hidden />
        </button>
      ),
    },
  ];

  const loading =
    instancesQuery.isLoading ||
    cyclesQuery.isLoading ||
    definitionsQuery.isLoading ||
    categoriesQuery.isLoading;

  return (
    <CenteredShell>
      <PageHeader
        title="إدارة مواعيد اللجان"
        subtitle="كل مواعيد اللجان المُعَدّة عبر الدورات. اللجان نفسها تُدار في الأكواد المرجعية؛ مواعيد كل دورة تُنشأ من معالج إعداد التقديم وتُحرّر هنا."
        breadcrumbs={[
          { label: 'إدارة المنظومة', href: ROUTES.admin.dashboard },
          { label: 'مواعيد اللجان' },
        ]}
      />

      <Card>
        <DataTable<InstanceRow>
          data={rows}
          columns={columns}
          rowKey={(r) => r.id}
          loading={loading}
          empty={
            <EmptyState
              variant="generic"
              title="لا توجد مواعيد لجان حالياً"
              description="افتح إعداد التقديم في «دورات القبول» لإنشاء أول موعد."
            />
          }
          zebraStripes
        />
      </Card>
    </CenteredShell>
  );
}

/* ── Inline-editable date cell ────────────────────────────────────── */

interface DateCellProps {
  row: InstanceRow;
  isSaving: boolean;
  onCommit: (iso: string) => void;
}

function DateCell({ row, isSaving, onCommit }: DateCellProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Date | null>(fromIsoDate(row.date));

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(fromIsoDate(row.date));
          setEditing(true);
        }}
        aria-label="تعديل التاريخ"
        className="group inline-flex items-center justify-start gap-1.5 rounded-md px-1 py-0.5 text-ink-900 transition-colors hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
      >
        <span>{fmtDate(row.date, 'full')}</span>
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
      <DatePicker value={draft} onChange={setDraft} placeholder="اختر اليوم…" />
      <button
        type="button"
        aria-label="حفظ التاريخ"
        disabled={isSaving || !draft}
        onClick={() => {
          if (!draft) return;
          onCommit(toIsoDate(draft));
          setEditing(false);
        }}
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

/* ── Inline-editable capacity cell ────────────────────────────────── */

interface CapacityCellProps {
  row: InstanceRow;
  isSaving: boolean;
  onCommit: (next: number) => void;
}

function CapacityCell({ row, isSaving, onCommit }: CapacityCellProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(String(row.capacity));

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
