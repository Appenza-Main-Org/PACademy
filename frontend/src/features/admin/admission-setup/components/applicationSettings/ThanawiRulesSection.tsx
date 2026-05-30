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
  ErrorState,
  Input,
  LoadingState,
  MultiSelect,
  SearchSelect,
  toast,
  Tooltip,
  TooltipProvider,
} from '@/shared/components';
import type { RadixSelectOption, SearchSelectOption } from '@/shared/components';
import { useLookup } from '@/features/lookups';
import { date as fmtDate, num } from '@/shared/lib/format';
import { toEasternArabicNumerals } from '@/shared/lib/arabic';
import type { ExcellenceMode } from '../../lib/excellenceMode';
import { useAdmissionSetupCanWrite } from '../AdmissionSetupShell';
import { applicationSettingsQueryOptions } from '../../api/applicationSettings.queries';
import {
  DEFAULT_MAX_SCORE_OPERATOR,
  DEFAULT_MIN_SCORE_OPERATOR,
  useAdmissionSetupWizardStore,
  type LocalThanawiRow,
  type MaxScoreOperator,
  type MinScoreOperator,
  type ThanawiRuleRowInput,
} from '../../store/wizardSharedState';
import { ExcellenceModeToggle } from './ExcellenceModeToggle';
import { OperatorScoreField } from './OperatorScoreField';

const EMPTY_INPUT: ThanawiRuleRowInput = {
  excellenceMode: 'GRADES',
  examRound: '',
  committee: '',
  graduationYear: null,
  schoolCategories: [],
  grade: '',
  gradeMax: '',
  scoreMin: null,
  minScoreOperator: DEFAULT_MIN_SCORE_OPERATOR,
  scoreMax: null,
  maxScoreOperator: DEFAULT_MAX_SCORE_OPERATOR,
};

function emptyInputFor(excellenceMode: ExcellenceMode | null): ThanawiRuleRowInput {
  return { ...EMPTY_INPUT, excellenceMode: excellenceMode ?? 'GRADES' };
}

/** Lower bound for both inputs — "positive numbers only".
 *  The min field has an upper bound at 100 (percentage convention).
 *  The max field has no upper bound and may exceed 100. */
const SCORE_MIN_BOUND = 0;
/** Upper bound for the «الحد الأدنى للدرجة» input only. */
const MIN_SCORE_UPPER_BOUND = 100;

/** Comparison-operator options for the lower percentage-score bound. */
const MIN_SCORE_OPERATOR_OPTIONS: ReadonlyArray<RadixSelectOption<MinScoreOperator>> = [
  { value: 'GREATER_THAN_OR_EQUAL', label: 'أكبر من أو يساوي' },
  { value: 'GREATER_THAN', label: 'أكبر من' },
];

/** Comparison-operator options for the upper percentage-score bound. */
const MAX_SCORE_OPERATOR_OPTIONS: ReadonlyArray<RadixSelectOption<MaxScoreOperator>> = [
  { value: 'LESS_THAN_OR_EQUAL', label: 'أقل من أو يساوي' },
  { value: 'LESS_THAN', label: 'أقل من' },
];

/** Short symbolic labels for inline rendering in approved-rules grids. */
const MIN_OPERATOR_SYMBOL: Record<MinScoreOperator, string> = {
  GREATER_THAN_OR_EQUAL: '≥',
  GREATER_THAN: '>',
};
const MAX_OPERATOR_SYMBOL: Record<MaxScoreOperator, string> = {
  LESS_THAN_OR_EQUAL: '≤',
  LESS_THAN: '<',
};

interface ThanawiRulesSectionProps {
  categoryCode: string;
  /** Resolved «معيار التمييز» — `TAGDIR` shows only الحد الأدنى/الأقصى
   *  للتقدير, `GRADES` shows only الحد الأدنى/الأقصى للدرجة (٪). `null`
   *  (criterion not picked) renders both pairs. */
  excellenceMode: ExcellenceMode | null;
}

