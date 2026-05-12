/**
 * YearTable — editable year cards for one category-specialization junction.
 *
 * Each year renders as a card (not a table row) so the eleven editable
 * fields can lay out on a normal viewport without horizontal scroll.
 * Inside each card, fields are grouped into three semantic sections:
 *
 *   • البيانات الأساسية — graduation year, gender, marital status
 *   • الشروط الأكاديمية — grade/percentage, division, maximum age
 *   • الفترة الزمنية   — application start/end, age reference date
 *
 * Card header strip carries the year chips (a teaser of what's selected),
 * the active/suspended switch, and delete/restore. Dirty rows get a 2 px
 * gold-400 inline-start rail on the card edge.
 *
 * Inline validation runs after each `patchRow` via the draft store; the
 * relevant conflict code is surfaced as a terra-500 chip under the
 * field(s) responsible and `aria-invalid="true"` is set on the offending
 * field. No per-row save — bulk save lives in `<StickyBulkSaveBar />`.
 *
 * Branched grade input (column 5 in the old table) is determined ONCE
 * per table-instance via `useResolvedGradingModeForSpec` so the form
 * doesn't oscillate row-by-row. The discriminator on the row itself is
 * the source of truth for which input renders — a row whose `gradeKind`
 * has drifted from the resolved mode still renders in its own branch (so
 * the value is editable), and the conflict banner above the cards
 * surfaces the drift.
 */

import { useEffect, useMemo } from 'react';
import { AlertTriangle, Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  Button,
  Combobox,
  DatePicker,
  Input,
  MultiSelect,
} from '@/shared/components';
import { cn } from '@/shared/lib/cn';
import {
  readPercentageRange,
  useLookup,
  type GradingMode,
} from '@/features/lookups';
import {
  useParentCategoryForSpec,
  useResolvedGradingModeForSpec,
  useYears,
} from '../../api/applicationSettings.queries';
import type { ParentCategorySnapshot } from '../../api/applicationSettings.service';
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
/** Last 5 graduation years including the current year, newest first. */
const GRAD_YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => {
  const year = CURRENT_YEAR - i;
  return { value: String(year), label: String(year) };
});

const FIELD_MESSAGES_AR: Record<AppSettingsConflict, string> = {
  DUPLICATE_YEAR: 'مكررة',
  GRAD_YEAR_REQUIRED: 'اختر سنة تخرج واحدة على الأقل',
  INVALID_DATE_RANGE: 'ترتيب التواريخ غير صحيح',
  OVERLAPPING_PERIOD: 'تتداخل مع سنة أخرى',
  AGE_NOT_POSITIVE: 'السن > 0',
  AGE_RANGE_INVALID: 'السن الأدنى ≤ الأقصى',
  AGE_REFERENCE_AFTER_START: 'تاريخ احتساب السن يجب أن يسبق بداية التقديم',
  PERCENTAGE_OUT_OF_RANGE: 'النسبة 0–100',
  GRADE_MODE_MISMATCH: 'نمط تقدير غير مطابق',
  GENDER_REQUIRED: 'اختر النوع',
  SPECIALIZATION_NOT_MAPPED: 'غير مرتبط',
  CATEGORY_HAS_ACTIVE_YEARS: 'فئة بها سنوات نشطة',
};

const GENDER_PILLS: { value: GenderType; label: string }[] = [
  { value: 'male', label: 'ذكور' },
  { value: 'female', label: 'إناث' },
];

