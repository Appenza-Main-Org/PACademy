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

import { useMemo, useRef, useState } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import {
  Button,
  Card,
  DatePicker,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  MultiSelect,
  SearchSelect,
  toast,
  Tooltip,
  TooltipProvider,
} from '@/shared/components';
import type { SearchSelectOption } from '@/shared/components';
import { useLookup } from '@/features/lookups';
import { date as fmtDate, num } from '@/shared/lib/format';
import { toEasternArabicNumerals } from '@/shared/lib/arabic';
import {
  useAdmissionSetupWizardStore,
  type LocalThanawiRow,
  type ThanawiRuleRowInput,
} from '../../store/wizardSharedState';

const EMPTY_INPUT: ThanawiRuleRowInput = {
  examRound: '',
  committee: '',
  graduationYear: null,
  schoolCategories: [],
  scoreMin: null,
  scoreMax: null,
};

/** Inclusive percentage bounds for the score range — bounded by the
 *  admission test grading convention (0–100). */
const SCORE_MIN_BOUND = 0;
const SCORE_MAX_BOUND = 100;

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
  const graduationYearsQuery = useLookup('graduation-years');

  const approve = useAdmissionSetupWizardStore((s) => s.approveLocalForCategory);
  const localCount = useAdmissionSetupWizardStore(
    (s) => s.local.filter((r) => r.categoryCode === categoryCode).length,
  );

  const isLoading =
    maritalQuery.isLoading ||
    examRoundsQuery.isLoading ||
    committeesQuery.isLoading ||
    schoolCategoriesQuery.isLoading ||
    graduationYearsQuery.isLoading;

  const isError =
    maritalQuery.isError ||
    examRoundsQuery.isError ||
    committeesQuery.isError ||
    schoolCategoriesQuery.isError ||
    graduationYearsQuery.isError;

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

  /** Graduation-year options come from the `graduation-years` admin
   *  lookup. Active rows only; newest year first. Label is the raw
   *  Latin-numeral year (per the operator request) — Eastern-Arabic
   *  numerals are reserved for downstream summary rendering. */
  const graduationYearOptions = useMemo<SearchSelectOption[]>(
    () =>
      (graduationYearsQuery.data ?? [])
        .filter((g) => g.isActive)
        .slice()
        .sort((a, b) => b.year - a.year)
        .map((g) => ({ value: String(g.year), label: String(g.year) })),
    [graduationYearsQuery.data],
  );

  const handleApprove = (): void => {
    const moved = approve(categoryCode);
    if (moved === 0) {
      toast('لا توجد شروط جاهزة للاعتماد', 'info');
      return;
    }
    toast(`تم اعتماد ${num(moved)} شرط ونقلها إلى تبويب «العرض»`, 'success');
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
          graduationYearsQuery.refetch();
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
            عيّن نطاق التقديم، الحالة الاجتماعية، وشروط لجان قبول الثانوية العامة.
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
            maritalOptions={maritalOptions}
            graduationYearOptions={graduationYearOptions}
          />
        )}
      </div>

      <div className="mt-5 flex items-center justify-end gap-3 border-t border-border-subtle pt-4">
        {localCount > 0 && (
          <span className="font-ar text-xs text-ink-500">
            {`${num(localCount)} شرط جاهز للاعتماد`}
          </span>
        )}
        <Button
          variant="primary"
          size="md"
          onClick={handleApprove}
          disabled={localCount === 0}
        >
          اعتماد الفئة
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
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
      <FieldLabel label="بداية التقديم" required>
        <DatePicker
          value={isoToDate(header.applicationStart)}
          onChange={(d) =>
            setHeaderField(categoryCode, 'applicationStart', dateToIso(d))
          }
          placeholder="اختر اليوم…"
        />
      </FieldLabel>
      <FieldLabel label="نهاية التقديم" required>
        <DatePicker
          value={isoToDate(header.applicationEnd)}
          onChange={(d) =>
            setHeaderField(categoryCode, 'applicationEnd', dateToIso(d))
          }
          placeholder="اختر اليوم…"
        />
      </FieldLabel>
      <FieldLabel label="تاريخ احتساب السن" required>
        <DatePicker
          value={isoToDate(header.ageReferenceDate)}
          onChange={(d) =>
            setHeaderField(categoryCode, 'ageReferenceDate', dateToIso(d))
          }
          placeholder="اختر اليوم…"
        />
      </FieldLabel>
      <FieldLabel label="الحالة الاجتماعية" required>
        <MultiSelect
          ariaLabel="الحالة الاجتماعية"
          value={header.maritalStatus}
          onChange={(next) => setHeaderField(categoryCode, 'maritalStatus', next)}
          options={maritalOptions}
          placeholder="اختر الحالة الاجتماعية…"
        />
      </FieldLabel>
      <MaxAgeField categoryCode={categoryCode} maxAge={header.maxAge} />
    </div>
  );
}