export function ThanawiRulesSection({
  categoryCode,
  excellenceMode,
}: ThanawiRulesSectionProps): JSX.Element {
  const maritalQuery = useLookup('marital-statuses', applicationSettingsQueryOptions);
  const examRoundsQuery = useLookup('exam-rounds', applicationSettingsQueryOptions);
  const committeesQuery = useLookup('committees', applicationSettingsQueryOptions);
  const schoolCategoriesQuery = useLookup('school-categories', applicationSettingsQueryOptions);
  const graduationYearsQuery = useLookup('graduation-years', applicationSettingsQueryOptions);
  const gradesQuery = useLookup('academic-grades', applicationSettingsQueryOptions);
  const canWrite = useAdmissionSetupCanWrite();

  const approve = useAdmissionSetupWizardStore((s) => s.approveLocalForCategory);
  const localCount = useAdmissionSetupWizardStore(
    (s) => s.local.filter((r) => r.categoryCode === categoryCode).length,
  );

  const isLoading =
    maritalQuery.isLoading ||
    examRoundsQuery.isLoading ||
    committeesQuery.isLoading ||
    schoolCategoriesQuery.isLoading ||
    graduationYearsQuery.isLoading ||
    gradesQuery.isLoading;

  const isError =
    maritalQuery.isError ||
    examRoundsQuery.isError ||
    committeesQuery.isError ||
    schoolCategoriesQuery.isError ||
    graduationYearsQuery.isError ||
    gradesQuery.isError;

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

  const gradeOptions = useMemo<SearchSelectOption[]>(
    () =>
      (gradesQuery.data ?? [])
        .filter((g) => g.isActive)
        .map((g) => ({ value: g.code, label: g.name })),
    [gradesQuery.data],
  );

  const gradeRank = useMemo(() => {
    const map = new Map<string, number>();
    (gradesQuery.data ?? []).forEach((g, i) => map.set(g.code, i));
    return map;
  }, [gradesQuery.data]);

  const handleApprove = (): void => {
    if (!canWrite) return;
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
          gradesQuery.refetch();
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
        canWrite={canWrite}
      />

      <div className="mt-4">
        <ThanawiForm
          categoryCode={categoryCode}
          examRoundOptions={examRoundOptions}
          committeeOptions={committeeOptions}
          schoolCategoryOptions={schoolCategoryOptions}
          maritalOptions={maritalOptions}
          graduationYearOptions={graduationYearOptions}
          gradeOptions={gradeOptions}
          gradeRank={gradeRank}
          excellenceMode={excellenceMode}
          canWrite={canWrite}
        />
      </div>

      <div className="mt-5 flex items-center justify-end gap-3 border-t border-border-subtle pt-4">
        <Button
          variant="primary"
          size="md"
          onClick={handleApprove}
          disabled={!canWrite || localCount === 0}
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
  canWrite: boolean;
}

function ThanawiTopFields({
  categoryCode,
  maritalOptions,
  canWrite,
}: ThanawiTopFieldsProps): JSX.Element {
  const header = useAdmissionSetupWizardStore(
    (s) => s.headers[categoryCode] ?? s.getHeader(categoryCode),
  );
  const setHeaderField = useAdmissionSetupWizardStore((s) => s.setHeaderField);

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(260px,2fr)]">
      <FieldGroup title="نطاق التقديم">
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-3">
          <FieldLabel label="بداية التقديم" required>
            <DatePicker
              value={isoToDate(header.applicationStart)}
              onChange={(d) =>
                setHeaderField(categoryCode, 'applicationStart', dateToIso(d))
              }
              disabled={!canWrite}
              placeholder="اختر اليوم…"
            />
          </FieldLabel>
          <FieldLabel label="نهاية التقديم" required>
            <DatePicker
              value={isoToDate(header.applicationEnd)}
              onChange={(d) =>
                setHeaderField(categoryCode, 'applicationEnd', dateToIso(d))
              }
              disabled={!canWrite}
              placeholder="اختر اليوم…"
            />
          </FieldLabel>
          <FieldLabel label="تاريخ احتساب السن" required>
            <DatePicker
              value={isoToDate(header.ageReferenceDate)}
              onChange={(d) =>
                setHeaderField(categoryCode, 'ageReferenceDate', dateToIso(d))
              }
              disabled={!canWrite}
              placeholder="اختر اليوم…"
            />
          </FieldLabel>
        </div>
      </FieldGroup>
      <FieldGroup title="شروط الأهلية">
        <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <FieldLabel label="الحالة الاجتماعية" required>
            <MultiSelect
              ariaLabel="الحالة الاجتماعية"
              value={header.maritalStatus}
              onChange={(next) => setHeaderField(categoryCode, 'maritalStatus', next)}
              options={maritalOptions}
              disabled={!canWrite}
              placeholder="اختر الحالة الاجتماعية…"
            />
          </FieldLabel>
          <MaxAgeField categoryCode={categoryCode} maxAge={header.maxAge} canWrite={canWrite} />
        </div>
      </FieldGroup>
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
  canWrite: boolean;
}