export function YearTable({ categorySpecializationId }: YearTableProps): JSX.Element {
  const yearsQuery = useYears(categorySpecializationId);
  const gradingModeQuery = useResolvedGradingModeForSpec(categorySpecializationId);
  const parentCategoryQuery = useParentCategoryForSpec(categorySpecializationId);
  const maritalQuery = useLookup('marital-statuses');
  const divisionsQuery = useLookup('applicant-divisions');
  const academicGradesQuery = useLookup('academic-grades');
  const schoolCategoriesQuery = useLookup('school-categories');

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

  const maritalOptions = useMemo(
    () => (maritalQuery.data ?? []).map((m) => ({ value: m.code, label: m.name })),
    [maritalQuery.data],
  );
  const divisionOptions = useMemo(
    () => (divisionsQuery.data ?? []).map((d) => ({ value: d.code, label: d.name })),
    [divisionsQuery.data],
  );
  const schoolCategoryOptions = useMemo(
    () => (schoolCategoriesQuery.data ?? []).map((s) => ({ value: s.code, label: s.name })),
    [schoolCategoriesQuery.data],
  );
  const parentCategory = parentCategoryQuery.data ?? null;
  const academicGradeOptions = useMemo(
    () => (academicGradesQuery.data ?? []).map((g) => ({ value: g.code, label: g.name })),
    [academicGradesQuery.data],
  );
  const academicGradeRangeByCode = useMemo(() => {
    const map = new Map<string, { min: number; max: number } | null>();
    for (const row of academicGradesQuery.data ?? []) {
      map.set(row.code, readPercentageRange(row));
    }
    return map;
  }, [academicGradesQuery.data]);

  const gradingMode: GradingMode | null = gradingModeQuery.data ?? null;
  const setSliceMismatch = useAppSettingsDraftStore((s) => s.setSliceMismatch);

  const hasMismatch = useMemo(() => {
    if (!gradingMode) return false;
    return drafts.some(
      (d) => d.kind !== 'deleted' && d.row.gradeKind !== gradingMode,
    );
  }, [drafts, gradingMode]);

  useEffect(() => {
    setSliceMismatch(categorySpecializationId, hasMismatch);
    return () => setSliceMismatch(categorySpecializationId, false);
  }, [categorySpecializationId, hasMismatch, setSliceMismatch]);

  /* Honor the parent category's gender lock — pin any drafted row's
   * genderTypes to the locked value as soon as we know it. The patch is
   * a no-op once everything is aligned. */
  useEffect(() => {
    if (!parentCategory || parentCategory.genderScope === 'any') return;
    const locked = parentCategory.genderScope;
    for (const draft of drafts) {
      if (draft.kind === 'deleted') continue;
      const current = draft.row.genderTypes;
      if (current.length === 1 && current[0] === locked) continue;
      patchRow(categorySpecializationId, draft.id, { genderTypes: [locked] });
    }
  }, [parentCategory, drafts, categorySpecializationId, patchRow]);

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
          onClick={() =>
            addRow(
              categorySpecializationId,
              gradingMode === 'TAGDIR' ? { gradeKind: 'TAGDIR' } : { gradeKind: 'GRADES' },
            )
          }
        >
          إضافة سنة
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {hasMismatch && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-terra-500 bg-terra-50 px-3 py-2"
        >
          <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 text-terra-700" aria-hidden />
          <p className="font-ar text-sm text-terra-700">
            تعارض في نمط التقدير — يجب حذف السنوات وإعادة إنشائها لتتطابق مع
            نوع تقديم الفئة الحالية ({gradingMode === 'TAGDIR' ? 'تقدير' : 'درجة مئوية'}).
          </p>
        </div>
      )}

      <ol className="flex flex-col gap-2.5">
        {drafts.map((draft) => (
          <li key={draft.id}>
            <YearCard
              draft={draft}
              conflict={validationByRow.get(draft.id) ?? null}
              gradingMode={gradingMode}
              parentCategory={parentCategory}
              maritalOptions={maritalOptions}
              divisionOptions={divisionOptions}
              schoolCategoryOptions={schoolCategoryOptions}
              academicGradeOptions={academicGradeOptions}
              academicGradeRangeByCode={academicGradeRangeByCode}
              onPatch={(patch) => patchRow(categorySpecializationId, draft.id, patch)}
              onDelete={() => deleteRow(categorySpecializationId, draft.id)}
              onRestore={() => restoreRow(categorySpecializationId, draft.id)}
            />
          </li>
        ))}
      </ol>

      <div className="flex justify-start">
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<Plus size={14} strokeWidth={1.75} />}
          onClick={() => {
            const seed: Partial<ApplicantSpecializationYear> = {};
            if (gradingMode === 'TAGDIR') seed.gradeKind = 'TAGDIR';
            else seed.gradeKind = 'GRADES';
            /* Seed gender from the parent category's lock so new rows in
             * male-only / female-only categories start in a valid state. */
            if (parentCategory && parentCategory.genderScope !== 'any') {
              seed.genderTypes = [parentCategory.genderScope];
            }
            addRow(categorySpecializationId, seed);
          }}
        >
          إضافة سنة
        </Button>
      </div>
    </div>
  );
}

