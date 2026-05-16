/**
 * ThanawiRulesSection — «الشروط العامة» editor for one Pre-University
 * (`type === 'pre_university'`) applicant-category.
 *
 * Layout mirrors `GeneralRulesSection` (dates + marital-status header,
 * inline form, local grid, اعتماد footer) but replaces the
 * faculty/specialization picker with a Thanaweya-specific combinations
 * grid keyed by:
 *
 *   الدور (exam-rounds) · اللجنة (committees scoped to the category)
 *     · سنة التخرج · فئة المدرسة (school-categories)
 *
 * Duplicate rows are rejected at the store boundary; the form surfaces
 * a danger toast when the store reports a collision.
 */

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  DatePicker,
  EmptyState,
  ErrorState,
  LoadingState,
  MultiSelect,
  SearchSelect,
  toast,
} from '@/shared/components';
import type { SearchSelectOption } from '@/shared/components';
import { useLookup } from '@/features/lookups';
import { num } from '@/shared/lib/format';
import { toEasternArabicNumerals } from '@/shared/lib/arabic';
import {
  useAdmissionSetupWizardStore,
  type LocalThanawiRow,
  type ThanawiRuleRowInput,
} from '../../store/wizardSharedState';

const CURRENT_YEAR = new Date().getFullYear();
const GRADUATION_YEAR_OPTIONS: ReadonlyArray<SearchSelectOption> = Array.from(
  { length: 5 },
  (_, i) => {
    const y = CURRENT_YEAR - i;
    return { value: String(y), label: toEasternArabicNumerals(y) };
  },
);

const EMPTY_INPUT: ThanawiRuleRowInput = {
  examRound: '',
  committee: '',
  graduationYear: null,
  schoolCategory: '',
};

interface ThanawiRulesSectionProps {
  categoryCode: string;
}

export function ThanawiRulesSection({
  categoryCode,
}: ThanawiRulesSectionProps): JSX.Element {
  const maritalQuery = useLookup('marital-statuses');
  const examRoundsQuery = useLookup('exam-rounds');
  const committeesQuery = useLookup('committees');
  const schoolCategoriesQuery = useLookup('school-categories');

  const approve = useAdmissionSetupWizardStore((s) => s.approveLocalForCategory);
  const localCount = useAdmissionSetupWizardStore(
    (s) => s.local.filter((r) => r.categoryCode === categoryCode).length,
  );

  const isLoading =
    maritalQuery.isLoading ||
    examRoundsQuery.isLoading ||
    committeesQuery.isLoading ||
    schoolCategoriesQuery.isLoading;

  const isError =
    maritalQuery.isError ||
    examRoundsQuery.isError ||
    committeesQuery.isError ||
    schoolCategoriesQuery.isError;

  const maritalOptions = useMemo(
    () =>
      (maritalQuery.data ?? [])
        .filter((m) => m.isActive)
        .map((m) => ({ value: m.code, label: m.name })),
    [maritalQuery.data],
  );

  const examRoundOptions = useMemo<SearchSelectOption[]>(
    () =>
      (examRoundsQuery.data ?? [])
        .filter((r) => r.isActive)
        .map((r) => ({ value: r.code, label: r.name })),
    [examRoundsQuery.data],
  );

  const committeeOptions = useMemo<SearchSelectOption[]>(
    () =>
      (committeesQuery.data ?? [])
        .filter((c) => c.isActive && c.applicantCategoryId === categoryCode)
        .map((c) => ({ value: c.code, label: c.name })),
    [committeesQuery.data, categoryCode],
  );

  const schoolCategoryOptions = useMemo<SearchSelectOption[]>(
    () =>
      (schoolCategoriesQuery.data ?? [])
        .filter((s) => s.isActive)
        .map((s) => ({ value: s.code, label: s.name })),
    [schoolCategoriesQuery.data],
  );

  const handleApprove = (): void => {
    const moved = approve(categoryCode);
    if (moved === 0) {
      toast('لا توجد قواعد جاهزة للاعتماد', 'info');
      return;
    }
    toast(`تم اعتماد ${num(moved)} قاعدة ونقلها إلى تبويب «العرض»`, 'success');
  };

  if (isLoading) return <LoadingState variant="list" />;
  if (isError) {
    return (
      <ErrorState
        title="تعذر تحميل البيانات المرجعية"
        description="حاول إعادة المحاولة بعد قليل."
        onRetry={() => {
          maritalQuery.refetch();
          examRoundsQuery.refetch();
          committeesQuery.refetch();
          schoolCategoriesQuery.refetch();
        }}
      />
    );
  }

  return (
    <section
      className="rounded-md border border-border-default bg-surface-card p-4"
      aria-label="الشروط العامة"
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-ar text-base font-semibold text-ink-900">
            الشروط العامة
          </h3>
          <p className="mt-0.5 font-ar text-xs text-ink-500">
            عيّن نطاق التقديم، الحالة الاجتماعية، وقواعد قبول الثانوية العامة.
          </p>
        </div>
      </header>

      <ThanawiTopFields
        categoryCode={categoryCode}
        maritalOptions={maritalOptions}
      />

      <div className="mt-4">
        {committeeOptions.length === 0 ? (
          <EmptyState
            variant="generic"
            title="لا توجد لجان مرتبطة بهذه الفئة"
            description="اربط لجاناً بفئة المتقدمين هذه من الأكواد المرجعية أولاً."
          />
        ) : (
          <ThanawiForm
            categoryCode={categoryCode}
            examRoundOptions={examRoundOptions}
            committeeOptions={committeeOptions}
            schoolCategoryOptions={schoolCategoryOptions}
          />
        )}
      </div>

      <div className="mt-5 flex items-center justify-end gap-3 border-t border-border-subtle pt-4">
        <span className="font-ar text-xs text-ink-500">
          {localCount === 0
            ? 'لا توجد قواعد محلية بعد'
            : `${num(localCount)} قاعدة جاهزة للاعتماد`}
        </span>
        <Button
          variant="primary"
          size="md"
          onClick={handleApprove}
          disabled={localCount === 0}
        >
          اعتماد
        </Button>
      </div>
    </section>
  );
}