function MaxAgeField({ categoryCode, maxAge, canWrite }: MaxAgeFieldProps): JSX.Element {
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
          disabled={!canWrite}
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

interface FieldGroupProps {
  title: string;
  children: React.ReactNode;
}

function FieldGroup({ title, children }: FieldGroupProps): JSX.Element {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-card p-3">
      <h5 className="m-0 mb-3 font-ar text-xs font-semibold text-ink-800">
        {title}
      </h5>
      {children}
    </div>
  );
}

function FieldLabel({
  label,
  children,
  required = false,
}: FieldLabelProps): JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="flex min-h-5 items-start font-ar text-xs font-medium leading-5 text-ink-700">
        {label}
        {required && (
          <span aria-hidden className="ms-1 shrink-0 text-terra-600">
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
  gradeOptions: ReadonlyArray<SearchSelectOption>;
  gradeRank: Map<string, number>;
  excellenceMode: ExcellenceMode | null;
  canWrite: boolean;
}

function rowToThanawiInput(r: LocalThanawiRow): ThanawiRuleRowInput {
  return {
    excellenceMode: r.excellenceMode ?? (r.grade ? 'TAGDIR' : 'GRADES'),
    examRound: r.examRound,
    committee: r.committee,
    graduationYear: r.graduationYear,
    schoolCategories: [...r.schoolCategories],
    grade: r.grade,
    gradeMax: r.gradeMax,
    scoreMin: r.scoreMin,
    /* Defensive fallback for legacy rows authored before operator fields
     * existed on the row shape — defaults to the inclusive (`≥`/`≤`)
     * behaviour the bare numeric bounds historically implied. */
    minScoreOperator: r.minScoreOperator ?? DEFAULT_MIN_SCORE_OPERATOR,
    scoreMax: r.scoreMax,
    maxScoreOperator: r.maxScoreOperator ?? DEFAULT_MAX_SCORE_OPERATOR,
  };
}

function ThanawiForm({
  categoryCode,
  examRoundOptions,
  committeeOptions,
  schoolCategoryOptions,
  maritalOptions,
  graduationYearOptions,
  gradeOptions,
  gradeRank,
  excellenceMode,
  canWrite,
}: ThanawiFormProps): JSX.Element {
  const defaultExcellenceMode = excellenceMode ?? 'GRADES';
  const [draft, setDraft] = useState<ThanawiRuleRowInput>(() =>
    emptyInputFor(defaultExcellenceMode),
  );
  const [formResetKey, setFormResetKey] = useState(0);
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
    if (!canWrite) return;
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
    setDraft(editingRow ? rowToThanawiInput(editingRow) : emptyInputFor(defaultExcellenceMode));
  }
  const lastDefaultModeRef = useRef<ExcellenceMode>(defaultExcellenceMode);
  if (!isEditing && lastDefaultModeRef.current !== defaultExcellenceMode) {
    lastDefaultModeRef.current = defaultExcellenceMode;
    setDraft(emptyInputFor(defaultExcellenceMode));
  }
  const showGradePair = draft.excellenceMode === 'TAGDIR';
  const showScorePair = draft.excellenceMode === 'GRADES';

  /* OperatorScoreField clamps to [0, maxBound] on blur, but we still
   *  guard the submit gate so a focus-stolen blur or paste-then-submit
   *  can't sneak an out-of-range value past. Max has no upper bound;
   *  only enforce the lower 0. */
  const scoreMinOutOfBounds =
    draft.scoreMin !== null &&
    (draft.scoreMin < SCORE_MIN_BOUND || draft.scoreMin > MIN_SCORE_UPPER_BOUND);

  const scoreMaxOutOfBounds =
    draft.scoreMax !== null && draft.scoreMax < SCORE_MIN_BOUND;

  const [scoreMinMessage, setScoreMinMessage] = useState<string | null>(null);
  const [scoreMaxMessage, setScoreMaxMessage] = useState<string | null>(null);

  const scoreOrderInvalid =
    draft.scoreMin !== null &&
    draft.scoreMax !== null &&
    draft.scoreMax < draft.scoreMin;

  /* `gradeRank` reflects the academic-grades lookup order, which is
   * authored best→worst (امتياز=0 … مقبول=N). So a higher rank index
   * means a *worse* grade. The max bound must not be a worse grade
   * than the min bound, i.e. invalid when `max-rank > min-rank`. */
  const gradeOrderInvalid =
    draft.grade !== '' &&
    draft.gradeMax !== '' &&
    (gradeRank.get(draft.gradeMax) ?? -Infinity) >
      (gradeRank.get(draft.grade) ?? Infinity);

  const gradePairOk = showGradePair
    ? draft.grade.length > 0 && draft.gradeMax.length > 0 && !gradeOrderInvalid
    : true;
  const scorePairOk = showScorePair
    ? draft.scoreMin !== null &&
      draft.scoreMax !== null &&
      !scoreMinOutOfBounds &&
      !scoreMaxOutOfBounds &&
      !scoreOrderInvalid
    : true;

  const canSubmit =
    canWrite &&
    isHeaderComplete &&
    draft.examRound.length > 0 &&
    draft.committee.length > 0 &&
    draft.graduationYear !== null &&
    draft.schoolCategories.length > 0 &&
    gradePairOk &&
    scorePairOk;

  /** Blank-out fields that the active criterion hides so a row authored
   *  under one criterion doesn't carry orphan values if the admin switches
   *  later. */
  const normalizeForSubmit = (input: ThanawiRuleRowInput): ThanawiRuleRowInput => ({
    ...input,
    grade: showGradePair ? input.grade : '',
    gradeMax: showGradePair ? input.gradeMax : '',
    scoreMin: showScorePair ? input.scoreMin : null,
    scoreMax: showScorePair ? input.scoreMax : null,
  });

  const resetForm = (): void => {
    setDraft(emptyInputFor(defaultExcellenceMode));
    setScoreMinMessage(null);
    setScoreMaxMessage(null);
    setFormResetKey((key) => key + 1);
  };

  const handleSubmit = (): void => {
    if (!canWrite || !canSubmit) return;
    const payload = normalizeForSubmit(draft);
    if (isEditing && editingId !== null) {
      const result = updateThanawiRow(editingId, payload);
      if (!result.ok) {
        toast(
          result.reason === 'duplicate'
            ? 'هذا الشرط موجود بالفعل في الجدول'
            : 'تعذر تعديل الشرط',
          'danger',
        );
        return;
      }
      setDraft(emptyInputFor(defaultExcellenceMode));
      toast('تم تعديل الشرط', 'success');
      return;
    }
    const result = addThanawiRow(categoryCode, payload);
    if (!result.ok) {
      toast('هذا الشرط موجود بالفعل في الجدول', 'danger');
      return;
    }
    resetForm();
    toast('تمت إضافة الشرط محلياً', 'success');
  };

  const handleCancelEdit = (): void => {
    clearEditingRow();
  };

  const handleEdit = (id: string): void => {
    if (!canWrite) return;
    setEditingRow(id);
    /* Defer scroll so the layout has reflowed with edit-mode chrome
     * (cancel button) before we measure scroll position. */
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Card key={formResetKey} variant="compact" ref={formRef}>
        <header className="mb-3 flex items-center justify-between gap-3">
          <h4 className="font-ar text-sm font-semibold text-ink-900">
            {isEditing ? 'تعديل شرط اللجنة' : 'شروط اللجنة'}
          </h4>
        </header>

        <div className="mb-3 rounded-md border border-border-subtle bg-ink-50/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="font-ar text-xs font-medium text-ink-700">
                معيار التمييز
              </span>
              <p className="m-0 mt-0.5 font-ar text-2xs text-ink-500">
                القيمة الافتراضية مأخوذة من إعداد الفئة، ويمكن تعديلها لهذا الشرط.
              </p>
            </div>
            <ExcellenceModeToggle
              value={draft.excellenceMode}
              disabled={!canWrite}
              onChange={(next) =>
                setDraft((d) => ({
                  ...d,
                  excellenceMode: next,
                  grade: next === 'TAGDIR' ? d.grade : '',
                  gradeMax: next === 'TAGDIR' ? d.gradeMax : '',
                  scoreMin: next === 'GRADES' ? d.scoreMin : null,
                  scoreMax: next === 'GRADES' ? d.scoreMax : null,
                }))
              }
            />
          </div>
        </div>

        <FieldGroup title="بيانات اللجنة والمدرسة">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <FieldLabel label="الدور" required>
              <SearchSelect
                ariaLabel="الدور"
                value={draft.examRound || null}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, examRound: v ?? '' }))
                }
                options={examRoundOptions}
                disabled={!canWrite}
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
                disabled={!canWrite}
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
                disabled={!canWrite}
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
                disabled={!canWrite}
                placeholder="اختر فئة المدرسة…"
              />
            </FieldLabel>
          </div>
        </FieldGroup>

        <div className="mt-3">
          <FieldGroup title="حدود التمييز">
            {showGradePair && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FieldLabel label="الحد الأدنى للتقدير" required>
                  <SearchSelect
                    ariaLabel="الحد الأدنى للتقدير"
                    value={draft.grade || null}
                    onChange={(v) => setDraft((d) => ({ ...d, grade: v ?? '' }))}
                    options={gradeOptions}
                    disabled={!canWrite}
                    placeholder="اختر التقدير…"
                  />
                </FieldLabel>

                <FieldLabel label="الحد الأقصى للتقدير" required>
                  <SearchSelect
                    ariaLabel="الحد الأقصى للتقدير"
                    value={draft.gradeMax || null}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, gradeMax: v ?? '' }))
                    }
                    options={gradeOptions}
                    disabled={!canWrite}
                    placeholder="اختر التقدير…"
                    invalid={gradeOrderInvalid}
                  />
                  {gradeOrderInvalid && (
                    <span className="font-ar text-2xs text-terra-700">
                      يجب ألا يقل الحد الأقصى عن الحد الأدنى للتقدير.
                    </span>
                  )}
                </FieldLabel>
              </div>
            )}

            {showScorePair && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FieldLabel label="الحد الأدنى للدرجة (٪)" required>
                  <OperatorScoreField<MinScoreOperator>
                    operatorValue={draft.minScoreOperator}
                    onOperatorChange={(v) =>
                      setDraft((d) => ({ ...d, minScoreOperator: v }))
                    }
                    operatorOptions={MIN_SCORE_OPERATOR_OPTIONS}
                    operatorAriaLabel="عملية المقارنة للحد الأدنى للدرجة"
                    scoreValue={draft.scoreMin}
                    disabled={!canWrite}
                    onScoreChange={(next) =>
                      setDraft((d) => ({ ...d, scoreMin: next }))
                    }
                    scoreAriaLabel="الحد الأدنى للدرجة بالنسبة المئوية"
                    invalid={scoreMinOutOfBounds || scoreMinMessage !== null}
                    maxBound={MIN_SCORE_UPPER_BOUND}
                    onClampMessage={setScoreMinMessage}
                  />
                  {scoreMinMessage && (
                    <span className="font-ar text-2xs text-terra-700">
                      {scoreMinMessage}
                    </span>
                  )}
                </FieldLabel>

                <FieldLabel label="الحد الأقصى للدرجة (٪)" required>
                  <OperatorScoreField<MaxScoreOperator>
                    operatorValue={draft.maxScoreOperator}
                    onOperatorChange={(v) =>
                      setDraft((d) => ({ ...d, maxScoreOperator: v }))
                    }
                    operatorOptions={MAX_SCORE_OPERATOR_OPTIONS}
                    operatorAriaLabel="عملية المقارنة للحد الأقصى للدرجة"
                    scoreValue={draft.scoreMax}
                    disabled={!canWrite}
                    onScoreChange={(next) =>
                      setDraft((d) => ({ ...d, scoreMax: next }))
                    }
                    scoreAriaLabel="الحد الأقصى للدرجة بالنسبة المئوية"
                    invalid={
                      scoreMaxOutOfBounds || scoreOrderInvalid || scoreMaxMessage !== null
                    }
                    maxBound={null}
                    onClampMessage={setScoreMaxMessage}
                  />
                  {(scoreMaxMessage || scoreOrderInvalid) && (
                    <span className="font-ar text-2xs text-terra-700">
                      {scoreMaxMessage ?? 'يجب ألا تقل عن الحد الأدنى'}
                    </span>
                  )}
                </FieldLabel>
              </div>
            )}
          </FieldGroup>
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
              disabled={!canWrite}
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
        gradeOptions={gradeOptions}
        onEdit={handleEdit}
        onDelete={handleDelete}
        canWrite={canWrite}
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
  gradeOptions: ReadonlyArray<SearchSelectOption>;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  canWrite: boolean;
}