interface YearCardProps {
  draft: DraftRow;
  conflict: AppSettingsConflict | null;
  gradingMode: GradingMode | null;
  parentCategory: ParentCategorySnapshot | null;
  maritalOptions: readonly { value: string; label: string }[];
  divisionOptions: readonly { value: string; label: string }[];
  schoolCategoryOptions: readonly { value: string; label: string }[];
  academicGradeOptions: readonly { value: string; label: string }[];
  academicGradeRangeByCode: ReadonlyMap<string, { min: number; max: number } | null>;
  onPatch: (patch: Partial<ApplicantSpecializationYear>) => void;
  onDelete: () => void;
  onRestore: () => void;
}

function YearCard({
  draft,
  conflict,
  gradingMode,
  parentCategory,
  maritalOptions,
  divisionOptions,
  schoolCategoryOptions,
  academicGradeOptions,
  academicGradeRangeByCode,
  onPatch,
  onDelete,
  onRestore,
}: YearCardProps): JSX.Element {
  const isDeleted = draft.kind === 'deleted';
  const isDirty = draft.kind === 'dirty' || draft.kind === 'new';
  const row = draft.row;

  const matchField = (fields: AppSettingsConflict[]): string | null => {
    if (!conflict) return null;
    return fields.includes(conflict) ? FIELD_MESSAGES_AR[conflict] : null;
  };

  const yearError = matchField(['DUPLICATE_YEAR', 'GRAD_YEAR_REQUIRED']);
  const genderError = matchField(['GENDER_REQUIRED', 'DUPLICATE_YEAR', 'OVERLAPPING_PERIOD']);
  const ageError = matchField(['AGE_NOT_POSITIVE', 'AGE_RANGE_INVALID']);
  const gradeError = matchField(['PERCENTAGE_OUT_OF_RANGE', 'GRADE_MODE_MISMATCH']);
  const dateError = matchField(['INVALID_DATE_RANGE', 'OVERLAPPING_PERIOD']);
  const refError = matchField(['AGE_REFERENCE_AFTER_START']);

  const isSuspended = !row.isActive && !isDeleted;
  /* Per RFP §2.1: when the parent category locks gender (male-only for
   * officers_general, female-only for physical_education_bachelor), the
   * gender toggle is read-only and the row's genderTypes is pinned to
   * the locked value. */
  const lockedGender =
    parentCategory && parentCategory.genderScope !== 'any'
      ? parentCategory.genderScope
      : null;
  const showSchoolCategory = parentCategory?.code === 'officers_general';
  const showDivision = parentCategory?.code === 'officers_general';

  return (
    <article
      className={cn(
        'rounded-md border border-border-subtle bg-surface-card transition-colors duration-[var(--motion-fast)]',
        isDeleted && 'opacity-60',
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
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <div className="flex items-baseline gap-2.5">
          {row.graduationYears.length === 0 ? (
            <span className="font-ar text-sm text-ink-400">— لم تُختر سنة تخرج —</span>
          ) : (
            <span className="font-en text-lg font-semibold tabular-nums text-ink-900">
              {row.graduationYears.length === 1
                ? row.graduationYears[0]
                : row.graduationYears.join('، ')}
            </span>
          )}
          <span className="font-ar text-2xs text-ink-500">
            {row.graduationYears.length > 1 ? 'سنوات تخرج' : 'سنة تخرج'}
          </span>
          {isDirty && (
            <span className="inline-flex items-center rounded-pill border border-gold-300 bg-gold-50 px-1.5 py-0.5 font-ar text-2xs text-gold-700">
              غير محفوظ
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <StatusToggle
            active={row.isActive}
            disabled={isDeleted}
            onChange={(next) => onPatch({ isActive: next })}
          />
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
            <button
              type="button"
              onClick={onDelete}
              aria-label="حذف"
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 font-ar text-xs font-medium text-terra-700',
                'transition-colors duration-[var(--motion-fast)]',
                'hover:bg-terra-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
              )}
            >
              <Trash2 size={14} strokeWidth={1.75} aria-hidden />
              حذف
            </button>
          )}
        </div>
      </header>

      <div
        className={cn(
          'flex flex-col gap-6 px-4 py-5',
          isSuspended && 'bg-ink-50/30',
        )}
      >
        <FieldGroup title="البيانات الأساسية">
          <Field label="سنة التخرج" width="wide" error={yearError}>
            <MultiSelect
              value={row.graduationYears.map(String)}
              onChange={(next) =>
                onPatch({
                  graduationYears: next
                    .map((v) => Number(v))
                    .filter((n) => Number.isFinite(n))
                    .sort((x, y) => y - x),
                })
              }
              options={GRAD_YEAR_OPTIONS}
              disabled={isDeleted}
              ariaLabel="سنة التخرج"
              placeholder="اختر سنة"
            />
          </Field>

          <Field
            label="النوع"
            width="narrow"
            error={genderError}
            helper={lockedGender ? 'مقفول حسب الفئة' : undefined}
          >
            {lockedGender ? (
              <LockedGenderBadge gender={lockedGender} />
            ) : (
              <GenderToggle
                value={row.genderTypes}
                disabled={isDeleted}
                onChange={(next) => onPatch({ genderTypes: next })}
                ariaLabel="النوع"
                invalid={Boolean(genderError)}
              />
            )}
          </Field>

          <Field label="الحالة الاجتماعية" width="wide" helper="اتركها فارغة للسماح بأي حالة">
            <MultiSelect
              value={row.maritalStatusCodes}
              onChange={(next) => onPatch({ maritalStatusCodes: next })}
              options={maritalOptions}
              disabled={isDeleted}
              ariaLabel="الحالة الاجتماعية"
              placeholder="الكل"
            />
          </Field>
        </FieldGroup>

        <FieldGroup title="الشروط الأكاديمية">
          <Field
            label={gradingMode === 'TAGDIR' ? 'التقدير' : 'الحد الأدنى للدرجة'}
            width="narrow"
            error={gradeError}
          >
            <GradeBranchCell
              row={row}
              gradingMode={gradingMode}
              disabled={isDeleted}
              invalid={Boolean(gradeError)}
              academicGradeOptions={academicGradeOptions}
              academicGradeRangeByCode={academicGradeRangeByCode}
              onPatch={onPatch}
            />
          </Field>

          <Field label="نطاق السن" width="medium" error={ageError}>
            <div className="inline-flex items-center gap-1.5">
              <Input
                type="number"
                min={1}
                disabled={isDeleted}
                value={row.ageMin ?? ''}
                onChange={(e) =>
                  onPatch({ ageMin: e.target.value === '' ? null : Number(e.target.value) })
                }
                containerClassName="!mb-0 w-20"
                className="text-end tabular-nums"
                aria-invalid={Boolean(ageError) || undefined}
                aria-label="السن الأدنى"
                placeholder="بدون"
              />
              <span aria-hidden className="font-ar text-2xs text-ink-500">إلى</span>
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
                placeholder="بدون"
              />
              <span aria-hidden className="font-ar text-xs text-ink-500">سنة</span>
            </div>
          </Field>

          {showSchoolCategory && (
            <Field label="فئة المدرسة" width="wide" helper="اتركها فارغة للسماح بأي فئة">
              <MultiSelect
                value={row.schoolCategoryCodes}
                onChange={(next) => onPatch({ schoolCategoryCodes: next })}
                options={schoolCategoryOptions}
                disabled={isDeleted}
                ariaLabel="فئة المدرسة"
                placeholder="الكل"
              />
            </Field>
          )}

          {showDivision && (
            <Field label="الشعبة" width="wide" helper="اتركها فارغة للسماح بأي شعبة">
              <MultiSelect
                value={row.divisionCodes}
                onChange={(next) => onPatch({ divisionCodes: next })}
                options={divisionOptions}
                disabled={isDeleted}
                ariaLabel="الشعبة"
                placeholder="الكل"
              />
            </Field>
          )}
        </FieldGroup>

        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <h4 className="font-ar text-xs font-semibold text-ink-800">الفترة الزمنية</h4>
            <span aria-hidden className="h-px flex-1 bg-border-subtle" />
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-4">
            <div className="flex min-w-[280px] max-w-[420px] flex-1 flex-col gap-1.5">
              <label className="font-ar text-xs font-medium text-ink-700">فترة التقديم</label>
              <div className="flex items-start gap-2">
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="font-ar text-2xs text-ink-500">من</span>
                  <DatePicker
                    value={isoToDate(row.applicationStartDate)}
                    disabled={isDeleted}
                    onChange={(d) =>
                      onPatch({
                        applicationStartDate: dateToIso(d) ?? row.applicationStartDate,
                      })
                    }
                  />
                </div>
                <span
                  aria-hidden
                  className="pt-6 font-ar text-2xs text-ink-400"
                >
                  ←
                </span>
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="font-ar text-2xs text-ink-500">إلى</span>
                  <DatePicker
                    value={isoToDate(row.applicationEndDate)}
                    disabled={isDeleted}
                    onChange={(d) =>
                      onPatch({
                        applicationEndDate: dateToIso(d) ?? row.applicationEndDate,
                      })
                    }
                    min={row.applicationStartDate.slice(0, 10)}
                  />
                  {dateError && <FieldError text={dateError} />}
                </div>
              </div>
            </div>

            <Field
              label="تاريخ احتساب السن"
              width="medium"
              helper="يسبق بداية التقديم"
              error={refError}
            >
              <DatePicker
                value={isoToDate(row.ageReferenceDate)}
                disabled={isDeleted}
                onChange={(d) =>
                  onPatch({ ageReferenceDate: dateToIso(d) ?? row.ageReferenceDate })
                }
                max={row.applicationStartDate.slice(0, 10)}
              />
            </Field>
          </div>
        </section>
      </div>
    </article>
  );
}

