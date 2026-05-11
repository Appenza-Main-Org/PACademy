/**
 * YearTable — editable rows for one category-specialization junction.
 *
 * Columns (visual order RTL = first column rightmost):
 *   1. سنة التخرج (Max) — Select bound to [currentYear-5 … currentYear]
 *   2. النوع — multi-pill toggle (ذكور / إناث) — at least one required
 *   3. الحالة الاجتماعية — MultiSelect over MARITAL_STATUSES (empty = any)
 *   4. السن الأقصى — numeric Input (nullable; blank = no maximum)
 *   5. الحد الأدنى للدرجة — numeric Input (0–100; nullable)
 *   6. الحد الأقصى للدرجة — numeric Input (0–100; nullable; >= min)
 *   7. بداية التقديم — DatePicker
 *   8. نهاية التقديم — DatePicker
 *   9. تاريخ احتساب السن — DatePicker (was: بداية السنة الدراسية)
 *  10. الحالة — نشط/موقوف pill (replaces opaque Switch in dense table)
 *  11. إجراءات — حذف / استرجاع
 *
 * Inline validation runs after each `patchRow` via the draft store; the
 * relevant conflict code is surfaced as a terra-500 chip under the
 * field(s) responsible and `aria-invalid="true"` is set on the
 * offending field. Dirty rows get a 2 px gold-400 inline-start rail.
 * No per-row save — bulk save lives in `<StickyBulkSaveBar />`.
 */

import { useEffect, useMemo } from 'react';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  Button,
  DatePicker,
  Input,
  MultiSelect,
  Select,
} from '@/shared/components';
import { cn } from '@/shared/lib/cn';
import { useYears } from '../../api/applicationSettings.queries';
import {
  useAppSettingsDraftStore,
  useDraftRows,
  type DraftRow,
} from '../../store/appSettingsDraft';
import { validateYearRow } from '../../lib/appSettingsValidation';
import { MARITAL_STATUSES } from '../../lib/maritalStatuses';
import type {
  ApplicantSpecializationYear,
  AppSettingsConflict,
  GenderType,
} from '../../types';

interface YearTableProps {
  categorySpecializationId: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const GRAD_YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => {
  const year = CURRENT_YEAR - 5 + i;
  return { value: String(year), label: String(year) };
});

const FIELD_MESSAGES_AR: Record<AppSettingsConflict, string> = {
  DUPLICATE_YEAR: 'مكررة',
  INVALID_DATE_RANGE: 'ترتيب التواريخ غير صحيح',
  OVERLAPPING_PERIOD: 'تتداخل مع سنة أخرى',
  AGE_NOT_POSITIVE: 'السن > 0',
  GRADE_RANGE_INVALID: 'الحد الأدنى يفوق الأقصى',
  GENDER_REQUIRED: 'اختر النوع',
  SPECIALIZATION_NOT_MAPPED: 'غير مرتبط',
  CATEGORY_HAS_ACTIVE_YEARS: 'فئة بها سنوات نشطة',
};

const GENDER_PILLS: { value: GenderType; label: string }[] = [
  { value: 'male', label: 'ذكور' },
  { value: 'female', label: 'إناث' },
];

const MARITAL_OPTIONS = MARITAL_STATUSES.map((m) => ({
  value: m.code,
  label: m.name,
}));