/* ── Max-age field ────────────────────────────────────────────────── */

/** Category-level «الحد الأقصى للسن» input.
 *
 *  Positive integer only. Empty allowed. `0`, negatives, decimals, and
 *  non-numerics are stripped at the keystroke + change boundary; on
 *  blur we surface the contract-required error message if the value
 *  somehow slipped through (e.g. devtools). */
interface MaxAgeFieldProps {
  categoryCode: string;
  maxAge: number | null;
}

function MaxAgeField({ categoryCode, maxAge }: MaxAgeFieldProps): JSX.Element {
  const setHeaderField = useAdmissionSetupWizardStore((s) => s.setHeaderField);
  const [touched, setTouched] = useState(false);

  const display = maxAge === null ? '' : String(maxAge);
  const isInvalid =
    touched && maxAge !== null && (!Number.isInteger(maxAge) || maxAge < 1);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
    setHeaderField(
      categoryCode,
      'maxAge',
      digits === '' ? null : Number(digits),
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (['-', '+', '.', ',', 'e', 'E'].includes(e.key)) {
      e.preventDefault();
    }
  };

  return (
    <FieldLabel label="الحد الأقصى للسن" required>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          value={display}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => setTouched(true)}
          aria-label="الحد الأقصى للسن"
          placeholder="—"
          containerClassName="flex-1"
          className="[appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
          error={isInvalid ? 'يجب أن يكون رقمًا موجبًا' : undefined}
        />
        <span
          aria-hidden
          className="shrink-0 font-ar text-xs text-ink-600"
        >
          سنة
        </span>
      </div>
    </FieldLabel>
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
  required?: boolean;
}

function FieldLabel({
  label,
  children,
  required = false,
}: FieldLabelProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-ar text-xs font-medium text-ink-700">
        {label}
        {required && (
          <span aria-hidden className="ms-1 text-terra-600">
            *
          </span>
        )}
      </span>
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
  maritalOptions: ReadonlyArray<{ value: string; label: string }>;
  graduationYearOptions: ReadonlyArray<SearchSelectOption>;
}

function rowToThanawiInput(r: LocalThanawiRow): ThanawiRuleRowInput {
  return {
    examRound: r.examRound,
    committee: r.committee,
    graduationYear: r.graduationYear,
    schoolCategories: [...r.schoolCategories],
    scoreMin: r.scoreMin,
    scoreMax: r.scoreMax,
  };
}