interface FieldGroupProps {
  title: string;
  children: React.ReactNode;
}

function FieldGroup({ title, children }: FieldGroupProps): JSX.Element {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h4 className="font-ar text-xs font-semibold text-ink-800">{title}</h4>
        <span aria-hidden className="h-px flex-1 bg-border-subtle" />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-4">{children}</div>
    </section>
  );
}

type FieldWidth = 'narrow' | 'medium' | 'wide';

const FIELD_WIDTH: Record<FieldWidth, string> = {
  /* Fits gender toggle, number-with-suffix inputs. */
  narrow: 'min-w-[160px]',
  /* Fits date pickers, single combobox triggers. */
  medium: 'min-w-[200px] flex-1 max-w-[260px]',
  /* Fits multi-select chips comfortably. */
  wide: 'min-w-[240px] flex-1 max-w-[360px]',
};

interface FieldProps {
  label: string;
  helper?: string;
  error?: string | null;
  width?: FieldWidth;
  children: React.ReactNode;
}

function Field({
  label,
  helper,
  error,
  width = 'wide',
  children,
}: FieldProps): JSX.Element {
  return (
    <div className={cn('flex flex-col gap-1.5', FIELD_WIDTH[width])}>
      <label className="font-ar text-xs font-medium text-ink-700">{label}</label>
      {children}
      {error ? (
        <FieldError text={error} />
      ) : helper ? (
        <span className="font-ar text-2xs text-ink-400">{helper}</span>
      ) : null}
    </div>
  );
}