function ThanawiGrid({
  rows,
  editingId,
  examRoundOptions,
  committeeOptions,
  schoolCategoryOptions,
  maritalOptions,
  gradeOptions,
  onEdit,
  onDelete,
  canWrite,
}: ThanawiGridProps): JSX.Element {
  const labelForRound = (v: string): string =>
    examRoundOptions.find((o) => o.value === v)?.label ?? v;
  const labelForCommittee = (v: string): string =>
    committeeOptions.find((o) => o.value === v)?.label ?? v;
  const labelForSchool = (v: string): string =>
    schoolCategoryOptions.find((o) => o.value === v)?.label ?? v;
  const labelForMarital = (v: string): string =>
    maritalOptions.find((o) => o.value === v)?.label ?? v;
  const labelForGrade = (v: string): string =>
    gradeOptions.find((o) => o.value === v)?.label ?? v;
  const labelForExcellenceMode = (r: LocalThanawiRow): string =>
    (r.excellenceMode ?? (r.grade ? 'TAGDIR' : 'GRADES')) === 'TAGDIR'
      ? 'تقدير'
      : 'درجة';

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border-subtle bg-ink-50/40 px-3 py-3 text-2xs text-ink-500">
        لم تُضف شروط لجان بعد لهذه الفئة.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border-subtle bg-surface-card">
      <table className="min-w-[104rem] border-collapse text-sm">
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
            <Th>معيار التمييز</Th>
            <Th>الحد الأدنى للتقدير</Th>
            <Th>الحد الأقصى للتقدير</Th>
            <Th>الحد الأدنى للدرجة</Th>
            <Th>الحد الأقصى للدرجة</Th>
            {canWrite && <Th>إجراءات</Th>}
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
                <Td>{labelForExcellenceMode(r)}</Td>
                <Td>{r.grade ? labelForGrade(r.grade) : '—'}</Td>
                <Td>{r.gradeMax ? labelForGrade(r.gradeMax) : '—'}</Td>
                <Td>
                  {formatScore(
                    r.scoreMin,
                    r.minScoreOperator ?? DEFAULT_MIN_SCORE_OPERATOR,
                  )}
                </Td>
                <Td>
                  {formatScore(
                    r.scoreMax,
                    r.maxScoreOperator ?? DEFAULT_MAX_SCORE_OPERATOR,
                  )}
                </Td>
                {canWrite && (
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
                )}
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
    <td className="min-w-[7rem] max-w-[14rem] whitespace-normal break-words px-3 py-2 align-middle font-ar text-2xs leading-relaxed text-ink-900">
      {children}
    </td>
  );
}

function formatScore(
  value: number | null | undefined,
  operator: MinScoreOperator | MaxScoreOperator,
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const symbol =
    operator in MIN_OPERATOR_SYMBOL
      ? MIN_OPERATOR_SYMBOL[operator as MinScoreOperator]
      : MAX_OPERATOR_SYMBOL[operator as MaxScoreOperator];
  return `${symbol} ${toEasternArabicNumerals(value)}٪`;
}

/** Renders a list of resolved labels as a comma-separated string that
 *  wraps inside the parent cell. The full list also sits behind a Radix
 *  Tooltip for hover and keyboard focus. Self-mounts its own
 *  `TooltipProvider` because the wizard shell does not provide one. */
function MultiValueCell({ values }: { values: readonly string[] }): JSX.Element {
  if (values.length === 0) return <>—</>;
  const text = values.join('، ');
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip content={text} delayDuration={120}>
        <span
          tabIndex={0}
          className="block max-w-full whitespace-normal break-words leading-relaxed focus-visible:outline-none focus-visible:shadow-focus-teal"
        >
          {text}
        </span>
      </Tooltip>
    </TooltipProvider>
  );
}