/* ── Top fields (per-category header) ─────────────────────────────── */

interface ThanawiTopFieldsProps {
  categoryCode: string;
  maritalOptions: ReadonlyArray<{ value: string; label: string }>;
}

function ThanawiTopFields({
  categoryCode,
  maritalOptions,
}: ThanawiTopFieldsProps): JSX.Element {
  const header = useAdmissionSetupWizardStore(
    (s) => s.headers[categoryCode] ?? s.getHeader(categoryCode),
  );
  const setHeaderField = useAdmissionSetupWizardStore((s) => s.setHeaderField);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <FieldLabel label="بداية التقديم">
        <DatePicker
          value={isoToDate(header.applicationStart)}
          onChange={(d) =>
            setHeaderField(categoryCode, 'applicationStart', dateToIso(d))
          }
          placeholder="اختر اليوم…"
        />
      </FieldLabel>
      <FieldLabel label="نهاية التقديم">
        <DatePicker
          value={isoToDate(header.applicationEnd)}
          onChange={(d) =>
            setHeaderField(categoryCode, 'applicationEnd', dateToIso(d))
          }
          placeholder="اختر اليوم…"
        />
      </FieldLabel>
      <FieldLabel label="تاريخ احتساب السن">
        <DatePicker
          value={isoToDate(header.ageReferenceDate)}
          onChange={(d) =>
            setHeaderField(categoryCode, 'ageReferenceDate', dateToIso(d))
          }
          placeholder="اختر اليوم…"
        />
      </FieldLabel>
      <FieldLabel label="الحالة الاجتماعية">
        <MultiSelect
          ariaLabel="الحالة الاجتماعية"
          value={header.maritalStatus}
          onChange={(next) => setHeaderField(categoryCode, 'maritalStatus', next)}
          options={maritalOptions}
          placeholder="اختر الحالة الاجتماعية…"
        />
      </FieldLabel>
    </div>
  );
}

