/**
 * CategoryConditionBuilder — Gap G (admin-gaps).
 *
 * Renders the expanded admin-side condition matrix for a category in
 * four sections (Demographics / Education / Academic / Required Exams).
 * Dropdowns are wired to the Gap-I lookup catalogue so admin changes
 * to lookups propagate here without code edits.
 *
 * The component is a pure controlled form — parent owns the draft and
 * decides when to save. The save flow's preview-rule-change-impact
 * dialog lives in the parent (CategoryEditPage) so it can branch on
 * `super_admin` for the override path.
 */

import { Card } from '@/shared/components';
import type { CategoryConditions } from '@/shared/types/domain';
import { useLookupList } from '@/features/lookups';

export interface CategoryConditionBuilderProps {
  value: CategoryConditions;
  onChange: (next: CategoryConditions) => void;
  /** When true, all inputs are disabled (e.g. spec-category lock state). */
  readOnly?: boolean;
}

const EMPTY_CONDITIONS: CategoryConditions = {
  gender: 'any',
  minAge: null,
  maxAge: null,
  educationTypes: [],
  graduationYear: null,
  maritalStatuses: [],
  minScore: null,
  requiredDocuments: [],
  requiredExamIds: [],
  examOrder: [],
};

export function CategoryConditionBuilder({
  value,
  onChange,
  readOnly,
}: CategoryConditionBuilderProps): JSX.Element {
  const educationTypesQuery = useLookupList({ typeCode: 'EDUCATION_TYPES', pageSize: 100 });
  const maritalStatusesQuery = useLookupList({ typeCode: 'MARITAL_STATUSES', pageSize: 100 });
  const examTypesQuery = useLookupList({ typeCode: 'EXAM_TYPES', pageSize: 100 });

  const set = <K extends keyof CategoryConditions>(k: K, v: CategoryConditions[K]): void => {
    onChange({ ...value, [k]: v });
  };
  const toggle = (k: 'educationTypes' | 'maritalStatuses' | 'requiredExamIds', item: string): void => {
    const cur = value[k];
    set(k, cur.includes(item) ? cur.filter((i) => i !== item) : [...cur, item]);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ── Demographics ─────────────────────────────────────────────── */}
      <Card>
        <SectionHeader title="الفئة الديموغرافية" subtitle="النوع والسن" />
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="النوع">
            <select
              className={selectCls}
              value={value.gender}
              disabled={readOnly}
              onChange={(e) => set('gender', e.target.value as CategoryConditions['gender'])}
            >
              <option value="any">الكل</option>
              <option value="male">ذكور</option>
              <option value="female">إناث</option>
            </select>
          </Field>
          <Field label="السن الأدنى">
            <input
              type="number"
              className={inputCls}
              value={value.minAge ?? ''}
              disabled={readOnly}
              onChange={(e) => set('minAge', e.target.value ? Number(e.target.value) : null)}
            />
          </Field>
          <Field label="السن الأقصى">
            <input
              type="number"
              className={inputCls}
              value={value.maxAge ?? ''}
              disabled={readOnly}
              onChange={(e) => set('maxAge', e.target.value ? Number(e.target.value) : null)}
            />
          </Field>
          <Field label="تاريخ احتساب السن">
            <input
              type="date"
              className={inputCls}
              value={value.ageCalcDate?.slice(0, 10) ?? ''}
              disabled={readOnly}
              onChange={(e) => set('ageCalcDate', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
            />
          </Field>
          <Field label="الحالة الاجتماعية" full>
            <CheckboxList
              options={(maritalStatusesQuery.data?.data ?? []).filter((r) => r.isActive).map((r) => ({
                value: r.code,
                label: r.nameAr,
              }))}
              selected={value.maritalStatuses}
              onToggle={(v) => toggle('maritalStatuses', v)}
              disabled={readOnly}
            />
          </Field>
        </div>
      </Card>

      {/* ── Education ────────────────────────────────────────────────── */}
      <Card>
        <SectionHeader title="التعليم" subtitle="نوع المؤهل وسنة التخرج" />
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="أنواع المؤهلات المقبولة" full>
            <CheckboxList
              options={(educationTypesQuery.data?.data ?? []).filter((r) => r.isActive).map((r) => ({
                value: r.code,
                label: r.nameAr,
              }))}
              selected={value.educationTypes}
              onToggle={(v) => toggle('educationTypes', v)}
              disabled={readOnly}
            />
          </Field>
          <Field label="سنة التخرج">
            <input
              type="number"
              className={inputCls}
              placeholder="مثل 2025"
              value={value.graduationYear ?? ''}
              disabled={readOnly}
              onChange={(e) => set('graduationYear', e.target.value ? Number(e.target.value) : null)}
            />
          </Field>
        </div>
      </Card>

      {/* ── Academic ─────────────────────────────────────────────────── */}
      <Card>
        <SectionHeader title="الأكاديمي" subtitle="الحد الأدنى للمجموع والمستندات المطلوبة" />
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="الحد الأدنى للمجموع (%)">
            <input
              type="number"
              className={inputCls}
              value={value.minScore ?? ''}
              disabled={readOnly}
              onChange={(e) => set('minScore', e.target.value ? Number(e.target.value) : null)}
            />
          </Field>
          <Field label="المستندات المطلوبة" full>
            <ChipsInput
              value={value.requiredDocuments}
              onChange={(next) => set('requiredDocuments', next)}
              disabled={readOnly}
              placeholder="أضف مستنداً ثم اضغط Enter"
            />
          </Field>
        </div>
      </Card>

      {/* ── Required Exams ───────────────────────────────────────────── */}
      <Card>
        <SectionHeader title="الاختبارات المطلوبة" subtitle="تحدد قائمة الاختبارات الإلزامية لهذه الفئة" />
        <CheckboxList
          options={(examTypesQuery.data?.data ?? []).filter((r) => r.isActive).map((r) => ({
            value: r.code,
            label: r.nameAr,
          }))}
          selected={value.requiredExamIds}
          onToggle={(v) => toggle('requiredExamIds', v)}
          disabled={readOnly}
          twoColumns
        />
      </Card>
    </div>
  );
}

CategoryConditionBuilder.empty = EMPTY_CONDITIONS;

/* ── Local primitives — kept inline because they're not reusable yet. ── */

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }): JSX.Element {
  return (
    <header className="mb-3 border-b border-border-subtle pb-2">
      <h3 className="font-ar-display text-sm font-bold text-ink-900">{title}</h3>
      {subtitle && <p className="mt-0.5 text-2xs text-ink-500">{subtitle}</p>}
    </header>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}): JSX.Element {
  return (
    <div className={'flex flex-col gap-1 ' + (full ? 'md:col-span-2 lg:col-span-3' : '')}>
      <span className="text-2xs uppercase tracking-wide text-ink-500">{label}</span>
      {children}
    </div>
  );
}