function ThanawiForm({
  categoryCode,
  examRoundOptions,
  committeeOptions,
  schoolCategoryOptions,
  maritalOptions,
  graduationYearOptions,
}: ThanawiFormProps): JSX.Element {
  const [draft, setDraft] = useState<ThanawiRuleRowInput>(EMPTY_INPUT);
  const formRef = useRef<HTMLDivElement>(null);

  const header = useAdmissionSetupWizardStore(
    (s) => s.headers[categoryCode] ?? s.getHeader(categoryCode),
  );
  const isHeaderComplete =
    header.applicationStart !== '' &&
    header.applicationEnd !== '' &&
    header.ageReferenceDate !== '' &&
    header.maritalStatus.length > 0 &&
    header.maxAge !== null;

  const addThanawiRow = useAdmissionSetupWizardStore((s) => s.addThanawiRow);
  const updateThanawiRow = useAdmissionSetupWizardStore((s) => s.updateThanawiRow);
  const removeLocalRow = useAdmissionSetupWizardStore((s) => s.removeLocalRow);
  const removeApprovedRow = useAdmissionSetupWizardStore(
    (s) => s.removeApprovedRow,
  );
  const setEditingRow = useAdmissionSetupWizardStore((s) => s.setEditingRow);
  const clearEditingRow = useAdmissionSetupWizardStore((s) => s.clearEditingRow);
  /* Read both buckets so authored rows stay visible after the
   * section-level «اعتماد» button promotes them to `approved` — without
   * this the grid would go empty even though the data is still in the
   * store (and the category badge would still read «مكتمل»). */
  const localRows = useAdmissionSetupWizardStore((s) => s.local);
  const approvedRows = useAdmissionSetupWizardStore((s) => s.approved);
  const rows = useMemo(
    () =>
      [...localRows, ...approvedRows].filter(
        (r): r is LocalThanawiRow =>
          r.kind === 'thanawi' && r.categoryCode === categoryCode,
      ),
    [localRows, approvedRows, categoryCode],
  );
  const handleDelete = (id: string): void => {
    removeLocalRow(id);
    removeApprovedRow(id);
  };

  /** The row currently being edited, scoped to *this* form: must be a
   *  thanawi row under the same applicant-category. Editing a row in
   *  another section transparently drops this form back into add-mode. */
  const editingRow = useAdmissionSetupWizardStore((s) => {
    if (s.editingRowId === null) return null;
    const r =
      s.local.find((x) => x.id === s.editingRowId) ??
      s.approved.find((x) => x.id === s.editingRowId);
    if (!r || r.kind !== 'thanawi' || r.categoryCode !== categoryCode) {
      return null;
    }
    return r;
  });
  const editingId = editingRow?.id ?? null;
  const isEditing = editingRow !== null;

  /** State derivation: when `editingId` changes (entering edit mode,
   *  switching rows, or cancelling), reset the local draft to the
   *  appropriate input shape. Uses the React docs' "adjust state during
   *  render" pattern via a tracking ref to avoid a useEffect sync. */
  const lastEditingIdRef = useRef<string | null>(null);
  if (lastEditingIdRef.current !== editingId) {
    lastEditingIdRef.current = editingId;
    setDraft(editingRow ? rowToThanawiInput(editingRow) : EMPTY_INPUT);
  }

  const scoreMinOutOfBounds =
    draft.scoreMin !== null &&
    (draft.scoreMin < SCORE_MIN_BOUND || draft.scoreMin > SCORE_MAX_BOUND);

  const scoreMaxOutOfBounds =
    draft.scoreMax !== null &&
    (draft.scoreMax < SCORE_MIN_BOUND || draft.scoreMax > SCORE_MAX_BOUND);

  const scoreOrderInvalid =
    draft.scoreMin !== null &&
    draft.scoreMax !== null &&
    draft.scoreMax < draft.scoreMin;

  const canSubmit =
    isHeaderComplete &&
    draft.examRound.length > 0 &&
    draft.committee.length > 0 &&
    draft.graduationYear !== null &&
    draft.schoolCategories.length > 0 &&
    draft.scoreMin !== null &&
    draft.scoreMax !== null &&
    !scoreMinOutOfBounds &&
    !scoreMaxOutOfBounds &&
    !scoreOrderInvalid;

  const handleSubmit = (): void => {
    if (!canSubmit) return;
    if (isEditing && editingId !== null) {
      const result = updateThanawiRow(editingId, draft);
      if (!result.ok) {
        toast(
          result.reason === 'duplicate'
            ? 'هذا الشرط موجود بالفعل في الجدول'
            : 'تعذر تعديل الشرط',
          'danger',
        );
        return;
      }
      setDraft(EMPTY_INPUT);
      toast('تم تعديل الشرط', 'success');
      return;
    }
    const result = addThanawiRow(categoryCode, draft);
    if (!result.ok) {
      toast('هذا الشرط موجود بالفعل في الجدول', 'danger');
      return;
    }
    setDraft(EMPTY_INPUT);
    toast('تمت إضافة الشرط محلياً', 'success');
  };

  const handleCancelEdit = (): void => {
    clearEditingRow();
  };

  const handleEdit = (id: string): void => {
    setEditingRow(id);
    /* Defer scroll so the layout has reflowed with edit-mode chrome
     * (cancel button) before we measure scroll position. */
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Card variant="compact" ref={formRef}>
        <header className="mb-3 flex items-center justify-between gap-3">
          <h4 className="font-ar text-sm font-semibold text-ink-900">
            {isEditing ? 'تعديل شرط اللجنة' : 'شروط اللجنة'}
          </h4>
        </header>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <FieldLabel label="الدور" required>
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
          <FieldLabel label="اللجنة" required>
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
          <FieldLabel label="سنة التخرج" required>
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
              options={graduationYearOptions}
              placeholder="اختر السنة…"
            />
          </FieldLabel>
          <FieldLabel label="فئة المدرسة" required>
            <MultiSelect
              ariaLabel="فئة المدرسة"
              value={draft.schoolCategories}
              onChange={(next) =>
                setDraft((d) => ({ ...d, schoolCategories: next }))
              }
              options={schoolCategoryOptions.map((o) => ({
                value: o.value,
                label: o.label,
              }))}
              placeholder="اختر فئة المدرسة…"
            />
          </FieldLabel>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <FieldLabel label="الحد الأدنى للدرجة (٪)" required>
            <Input
              type="number"
              min={SCORE_MIN_BOUND}
              max={SCORE_MAX_BOUND}
              step="0.01"
              inputMode="decimal"
              placeholder="٠ – ١٠٠"
              value={draft.scoreMin ?? ''}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  scoreMin: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              error={
                scoreMinOutOfBounds
                  ? 'القيمة خارج النطاق ٠–١٠٠٪'
                  : undefined
              }
            />
          </FieldLabel>

          <FieldLabel label="الحد الأقصى للدرجة (٪)" required>
            <Input
              type="number"
              min={SCORE_MIN_BOUND}
              max={SCORE_MAX_BOUND}
              step="0.01"
              inputMode="decimal"
              placeholder="٠ – ١٠٠"
              value={draft.scoreMax ?? ''}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  scoreMax: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              error={
                scoreMaxOutOfBounds
                  ? 'القيمة خارج النطاق ٠–١٠٠٪'
                  : scoreOrderInvalid
                    ? 'يجب ألا تقل عن الحد الأدنى'
                    : undefined
              }
            />
          </FieldLabel>
        </div>

        <div className="mt-4 flex items-center justify-end gap-3">
          {!isHeaderComplete && (
            <span className="font-ar text-2xs text-terra-700">
              أكمل بيانات الفئة أولاً
            </span>
          )}
          {isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelEdit}
              leadingIcon={<X size={14} strokeWidth={1.75} aria-hidden />}
            >
              إلغاء
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isEditing ? 'تعديل' : 'إضافة'}
          </Button>
        </div>
      </Card>

      <ThanawiGrid
        rows={rows}
        editingId={editingId}
        examRoundOptions={examRoundOptions}
        committeeOptions={committeeOptions}
        schoolCategoryOptions={schoolCategoryOptions}
        maritalOptions={maritalOptions}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}

