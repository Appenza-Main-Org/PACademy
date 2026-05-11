/**
 * YearTable — editable rows for one category-specialization junction.
 *
 * Columns (visual order RTL = first column rightmost):
 *   1. سنة التخرج          (Input — numeric, [2020, currentYear+5])
 *   2. النوع                (Select bound to GenderType)
 *   3. السعة                (Input — numeric, > 0)
 *   4. بداية التقديم        (DatePicker)
 *   5. نهاية التقديم        (DatePicker)
 *   6. بداية السنة الدراسية (DatePicker)
 *   7. الحالة                (Switch)
 *   8. إجراءات              (delete tombstone toggle)
 *
 * Inline validation runs on each `patchRow` call via `validateYearRow`
 * against the sibling rows in the same slice. Errors render as a tiny
 * terra-500 chip below the field that's at fault and `aria-invalid` is
 * set on the field. Dirty rows get a 2px gold-400 start-edge rail.
 * No per-row save — bulk save lives in `<StickyBulkSaveBar />`.
 */

import { useEffect, useMemo } from 'react';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  Button,
  DatePicker,
  Input,
  Select,
  Switch,
} from '@/shared/components';
import { cn } from '@/shared/lib/cn';
import { useYears } from '../../api/applicationSettings.queries';
import {
  useAppSettingsDraftStore,
  useDraftRows,
  type DraftRow,
} from '../../store/appSettingsDraft';
import { validateYearRow } from '../../lib/appSettingsValidation';
import type {
  ApplicantSpecializationYear,
  AppSettingsConflict,
  GenderType,
} from '../../types';