const inputCls =
  'w-full rounded-md border border-border-default bg-surface-card px-3 py-2 text-sm text-ink-900 transition-colors duration-fast ease-standard focus-visible:shadow-focus-teal focus-visible:outline-none disabled:opacity-50';
const selectCls = inputCls;

function CheckboxList({
  options,
  selected,
  onToggle,
  disabled,
  twoColumns,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
  disabled?: boolean;
  twoColumns?: boolean;
}): JSX.Element {
  return (
    <div className={twoColumns ? 'grid grid-cols-2 gap-1' : 'flex flex-wrap gap-1.5'}>
      {options.map((opt) => {
        const isOn = selected.includes(opt.value);
        return (
          <label
            key={opt.value}
            className={
              'flex cursor-pointer items-center gap-2 rounded-pill border px-3 py-1 text-2xs transition-colors duration-fast ease-standard ' +
              (isOn
                ? 'border-teal-500 bg-teal-50 text-teal-700'
                : 'border-border-default bg-surface-card text-ink-700 hover:bg-ink-50') +
              (disabled ? ' pointer-events-none opacity-50' : '')
            }
          >
            <input
              type="checkbox"
              className="h-3.5 w-3.5 cursor-pointer accent-teal-500"
              checked={isOn}
              onChange={() => onToggle(opt.value)}
              disabled={disabled}
            />
            {opt.label}
          </label>
        );
      })}
      {options.length === 0 && (
        <span className="text-2xs text-ink-500">لا توجد خيارات نشطة. أضف عناصر من البيانات المرجعية أولاً.</span>
      )}
    </div>
  );
}

function ChipsInput({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <input
        type="text"
        className={inputCls}
        placeholder={placeholder}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          const v = (e.target as HTMLInputElement).value.trim();
          if (!v) return;
          onChange([...value, v]);
          (e.target as HTMLInputElement).value = '';
        }}
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v, i) => (
            <span
              key={`${v}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-pill border border-border-default bg-ink-50 px-3 py-1 text-2xs text-ink-700"
            >
              {v}
              {!disabled && (
                <button
                  type="button"
                  aria-label="إزالة"
                  className="text-ink-500 hover:text-terra-500"
                  onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