interface ThanawiGridProps {
  rows: LocalThanawiRow[];
  /** Row id currently in edit mode for this form (null = add mode). */
  editingId: string | null;
  examRoundOptions: ReadonlyArray<SearchSelectOption>;
  committeeOptions: ReadonlyArray<SearchSelectOption>;
  schoolCategoryOptions: ReadonlyArray<SearchSelectOption>;
  maritalOptions: ReadonlyArray<{ value: string; label: string }>;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function ThanawiGrid({
  rows,
  editingId,
  examRoundOptions,
  committeeOptions,
  schoolCategoryOptions,
  maritalOptions,
  onEdit,
  onDelete,
}: ThanawiGridProps): JSX.Element {
  const labelForRound = (v: string): string =>
    examRoundOptions.find((o) => o.value === v)?.label ?? v;
  const labelForCommittee = (v: string): string =>
    committeeOptions.find((o) => o.value === v)?.label ?? v;
  const labelForSchool = (v: string): string =>
    schoolCategoryOptions.find((o) => o.value === v)?.label ?? v;
  const labelForMarital = (v: string): string =>
    maritalOptions.find((o) => o.value === v)?.label ?? v;

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border-subtle bg-ink-50/40 px-3 py-3 text-2xs text-ink-500">
        لم تُضف شروط لجان بعد لهذه الفئة.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border-subtle bg-surface-card">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-ink-50/80">
          <tr>
            <Th>اللجنة</Th>
            <Th>بداية التقديم</Th>
            <Th>نهاية التقديم</Th>
            <Th>تاريخ احتساب السن</Th>
            <Th>الحالة الاجتماعية</Th>
            <Th>الدور</Th>
            <Th>سنة التخرج</Th>
            <Th>فئة المدرسة</Th>
            <Th>الحد الأدنى للدرجة</Th>
            <Th>الحد الأقصى للدرجة</Th>
            <Th>إجراءات</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isRowEditing = r.id === editingId;
            return (
              <tr
                key={r.id}
                className={`border-t border-border-subtle ${
                  isRowEditing ? 'bg-gold-50/60' : ''
                }`}
              >
                <Td>{labelForCommittee(r.committee)}</Td>
                <Td>{formatIsoDate(r.header.applicationStart)}</Td>
                <Td>{formatIsoDate(r.header.applicationEnd)}</Td>
                <Td>{formatIsoDate(r.header.ageReferenceDate)}</Td>
                <Td>
                  <MultiValueCell
                    values={r.maritalStatus.map(labelForMarital)}
                  />
                </Td>
                <Td>{labelForRound(r.examRound)}</Td>
                <Td>
                  {r.graduationYear !== null
                    ? toEasternArabicNumerals(r.graduationYear)
                    : '—'}
                </Td>
                <Td>
                  <MultiValueCell
                    values={r.schoolCategories.map(labelForSchool)}
                  />
                </Td>
                <Td>
                  {r.scoreMin !== null
                    ? `${toEasternArabicNumerals(r.scoreMin)}٪`
                    : '—'}
                </Td>
                <Td>
                  {r.scoreMax !== null
                    ? `${toEasternArabicNumerals(r.scoreMax)}٪`
                    : '—'}
                </Td>
                <td className="px-3 py-2 align-middle text-end">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="تعديل الشرط"
                      aria-pressed={isRowEditing}
                      onClick={() => onEdit(r.id)}
                      className="inline-flex items-center justify-center rounded-md p-1.5 text-ink-500 transition-colors hover:bg-teal-50 hover:text-teal-700 focus-visible:shadow-focus-teal focus-visible:outline-none aria-pressed:bg-teal-50 aria-pressed:text-teal-700"
                    >
                      <Pencil size={14} strokeWidth={1.75} aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label="حذف الشرط"
                      onClick={() => onDelete(r.id)}
                      className="inline-flex items-center justify-center rounded-md p-1.5 text-ink-500 transition-colors hover:bg-terra-50 hover:text-terra-700 focus-visible:shadow-focus-teal focus-visible:outline-none"
                    >
                      <Trash2 size={14} strokeWidth={1.75} aria-hidden />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatIsoDate(value: string): string {
  if (!value) return '—';
  return fmtDate(value, 'full');
}

function Th({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <th className="whitespace-nowrap px-3 py-2 text-start font-ar text-2xs font-medium text-ink-600">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <td className="max-w-[12rem] px-3 py-2 align-middle font-ar text-2xs text-ink-900">
      {children}
    </td>
  );
}

/** Renders a list of resolved labels as a comma-separated string that
 *  truncates with ellipsis when it overflows the parent cell. The full
 *  list always sits behind a Radix Tooltip so callers can recover the
 *  truncated portion via hover or keyboard focus. Self-mounts its own
 *  `TooltipProvider` because the wizard shell does not provide one. */
function MultiValueCell({ values }: { values: readonly string[] }): JSX.Element {
  if (values.length === 0) return <>—</>;
  const text = values.join('، ');
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip content={text} delayDuration={120}>
        <span
          tabIndex={0}
          className="block max-w-full truncate focus-visible:outline-none focus-visible:shadow-focus-teal"
        >
          {text}
        </span>
      </Tooltip>
    </TooltipProvider>
  );
}