function isoToDate(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateToIso(d: Date | null): string {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface FieldLabelProps {
  label: string;
  children: React.ReactNode;
}

function FieldLabel({ label, children }: FieldLabelProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-ar text-xs font-medium text-ink-700">{label}</span>
      {children}
    </div>
  );
}

/* ── Per-category form + grid ─────────────────────────────────────── */

interface ThanawiFormProps {
  categoryCode: string;
  examRoundOptions: ReadonlyArray<SearchSelectOption>;
  committeeOptions: ReadonlyArray<SearchSelectOption>;
  schoolCategoryOptions: ReadonlyArray<SearchSelectOption>;
}

function ThanawiForm({
  categoryCode,
  examRoundOptions,
  committeeOptions,
  schoolCategoryOptions,
}: ThanawiFormProps): JSX.Element {
  const [draft, setDraft] = useState<ThanawiRuleRowInput>(EMPTY_INPUT);

  const addThanawiRow = useAdmissionSetupWizardStore((s) => s.addThanawiRow);
  const removeLocalRow = useAdmissionSetupWizardStore((s) => s.removeLocalRow);
  const rows = useAdmissionSetupWizardStore((s) =>
    s.local.filter(
      (r): r is LocalThanawiRow =>
        r.kind === 'thanawi' && r.categoryCode === categoryCode,
    ),
  );

  const canAdd =
    draft.examRound.length > 0 &&
    draft.committee.length > 0 &&
    draft.graduationYear !== null &&
    draft.schoolCategory.length > 0;

  const handleAdd = (): void => {
    if (!canAdd) return;
    const result = addThanawiRow(categoryCode, draft);
    if (!result.ok) {
      toast('هذه التركيبة موجودة بالفعل في الجدول', 'danger');
      return;
    }
    setDraft(EMPTY_INPUT);
    toast('تمت إضافة القاعدة محلياً', 'success');
  };

  return (
    <div className="flex flex-col gap-4">
      <Card variant="compact">
        <header className="mb-3 flex items-center justify-between gap-3">
          <h4 className="font-ar text-sm font-semibold text-ink-900">
            تركيبات القبول (الثانوية العامة)
          </h4>
        </header>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <FieldLabel label="الدور">
            <SearchSelect
              ariaLabel="الدور"
              value={draft.examRound || null}
              onChange={(v) =>
                setDraft((d) => ({ ...d, examRound: v ?? '' }))
              }
              options={examRoundOptions}
              placeholder="اختر الدور…"
            />
          </FieldLabel>
          <FieldLabel label="اللجنة">
            <SearchSelect
              ariaLabel="اللجنة"
              value={draft.committee || null}
              onChange={(v) =>
                setDraft((d) => ({ ...d, committee: v ?? '' }))
              }
              options={committeeOptions}
              placeholder="اختر اللجنة…"
            />
          </FieldLabel>
          <FieldLabel label="سنة التخرج">
            <SearchSelect
              ariaLabel="سنة التخرج"
              value={
                draft.graduationYear !== null ? String(draft.graduationYear) : null
              }
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  graduationYear: v === null ? null : Number(v),
                }))
              }
              options={GRADUATION_YEAR_OPTIONS}
              placeholder="اختر السنة…"
            />
          </FieldLabel>
          <FieldLabel label="فئة المدرسة">
            <SearchSelect
              ariaLabel="فئة المدرسة"
              value={draft.schoolCategory || null}
              onChange={(v) =>
                setDraft((d) => ({ ...d, schoolCategory: v ?? '' }))
              }
              options={schoolCategoryOptions}
              placeholder="اختر فئة المدرسة…"
            />
          </FieldLabel>
        </div>

        <div className="mt-4 flex items-center justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={handleAdd}
            disabled={!canAdd}
            leadingIcon={<Plus size={14} strokeWidth={1.75} aria-hidden />}
          >
            إضافة
          </Button>
        </div>
      </Card>

      <ThanawiGrid
        rows={rows}
        examRoundOptions={examRoundOptions}
        committeeOptions={committeeOptions}
        schoolCategoryOptions={schoolCategoryOptions}
        onDelete={(id) => removeLocalRow(id)}
      />
    </div>
  );
}

interface ThanawiGridProps {
  rows: LocalThanawiRow[];
  examRoundOptions: ReadonlyArray<SearchSelectOption>;
  committeeOptions: ReadonlyArray<SearchSelectOption>;
  schoolCategoryOptions: ReadonlyArray<SearchSelectOption>;
  onDelete: (id: string) => void;
}

function ThanawiGrid({
  rows,
  examRoundOptions,
  committeeOptions,
  schoolCategoryOptions,
  onDelete,
}: ThanawiGridProps): JSX.Element {
  const labelForRound = (v: string): string =>
    examRoundOptions.find((o) => o.value === v)?.label ?? v;
  const labelForCommittee = (v: string): string =>
    committeeOptions.find((o) => o.value === v)?.label ?? v;
  const labelForSchool = (v: string): string =>
    schoolCategoryOptions.find((o) => o.value === v)?.label ?? v;

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border-subtle bg-ink-50/40 px-3 py-3 text-2xs text-ink-500">
        لم تُضف تركيبات بعد لهذه الفئة.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border-subtle bg-surface-card">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-ink-50/80">
          <tr>
            <Th>الدور</Th>
            <Th>اللجنة</Th>
            <Th>سنة التخرج</Th>
            <Th>فئة المدرسة</Th>
            <th className="px-3 py-2">
              <span className="sr-only">إجراءات</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border-subtle">
              <Td>{labelForRound(r.examRound)}</Td>
              <Td>{labelForCommittee(r.committee)}</Td>
              <Td>
                {r.graduationYear !== null
                  ? toEasternArabicNumerals(r.graduationYear)
                  : '—'}
              </Td>
              <Td>{labelForSchool(r.schoolCategory)}</Td>
              <td className="px-3 py-2 align-middle text-end">
                <button
                  type="button"
                  aria-label="حذف القاعدة"
                  onClick={() => onDelete(r.id)}
                  className="inline-flex items-center justify-center rounded-md p-1.5 text-ink-500 transition-colors hover:bg-terra-50 hover:text-terra-700 focus-visible:shadow-focus-teal focus-visible:outline-none"
                >
                  <Trash2 size={14} strokeWidth={1.75} aria-hidden />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <th className="px-3 py-2 text-start font-ar text-2xs font-medium text-ink-600">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <td className="px-3 py-2 align-middle font-ar text-2xs text-ink-900">
      {children}
    </td>
  );
}
