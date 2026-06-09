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
  sortGeneralRuleRowsNewestFirst,
  useAdmissionSetupWizardStore,
  type LocalThanawiRow,
  type MaxScoreOperator,
  type MinScoreOperator,
  type ThanawiRuleRowInput,
} from '../../store/wizardSharedState';
import {
  findCandidateThanawiOverlaps,
  findThanawiOverlaps,
  overlapsByRowId,
  OVERLAP_REASON_LABEL_AR,
  type OverlapPair,
  type OverlapReason,
} from '../../lib/ruleOverlapValidation';
import { cn } from '@/shared/lib/cn';
import {
  validateAgeReferenceVsApplication,
  validateApplicationDateRange,
} from '../../lib/appSettingsValidation';
import { ExcellenceModeToggle } from './ExcellenceModeToggle';
import { OperatorScoreField } from './OperatorScoreField';

const INVALID_DATE_RANGE_MESSAGE = 'يجب أن يكون تاريخ نهاية التقديم بعد تاريخ بداية التقديم.';
const AGE_REFERENCE_DATE_MESSAGE = 'يجب أن يكون تاريخ احتساب السن بعد تاريخ بداية التقديم.';

function headerDateMessage(header: {
  applicationStart: string;
  applicationEnd: string;
  ageReferenceDate: string;
}): string | null {
  if (
    validateApplicationDateRange(header.applicationStart, header.applicationEnd) ===
    'INVALID_DATE_RANGE'
  ) {
    return INVALID_DATE_RANGE_MESSAGE;
  }
  if (
    validateAgeReferenceVsApplication(header.ageReferenceDate, header.applicationStart) ===
    'AGE_REFERENCE_AFTER_START'
  ) {
    return AGE_REFERENCE_DATE_MESSAGE;
  }
  return null;
}

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
  /** Resolved single «معيار التمييز» when the category lookup allows
   *  exactly one mode. `null` means multiple or no modes are configured. */
  excellenceMode: ExcellenceMode | null;
  /** Modes allowed by Applicant Categories lookup. One entry locks the
   *  form to that criterion; two entries keep the selector available. */
  allowedExcellenceModes: readonly ExcellenceMode[];
}