interface YearTableProps {
  categorySpecializationId: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 2020;
const MAX_YEAR = CURRENT_YEAR + 5;

const FIELD_MESSAGES_AR: Record<AppSettingsConflict, string> = {
  DUPLICATE_YEAR: 'مكررة',
  INVALID_DATE_RANGE: 'ترتيب التواريخ غير صحيح',
  OVERLAPPING_PERIOD: 'تتداخل مع سنة أخرى',
  CAPACITY_NOT_POSITIVE: 'السعة > 0',
  SPECIALIZATION_NOT_MAPPED: 'غير مرتبط',
  CATEGORY_HAS_ACTIVE_YEARS: 'فئة بها سنوات نشطة',
};

const GENDER_OPTIONS: { value: GenderType; label: string }[] = [
  { value: 'male', label: 'ذكور' },
  { value: 'female', label: 'إناث' },
];

export function YearTable({ categorySpecializationId }: YearTableProps): JSX.Element {
  const yearsQuery = useYears(categorySpecializationId);
  const drafts = useDraftRows(categorySpecializationId);
  const hydrateSlice = useAppSettingsDraftStore((s) => s.hydrateSlice);
  const patchRow = useAppSettingsDraftStore((s) => s.patchRow);
  const addRow = useAppSettingsDraftStore((s) => s.addRow);
  const deleteRow = useAppSettingsDraftStore((s) => s.deleteRow);
  const restoreRow = useAppSettingsDraftStore((s) => s.restoreRow);

  /* Seed the slice on first arrival; subsequent server refetches don't
   * overwrite local edits (the store guards on `kind !== 'original'`). */
  useEffect(() => {
    if (yearsQuery.data) {
      hydrateSlice(categorySpecializationId, yearsQuery.data);
    }
  }, [categorySpecializationId, yearsQuery.data, hydrateSlice]);

  /* Per-row validation across the active (non-deleted) hypothetical state. */
  const validationByRow = useMemo(() => {
    const live = drafts.filter((d) => d.kind !== 'deleted').map((d) => d.row);
    const map = new Map<string, AppSettingsConflict | null>();
    for (const draft of drafts) {
      if (draft.kind === 'deleted') {
        map.set(draft.id, null);
        continue;
      }
      const siblings = live.filter((r) => r.id !== draft.id);
      const conflict = validateYearRow(draft.row, siblings, draft.id);
      map.set(draft.id, conflict);
    }
    return map;
  }, [drafts]);

  if (yearsQuery.isLoading) {
    return (
      <p className="font-ar text-sm text-ink-500">جارٍ تحميل سنوات التخرج…</p>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-border-subtle bg-ink-50/40 px-4 py-3">
        <p className="font-ar text-sm text-ink-500">
          لا توجد سنوات تخرج بعد لهذا التخصص.
        </p>
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<Plus size={14} strokeWidth={1.75} />}
          onClick={() => addRow(categorySpecializationId, {})}
        >
          إضافة سنة دراسية
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-md border border-border-subtle bg-surface-card">
        <table className="w-full min-w-[840px] text-sm">
          <thead className="border-b border-border-subtle text-2xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-3 py-2 text-start font-medium">سنة التخرج</th>
              <th className="px-3 py-2 text-start font-medium">النوع</th>
              <th className="px-3 py-2 text-start font-medium">السعة</th>
              <th className="px-3 py-2 text-start font-medium">بداية التقديم</th>
              <th className="px-3 py-2 text-start font-medium">نهاية التقديم</th>
              <th className="px-3 py-2 text-start font-medium">بداية السنة الدراسية</th>
              <th className="px-3 py-2 text-start font-medium">الحالة</th>
              <th className="px-3 py-2 text-end font-medium" aria-label="إجراءات" />
            </tr>
          </thead>
          <tbody>
            {drafts.map((draft) => (
              <YearRow
                key={draft.id}
                draft={draft}
                conflict={validationByRow.get(draft.id) ?? null}
                onPatch={(patch) => patchRow(categorySpecializationId, draft.id, patch)}
                onDelete={() => deleteRow(categorySpecializationId, draft.id)}
                onRestore={() => restoreRow(categorySpecializationId, draft.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-start">
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<Plus size={14} strokeWidth={1.75} />}
          onClick={() => addRow(categorySpecializationId, {})}
        >
          إضافة سنة دراسية
        </Button>
      </div>
    </div>
  );
}

interface YearRowProps {
  draft: DraftRow;
  conflict: AppSettingsConflict | null;
  onPatch: (patch: Partial<ApplicantSpecializationYear>) => void;
  onDelete: () => void;
  onRestore: () => void;
}

function YearRow({ draft, conflict, onPatch, onDelete, onRestore }: YearRowProps): JSX.Element {
  const isDeleted = draft.kind === 'deleted';
  const isDirty = draft.kind === 'dirty' || draft.kind === 'new';
  const row = draft.row;

  const showFieldError = (fields: AppSettingsConflict[]): string | null => {
    if (!conflict) return null;
    return fields.includes(conflict) ? FIELD_MESSAGES_AR[conflict] : null;
  };

  const yearError = showFieldError(['DUPLICATE_YEAR']);
  const genderError = showFieldError(['DUPLICATE_YEAR', 'OVERLAPPING_PERIOD']);
  const capacityError = showFieldError(['CAPACITY_NOT_POSITIVE']);
  const dateError = showFieldError(['INVALID_DATE_RANGE', 'OVERLAPPING_PERIOD']);

  return (
    <tr
      className={cn(
        'border-b border-border-subtle align-top last:border-b-0',
        isDeleted && 'bg-ink-50/70 opacity-60',
      )}
      style={
        isDirty
          ? {
              borderInlineStartWidth: 2,
              borderInlineStartStyle: 'solid',
              borderInlineStartColor: 'var(--gold-400)',
            }
          : undefined
      }
    >
      <td className="px-3 py-2">
        <Input
          type="number"
          min={MIN_YEAR}
          max={MAX_YEAR}
          disabled={isDeleted}
          value={row.graduationYear}
          onChange={(e) => onPatch({ graduationYear: Number(e.target.value) || row.graduationYear })}
          containerClassName="!mb-0 w-24"
          className="text-end tabular-nums"
          aria-invalid={Boolean(yearError) || undefined}
          aria-label="سنة التخرج"
        />
        {yearError && <FieldError text={yearError} />}
      </td>

      <td className="px-3 py-2">
        <Select
          value={row.genderType}
          disabled={isDeleted}
          onChange={(e) => onPatch({ genderType: e.target.value as GenderType })}
          containerClassName="!mb-0 w-24"
          aria-invalid={Boolean(genderError) || undefined}
          aria-label="النوع"
          options={GENDER_OPTIONS}
        />
        {genderError && <FieldError text={genderError} />}
      </td>

      <td className="px-3 py-2">
        <Input
          type="number"
          min={1}
          disabled={isDeleted}
          value={row.capacity}
          onChange={(e) => onPatch({ capacity: Number(e.target.value) || 0 })}
          containerClassName="!mb-0 w-24"
          className="text-end tabular-nums"
          aria-invalid={Boolean(capacityError) || undefined}
          aria-label="السعة"
        />
        {capacityError && <FieldError text={capacityError} />}
      </td>

      <td className="px-3 py-2 min-w-[150px]">
        <DatePicker
          value={isoToDate(row.applicationStartDate)}
          disabled={isDeleted}
          onChange={(d) => onPatch({ applicationStartDate: dateToIso(d) ?? row.applicationStartDate })}
        />
      </td>

      <td className="px-3 py-2 min-w-[150px]">
        <DatePicker
          value={isoToDate(row.applicationEndDate)}
          disabled={isDeleted}
          onChange={(d) => onPatch({ applicationEndDate: dateToIso(d) ?? row.applicationEndDate })}
          min={row.applicationStartDate.slice(0, 10)}
        />
        {dateError && <FieldError text={dateError} />}
      </td>

      <td className="px-3 py-2 min-w-[150px]">
        <DatePicker
          value={isoToDate(row.academicYearStartDate)}
          disabled={isDeleted}
          onChange={(d) => onPatch({ academicYearStartDate: dateToIso(d) ?? row.academicYearStartDate })}
          min={row.applicationEndDate.slice(0, 10)}
        />
      </td>

      <td className="px-3 py-2">
        <Switch
          checked={row.isActive}
          disabled={isDeleted}
          onCheckedChange={(checked) => onPatch({ isActive: checked })}
          aria-label="حالة السنة"
        />
      </td>

      <td className="px-3 py-2 text-end">
        {isDeleted ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRestore}
            leadingIcon={<RotateCcw size={14} strokeWidth={1.75} />}
          >
            استرجاع
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            leadingIcon={<Trash2 size={14} strokeWidth={1.75} className="text-terra-600" />}
            aria-label="حذف"
          >
            حذف
          </Button>
        )}
      </td>
    </tr>
  );
}

function FieldError({ text }: { text: string }): JSX.Element {
  return (
    <span
      role="alert"
      className="mt-1 inline-flex items-center rounded-pill bg-terra-50 px-1.5 py-0.5 text-2xs text-terra-700"
    >
      {text}
    </span>
  );
}

function isoToDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const day = value.slice(0, 10);
  const d = new Date(`${day}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateToIso(value: Date | null): string | null {
  if (!value) return null;
  const yyyy = value.getUTCFullYear();
  const mm = String(value.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(value.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