export function YearTable({ categorySpecializationId }: YearTableProps): JSX.Element {
  const yearsQuery = useYears(categorySpecializationId);
  const drafts = useDraftRows(categorySpecializationId);
  const hydrateSlice = useAppSettingsDraftStore((s) => s.hydrateSlice);
  const patchRow = useAppSettingsDraftStore((s) => s.patchRow);
  const addRow = useAppSettingsDraftStore((s) => s.addRow);
  const deleteRow = useAppSettingsDraftStore((s) => s.deleteRow);
  const restoreRow = useAppSettingsDraftStore((s) => s.restoreRow);

  useEffect(() => {
    if (yearsQuery.data) {
      hydrateSlice(categorySpecializationId, yearsQuery.data);
    }
  }, [categorySpecializationId, yearsQuery.data, hydrateSlice]);

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
    return <p className="font-ar text-sm text-ink-500">جارٍ تحميل السنوات…</p>;
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
          إضافة سنة
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-md border border-border-subtle bg-surface-card">
        <table className="w-full min-w-[1280px] text-sm">
          <thead className="border-b border-border-subtle text-2xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-3 py-2 text-start font-medium">سنة التخرج (الأقصى)</th>
              <th className="px-3 py-2 text-start font-medium">النوع</th>
              <th className="px-3 py-2 text-start font-medium">الحالة الاجتماعية</th>
              <th className="px-3 py-2 text-start font-medium">السن الأقصى</th>
              <th className="px-3 py-2 text-start font-medium">أدنى درجة</th>
              <th className="px-3 py-2 text-start font-medium">أقصى درجة</th>
              <th className="px-3 py-2 text-start font-medium">بداية التقديم</th>
              <th className="px-3 py-2 text-start font-medium">نهاية التقديم</th>
              <th className="px-3 py-2 text-start font-medium">تاريخ احتساب السن</th>
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
          إضافة سنة
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

  const matchField = (fields: AppSettingsConflict[]): string | null => {
    if (!conflict) return null;
    return fields.includes(conflict) ? FIELD_MESSAGES_AR[conflict] : null;
  };

  const yearError = matchField(['DUPLICATE_YEAR']);
  const genderError = matchField(['GENDER_REQUIRED', 'DUPLICATE_YEAR', 'OVERLAPPING_PERIOD']);
  const ageError = matchField(['AGE_NOT_POSITIVE']);
  const gradeError = matchField(['GRADE_RANGE_INVALID']);
  const dateError = matchField(['INVALID_DATE_RANGE', 'OVERLAPPING_PERIOD']);

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
      <td className="px-3 py-2 align-top">
        <Select
          value={String(row.graduationYear)}
          disabled={isDeleted}
          onChange={(e) => onPatch({ graduationYear: Number(e.target.value) })}
          containerClassName="!mb-0 w-28"
          aria-invalid={Boolean(yearError) || undefined}
          aria-label="سنة التخرج"
          options={GRAD_YEAR_OPTIONS}
        />
        {yearError && <FieldError text={yearError} />}
      </td>

      <td className="px-3 py-2 align-top">
        <GenderToggle
          value={row.genderTypes}
          disabled={isDeleted}
          onChange={(next) => onPatch({ genderTypes: next })}
          ariaLabel="النوع"
          invalid={Boolean(genderError)}
        />
        {genderError && <FieldError text={genderError} />}
      </td>

      <td className="px-3 py-2 align-top min-w-[180px]">
        <MultiSelect
          value={row.maritalStatusCodes}
          onChange={(next) => onPatch({ maritalStatusCodes: next })}
          options={MARITAL_OPTIONS}
          disabled={isDeleted}
          ariaLabel="الحالة الاجتماعية"
          placeholder="الكل"
        />
      </td>

      <td className="px-3 py-2 align-top">
        <Input
          type="number"
          min={1}
          disabled={isDeleted}
          value={row.maxAge ?? ''}
          onChange={(e) =>
            onPatch({ maxAge: e.target.value === '' ? null : Number(e.target.value) })
          }
          containerClassName="!mb-0 w-20"
          className="text-end tabular-nums"
          aria-invalid={Boolean(ageError) || undefined}
          aria-label="السن الأقصى"
        />
        {ageError && <FieldError text={ageError} />}
      </td>

      <td className="px-3 py-2 align-top">
        <Input
          type="number"
          min={0}
          max={100}
          disabled={isDeleted}
          value={row.minGrade ?? ''}
          onChange={(e) =>
            onPatch({ minGrade: e.target.value === '' ? null : Number(e.target.value) })
          }
          containerClassName="!mb-0 w-20"
          className="text-end tabular-nums"
          aria-invalid={Boolean(gradeError) || undefined}
          aria-label="أدنى درجة"
        />
        {gradeError && <FieldError text={gradeError} />}
      </td>

      <td className="px-3 py-2 align-top">
        <Input
          type="number"
          min={0}
          max={100}
          disabled={isDeleted}
          value={row.maxGrade ?? ''}
          onChange={(e) =>
            onPatch({ maxGrade: e.target.value === '' ? null : Number(e.target.value) })
          }
          containerClassName="!mb-0 w-20"
          className="text-end tabular-nums"
          aria-invalid={Boolean(gradeError) || undefined}
          aria-label="أقصى درجة"
        />
      </td>

      <td className="px-3 py-2 align-top min-w-[150px]">
        <DatePicker
          value={isoToDate(row.applicationStartDate)}
          disabled={isDeleted}
          onChange={(d) => onPatch({ applicationStartDate: dateToIso(d) ?? row.applicationStartDate })}
        />
      </td>

      <td className="px-3 py-2 align-top min-w-[150px]">
        <DatePicker
          value={isoToDate(row.applicationEndDate)}
          disabled={isDeleted}
          onChange={(d) => onPatch({ applicationEndDate: dateToIso(d) ?? row.applicationEndDate })}
          min={row.applicationStartDate.slice(0, 10)}
        />
        {dateError && <FieldError text={dateError} />}
      </td>

      <td className="px-3 py-2 align-top min-w-[150px]">
        <DatePicker
          value={isoToDate(row.ageCalcDate)}
          disabled={isDeleted}
          onChange={(d) => onPatch({ ageCalcDate: dateToIso(d) ?? row.ageCalcDate })}
        />
      </td>

      <td className="px-3 py-2 align-top">
        <StatusPill
          active={row.isActive}
          disabled={isDeleted}
          onChange={(next) => onPatch({ isActive: next })}
        />
      </td>

      <td className="px-3 py-2 align-top text-end">
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

interface GenderToggleProps {
  value: readonly GenderType[];
  onChange: (next: GenderType[]) => void;
  disabled?: boolean;
  ariaLabel?: string;
  invalid?: boolean;
}

function GenderToggle({ value, onChange, disabled, ariaLabel, invalid }: GenderToggleProps): JSX.Element {
  const toggle = (g: GenderType): void => {
    const set = new Set<GenderType>(value);
    if (set.has(g)) set.delete(g);
    else set.add(g);
    onChange(Array.from(set));
  };
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-pill border bg-white p-0.5 shadow-xs',
        invalid ? 'border-terra-500' : 'border-border-default',
        disabled && 'opacity-60',
      )}
    >
      {GENDER_PILLS.map(({ value: g, label }) => {
        const active = value.includes(g);
        return (
          <button
            key={g}
            type="button"
            role="switch"
            aria-checked={active}
            disabled={disabled}
            onClick={() => toggle(g)}
            className={cn(
              'inline-flex items-center rounded-pill px-3 py-1 text-xs font-medium',
              'transition-colors duration-[var(--motion-fast)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
              !disabled && !active && 'text-ink-700 hover:bg-ink-50',
              !active && 'bg-transparent',
              !disabled && 'cursor-pointer',
            )}
            style={
              active
                ? { background: 'var(--accent-500)', color: '#ffffff' }
                : undefined
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

interface StatusPillProps {
  active: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}

function StatusPill({ active, disabled, onChange }: StatusPillProps): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={disabled}
      onClick={() => onChange(!active)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-xs font-medium',
        'transition-colors duration-[var(--motion-fast)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
        active
          ? 'border-transparent text-white'
          : 'border-border-default bg-white text-ink-600 hover:bg-ink-50',
        disabled && 'cursor-not-allowed opacity-60',
        !disabled && 'cursor-pointer',
      )}
      style={active ? { background: 'var(--success, var(--accent-600))' } : undefined}
    >
      <span
        aria-hidden
        className={cn(
          'inline-block h-1.5 w-1.5 rounded-full',
          active ? 'bg-white' : 'bg-ink-400',
        )}
      />
      {active ? 'نشط' : 'موقوف'}
    </button>
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