interface GradeBranchCellProps {
  row: ApplicantSpecializationYear;
  gradingMode: GradingMode | null;
  disabled: boolean;
  invalid: boolean;
  academicGradeOptions: readonly { value: string; label: string }[];
  academicGradeRangeByCode: ReadonlyMap<string, { min: number; max: number } | null>;
  onPatch: (patch: Partial<ApplicantSpecializationYear>) => void;
}

function GradeBranchCell({
  row,
  gradingMode,
  disabled,
  invalid,
  academicGradeOptions,
  academicGradeRangeByCode,
  onPatch,
}: GradeBranchCellProps): JSX.Element {
  /* Discriminator on the row is the source of truth. A row whose
   * gradeKind has drifted from the resolved gradingMode still renders
   * in its own branch so the value is editable; the conflict banner
   * above the cards is what surfaces the drift. */
  if (row.gradeKind === 'TAGDIR') {
    const range = academicGradeRangeByCode.get(row.academicGradeId) ?? null;
    return (
      <div className="flex flex-col items-start gap-0.5">
        <Combobox
          value={row.academicGradeId || null}
          options={academicGradeOptions}
          disabled={disabled}
          onChange={(next) => onPatch({ academicGradeId: next ?? '' })}
          placeholder="اختر التقدير"
          ariaLabel="التقدير"
          error={invalid ? ' ' : undefined}
        />
        {range && (
          <span className="font-en text-2xs tabular-nums text-ink-500">
            {range.min}–{range.max}%
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <Input
        type="number"
        min={0}
        max={100}
        disabled={disabled}
        value={row.minPercentage}
        onChange={(e) =>
          onPatch({ minPercentage: e.target.value === '' ? 0 : Number(e.target.value) })
        }
        containerClassName="!mb-0 w-24"
        className="text-end tabular-nums"
        aria-invalid={invalid || undefined}
        aria-label="الدرجة المئوية"
      />
      <span aria-hidden className="font-ar text-2xs text-ink-500">%</span>
      {gradingMode === 'TAGDIR' && (
        <span className="font-ar text-2xs text-terra-700">الفئة تستخدم التقدير</span>
      )}
    </div>
  );
}

interface LockedGenderBadgeProps {
  gender: 'male' | 'female';
}

function LockedGenderBadge({ gender }: LockedGenderBadgeProps): JSX.Element {
  return (
    <span
      role="img"
      aria-label={gender === 'male' ? 'ذكور فقط — مقفول حسب الفئة' : 'إناث فقط — مقفول حسب الفئة'}
      className="inline-flex w-fit items-center gap-1.5 rounded-pill border border-border-default bg-ink-50 px-3 py-1 font-ar text-xs font-medium text-ink-700"
    >
      <span aria-hidden>{gender === 'male' ? 'ذكور فقط' : 'إناث فقط'}</span>
    </span>
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

interface StatusToggleProps {
  active: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}

function StatusToggle({ active, disabled, onChange }: StatusToggleProps): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label="حالة السنة"
      disabled={disabled}
      onClick={() => onChange(!active)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 font-ar text-xs font-medium',
        'transition-colors duration-[var(--motion-fast)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
        active
          ? 'border-border-default bg-white text-ink-800 hover:bg-ink-50'
          : 'border-transparent bg-ink-100 text-ink-500 hover:bg-ink-200',
        disabled && 'cursor-not-allowed opacity-60',
        !disabled && 'cursor-pointer',
      )}
    >
      <span
        aria-hidden
        className={cn('inline-block h-1.5 w-1.5 rounded-full')}
        style={active ? { background: 'var(--accent-600)' } : { background: 'var(--ink-400)' }}
      />
      {active ? 'نشط' : 'موقوف'}
    </button>
  );
}

function FieldError({ text }: { text: string }): JSX.Element {
  return (
    <span
      role="alert"
      className="mt-1 inline-flex w-fit items-center rounded-pill bg-terra-50 px-1.5 py-0.5 text-2xs text-terra-700"
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