export function ThanawiRulesSection({
  categoryCode,
  excellenceMode,
  allowedExcellenceModes,
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
  const header = useAdmissionSetupWizardStore(
    (s) => s.headers[categoryCode] ?? s.getHeader(categoryCode),
  );
  const headerDateError = headerDateMessage(header);

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
    if (headerDateError) {
      toast(headerDateError, 'danger');
      return;
    }
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
          allowedExcellenceModes={allowedExcellenceModes}
          canWrite={canWrite}
        />
      </div>

      <div className="mt-5 flex items-center justify-end gap-3 border-t border-border-subtle pt-4">
        <Button
          variant="primary"
          size="md"
          onClick={handleApprove}
          disabled={!canWrite || localCount === 0 || Boolean(headerDateError)}
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
  const dateError =
    validateApplicationDateRange(header.applicationStart, header.applicationEnd) ===
    'INVALID_DATE_RANGE'
      ? INVALID_DATE_RANGE_MESSAGE
      : null;

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
              min={todayDateOnly()}
              placeholder="اختر اليوم…"
            />
          </FieldLabel>
          <FieldLabel label="نهاية التقديم" required error={dateError}>
            <DatePicker
              value={isoToDate(header.applicationEnd)}
              onChange={(d) =>
                setHeaderField(categoryCode, 'applicationEnd', dateToIso(d))
              }
              disabled={!canWrite}
              min={nextDateOnly(header.applicationStart)}
              placeholder="اختر اليوم…"
            />
          </FieldLabel>
          <FieldLabel
            label="تاريخ احتساب السن"
            required
            error={headerDateMessage(header) === AGE_REFERENCE_DATE_MESSAGE ? AGE_REFERENCE_DATE_MESSAGE : null}
          >
            <DatePicker
              value={isoToDate(header.ageReferenceDate)}
              onChange={(d) =>
                setHeaderField(categoryCode, 'ageReferenceDate', dateToIso(d))
              }
              disabled={!canWrite}
              min={nextDateOnly(header.applicationStart)}
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
  /* Pull the category's reference `minAge` from the `applicant-categories`
   * lookup so we can block `maxAge < minAge` at the header level — the
   * reference codes are the source of truth for the floor. */
  const categoriesQuery = useLookup('applicant-categories', applicationSettingsQueryOptions);
  const minAge = useMemo(() => {
    const row = (categoriesQuery.data ?? []).find((r) => r.code === categoryCode);
    return row?.minAge ?? null;
  }, [categoriesQuery.data, categoryCode]);

  const display = maxAge === null ? '' : String(maxAge);
  const isPositiveInvalid =
    maxAge !== null && (!Number.isInteger(maxAge) || maxAge < 1);
  const isBelowReferenceMin =
    minAge !== null && maxAge !== null && Number.isInteger(maxAge) && maxAge >= 1 && maxAge < minAge;
  const errorMessage = isPositiveInvalid
    ? 'يجب أن يكون رقمًا موجبًا'
    : isBelowReferenceMin
      ? `يجب ألا يقل الحد الأقصى للسن عن الحد الأدنى المحدد في الأكواد المرجعية (${toEasternArabicNumerals(minAge ?? 0)} سنة)`
      : null;
  const showError = (touched || isBelowReferenceMin) && errorMessage !== null;

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
          error={showError ? errorMessage ?? undefined : undefined}
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

function todayDateOnly(): string {
  return dateToIso(new Date());
}

function nextDateOnly(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  date.setDate(date.getDate() + 1);
  return dateToIso(date);
}

interface FieldLabelProps {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  error?: string | null;
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
  error,
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
      {error && (
        <p className="m-0 font-ar text-2xs leading-5 text-terra-700">
          {error}
        </p>
      )}
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
  allowedExcellenceModes: readonly ExcellenceMode[];
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
  allowedExcellenceModes,
  canWrite,
}: ThanawiFormProps): JSX.Element {
  const defaultExcellenceMode = excellenceMode ?? allowedExcellenceModes[0] ?? 'GRADES';
  const allowedModeSet = useMemo(
    () => new Set(allowedExcellenceModes),
    [allowedExcellenceModes],
  );
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
    validateApplicationDateRange(header.applicationStart, header.applicationEnd) === null &&
    header.ageReferenceDate !== '' &&
    validateAgeReferenceVsApplication(header.ageReferenceDate, header.applicationStart) === null &&
    header.maritalStatus.length > 0 &&
    header.maxAge !== null;
  const headerDateError = headerDateMessage(header);

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
      sortGeneralRuleRowsNewestFirst(
        [...localRows, ...approvedRows].filter(
          (r): r is LocalThanawiRow =>
            r.kind === 'thanawi' && r.categoryCode === categoryCode,
        ),
      ),
    [localRows, approvedRows, categoryCode],
  );

  const overlapPairs = useMemo<OverlapPair[]>(
    () => findThanawiOverlaps(rows, gradeRank),
    [rows, gradeRank],
  );
  const overlapsById = useMemo(
    () => overlapsByRowId(overlapPairs),
    [overlapPairs],
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
  if (
    !isEditing &&
    allowedExcellenceModes.length > 0 &&
    !allowedModeSet.has(draft.excellenceMode)
  ) {
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
    if (!canWrite) return;
    if (headerDateError) {
      toast(headerDateError, 'danger');
      return;
    }
    if (!canSubmit) return;
    const payload = normalizeForSubmit(draft);
    if (isEditing && editingId !== null) {
      const overlap = previewThanawiOverlap(
        editingId,
        categoryCode,
        payload,
        rows,
        gradeRank,
        header,
      );
      if (overlap) {
        toast(thanawiOverlapMessage(overlap), 'danger');
        return;
      }
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
    const overlap = previewThanawiOverlap(
      null,
      categoryCode,
      payload,
      rows,
      gradeRank,
      header,
    );
    if (overlap) {
      toast(thanawiOverlapMessage(overlap), 'danger');
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
              allowedModes={allowedExcellenceModes}
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

      <ThanawiOverlapBanner
        pairs={overlapPairs}
        rows={rows}
        committeeOptions={committeeOptions}
      />
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
        overlapsById={overlapsById}
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
  /** Map of rowId → reasons it overlaps a sibling. Drives the per-row
   *  terra tint + «تداخل» badge in the «م» column. */
  overlapsById?: ReadonlyMap<string, ReadonlySet<OverlapReason>>;
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
  overlapsById,
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

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border-subtle bg-ink-50/40 px-3 py-3 text-2xs text-ink-500">
        لم تُضف شروط لجان بعد لهذه الفئة.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border-subtle bg-surface-card">
      <table className="min-w-[88rem] border-collapse text-sm">
        <thead className="bg-ink-50/80">
          <tr>
            <Th>م</Th>
            <Th>اللجنة</Th>
            <Th>بداية التقديم</Th>
            <Th>نهاية التقديم</Th>
            <Th>تاريخ احتساب السن</Th>
            <Th>الحالة الاجتماعية</Th>
            <Th>الدور</Th>
            <Th>سنة التخرج</Th>
            <Th>فئة المدرسة</Th>
            <Th>النطاق المسموح</Th>
            {canWrite && <Th>إجراءات</Th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, index) => {
            const isRowEditing = r.id === editingId;
            const rowOverlap = overlapsById?.get(r.id) ?? null;
            const isOverlapping = (rowOverlap?.size ?? 0) > 0;
            return (
              <tr
                key={r.id}
                className={cn(
                  'border-t border-border-subtle',
                  isRowEditing && 'bg-gold-50/60',
                  isOverlapping && !isRowEditing && 'bg-terra-50/60',
                )}
              >
                <Td>
                  <div className="flex items-center gap-1.5">
                    <span className="font-numeric tnum" dir="ltr">
                      {(index + 1).toLocaleString('en-US')}
                    </span>
                    {isOverlapping && (
                      <span
                        className="inline-flex items-center rounded-pill bg-terra-100 px-1.5 py-0.5 font-ar text-2xs font-medium text-terra-700"
                        title={Array.from(rowOverlap!)
                          .map((reason) => OVERLAP_REASON_LABEL_AR[reason])
                          .join(' · ')}
                      >
                        تداخل
                      </span>
                    )}
                  </div>
                </Td>
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
                  <RangeCell
                    mode={
                      r.excellenceMode ?? (r.grade ? 'TAGDIR' : 'GRADES')
                    }
                    gradeMinLabel={
                      r.grade ? labelForGrade(r.grade) : null
                    }
                    gradeMaxLabel={
                      r.gradeMax ? labelForGrade(r.gradeMax) : null
                    }
                    scoreMin={r.scoreMin}
                    minScoreOperator={
                      r.minScoreOperator ?? DEFAULT_MIN_SCORE_OPERATOR
                    }
                    scoreMax={r.scoreMax}
                    maxScoreOperator={
                      r.maxScoreOperator ?? DEFAULT_MAX_SCORE_OPERATOR
                    }
                  />
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

/** Merged range cell: a single column that adapts to the row's
 *  excellenceMode. Replaces five sparse columns (معيار التمييز + 4
 *  range bounds) — only the cell relevant to the row's mode renders, with
 *  a tinted chip so the admin can scan the rule's criterion at a glance. */
interface RangeCellProps {
  mode: ExcellenceMode;
  gradeMinLabel: string | null;
  gradeMaxLabel: string | null;
  scoreMin: number | null;
  minScoreOperator: MinScoreOperator;
  scoreMax: number | null;
  maxScoreOperator: MaxScoreOperator;
}

function RangeCell({
  mode,
  gradeMinLabel,
  gradeMaxLabel,
  scoreMin,
  minScoreOperator,
  scoreMax,
  maxScoreOperator,
}: RangeCellProps): JSX.Element {
  if (mode === 'TAGDIR') {
    const hasBounds = gradeMinLabel !== null && gradeMaxLabel !== null;
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="inline-flex items-center rounded-pill border border-gold-300 bg-gold-50 px-1.5 py-0.5 font-ar text-2xs font-medium text-gold-700">
          تقدير
        </span>
        <span className="font-ar text-ink-900">
          {hasBounds ? `${gradeMinLabel} — ${gradeMaxLabel}` : '—'}
        </span>
      </div>
    );
  }
  const hasBounds = scoreMin !== null && scoreMax !== null;
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="inline-flex items-center rounded-pill border border-teal-300 bg-teal-50 px-1.5 py-0.5 font-ar text-2xs font-medium text-teal-700">
        نسبة مئوية
      </span>
      <span className="font-ar tabular-nums text-ink-900" dir="ltr">
        {hasBounds
          ? `${formatScore(scoreMin, minScoreOperator)} — ${formatScore(
              scoreMax,
              maxScoreOperator,
            )}`
          : '—'}
      </span>
    </div>
  );
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

/** Build a candidate `LocalThanawiRow` from the form draft and run the
 *  overlap check against the supplied siblings. Returns the first
 *  overlapping sibling so the caller can name it in the toast. */
function previewThanawiOverlap(
  candidateId: string | null,
  categoryCode: string,
  payload: ThanawiRuleRowInput,
  siblings: readonly LocalThanawiRow[],
  gradeRank: ReadonlyMap<string, number>,
  header: LocalThanawiRow['header'] | undefined,
): { row: LocalThanawiRow; reason: OverlapReason } | null {
  const headerSnapshot: LocalThanawiRow['header'] = header ?? {
    applicationStart: '',
    applicationEnd: '',
    ageReferenceDate: '',
    graduationYears: [],
    maritalStatus: [],
    maxAge: null,
  };
  const candidate: LocalThanawiRow = {
    id: candidateId ?? '__candidate__',
    kind: 'thanawi',
    categoryCode,
    header: headerSnapshot,
    excellenceMode: payload.excellenceMode,
    examRound: payload.examRound,
    committee: payload.committee,
    graduationYear: payload.graduationYear,
    schoolCategories: [...payload.schoolCategories],
    grade: payload.grade,
    gradeMax: payload.gradeMax,
    scoreMin: payload.scoreMin,
    minScoreOperator: payload.minScoreOperator,
    scoreMax: payload.scoreMax,
    maxScoreOperator: payload.maxScoreOperator,
    type: [],
    maritalStatus: [...headerSnapshot.maritalStatus],
    academicDegrees: [],
    committees: payload.committee ? [payload.committee] : [],
    graduationYears: payload.graduationYear !== null ? [payload.graduationYear] : [],
    facultyCode: '',
    facultyNameAr: '',
    specializationCode: '',
    specializationNameAr: '',
  };
  const matches = findCandidateThanawiOverlaps(candidate, siblings, gradeRank);
  return matches[0] ?? null;
}

function thanawiOverlapMessage(match: {
  row: LocalThanawiRow;
  reason: OverlapReason;
}): string {
  return `لا يمكن حفظ الشرط: ${OVERLAP_REASON_LABEL_AR[match.reason]} مع شرط آخر في نفس الفئة.`;
}

/** Banner listing every detected overlap pair under one ثانوي category. */
interface ThanawiOverlapBannerProps {
  pairs: readonly OverlapPair[];
  rows: readonly LocalThanawiRow[];
  committeeOptions: ReadonlyArray<SearchSelectOption>;
}

function ThanawiOverlapBanner({
  pairs,
  rows,
  committeeOptions,
}: ThanawiOverlapBannerProps): JSX.Element | null {
  if (pairs.length === 0) return null;
  const rowById = new Map(rows.map((r) => [r.id, r] as const));
  const indexById = new Map(rows.map((r, idx) => [r.id, idx + 1] as const));
  const labelForCommittee = (code: string): string =>
    committeeOptions.find((o) => o.value === code)?.label ?? code;
  return (
    <div
      role="alert"
      className="mb-3 rounded-md border border-terra-300 bg-terra-50 px-3 py-2"
    >
      <div className="font-ar text-xs font-semibold text-terra-700">
        تنبيه: يوجد تداخل بين الشروط
      </div>
      <ul className="mt-1 flex flex-col gap-0.5 font-ar text-2xs text-terra-700">
        {pairs.map((pair, idx) => {
          const aRow = rowById.get(pair.aId);
          const bRow = rowById.get(pair.bId);
          if (!aRow || !bRow) return null;
          return (
            <li key={`${pair.aId}::${pair.bId}::${idx}`}>
              {`الشرط #${toEasternArabicNumerals(indexById.get(pair.aId) ?? 0)} (${labelForCommittee(aRow.committee)}) ↔ الشرط #${toEasternArabicNumerals(indexById.get(pair.bId) ?? 0)} (${labelForCommittee(bRow.committee)}) — ${OVERLAP_REASON_LABEL_AR[pair.reason]}`}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
