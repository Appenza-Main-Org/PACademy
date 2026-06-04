/**
 * GeneralRulesSection — «الشروط العامة» editor for one
 * university (`type === 'university'`) applicant-category.
 *
 * Layout
 * ------
 *  1. Section header — application dates + الحالة الاجتماعية + top-level
 *     graduation years (kept per-category in the wizard store).
 *  2. Category body — simple university categories render one focused
 *     implicit-specialization form; `specialized_officers` renders a
 *     faculty rail + multi-select specialization rail + bulk-apply form.
 *  3. «اعتماد» — promotes every local row authored under this category
 *     into the «عرض» tab via the shared wizard store.
 *
 * Single-select fields use the shared `SearchSelect` primitive
 * (Radix-backed); multi-value fields keep the existing `MultiSelect`
 * primitive and payload shape.
 *
 * Duplicate rows are blocked at the store boundary (composite key over
 * every combination field). The form surfaces a danger toast when the
 * store rejects.
 */

import { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  Layers,
  Pencil,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  Button,
  Card,
  Checkbox,
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
import type { RadixSelectOption, SearchSelectOption } from '@/shared/components';
import { useLookup } from '@/features/lookups';
import { cn } from '@/shared/lib/cn';
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
  type GeneralRuleRowInput,
  type LocalUniversityRow,
  type MaxScoreOperator,
  type MinScoreOperator,
  type SpecKey,
} from '../../store/wizardSharedState';
import {
  findCandidateUniversityOverlaps,
  findUniversityOverlaps,
  overlapsByRowId,
  OVERLAP_REASON_LABEL_AR,
  type OverlapPair,
  type OverlapReason,
} from '../../lib/ruleOverlapValidation';
import { ExcellenceModeToggle } from './ExcellenceModeToggle';
import { OperatorScoreField } from './OperatorScoreField';
import { RuleRangeIndicator } from './RuleRangeIndicator';

/* ── Static option sets ───────────────────────────────────────────── */

const GENDER_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'male', label: 'ذكر' },
  { value: 'female', label: 'أنثى' },
];

const SPECIALIZED_OFFICERS_CATEGORY_CODE = 'specialized_officers';

const EMPTY_INPUT: GeneralRuleRowInput = {
  excellenceMode: 'GRADES',
  type: [],
  grade: '',
  gradeMax: '',
  scoreMin: null,
  minScoreOperator: DEFAULT_MIN_SCORE_OPERATOR,
  scoreMax: null,
  maxScoreOperator: DEFAULT_MAX_SCORE_OPERATOR,
  academicDegrees: [],
  committee: '',
  graduationYear: null,
};

function emptyInputFor(excellenceMode: ExcellenceMode | null): GeneralRuleRowInput {
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

/* ── Props + entry ────────────────────────────────────────────────── */

interface GeneralRulesSectionProps {
  /** Applicant-category lookup code, e.g. `specialized_officers`. */
  categoryCode: string;
  /** Faculties the category is scoped to (lookup `facultyCodes`).
   *  When empty, the whole faculty lookup is used (read as "any"). */
  facultyCodes: readonly string[];
  /** Specializations the category is scoped to (lookup
   *  `specializationCodes`). When empty, all specializations of the
   *  picked faculties are used. */
  specializationCodes: readonly string[];
  /** Resolved «معيار التمييز» — `TAGDIR` shows only الحد الأدنى/الأقصى
   *  للتقدير, `GRADES` shows only الحد الأدنى/الأقصى للدرجة (٪). `null`
   *  (no criterion picked yet) renders both pairs so admins can still
   *  fill the row in. */
  excellenceMode: ExcellenceMode | null;
}

export function GeneralRulesSection({
  categoryCode,
  facultyCodes,
  specializationCodes,
  excellenceMode,
}: GeneralRulesSectionProps): JSX.Element {
  const facultiesQuery = useLookup('faculties', applicationSettingsQueryOptions);
  const specializationsQuery = useLookup('specializations', applicationSettingsQueryOptions);
  const maritalQuery = useLookup('marital-statuses', applicationSettingsQueryOptions);
  const gradesQuery = useLookup('academic-grades', applicationSettingsQueryOptions);
  const degreesQuery = useLookup('academic-degrees', applicationSettingsQueryOptions);
  const committeesQuery = useLookup('committees', applicationSettingsQueryOptions);
  const graduationYearsQuery = useLookup('graduation-years', applicationSettingsQueryOptions);
  const canWrite = useAdmissionSetupCanWrite();

  const approve = useAdmissionSetupWizardStore((s) => s.approveLocalForCategory);
  const localCount = useAdmissionSetupWizardStore(
    (s) => s.local.filter((r) => r.categoryCode === categoryCode).length,
  );

  /* Per-faculty + per-specialization "has authored rows" sets (across
   * local ⊕ approved) so the accordion headers can highlight which
   * faculties/specs already carry rules. A row of any completeness
   * counts — once it's in the bucket it's "filled" from the admin's
   * perspective, even before all required fields are set. Computed via
   * useMemo off the raw arrays so the Set identity stays stable
   * between renders (a selector that returned a new Set every call
   * would defeat Zustand's referential equality and re-render the
   * whole section continuously). */
  const localRowsAll = useAdmissionSetupWizardStore((s) => s.local);
  const approvedRowsAll = useAdmissionSetupWizardStore((s) => s.approved);
  const { filledFacultyCodes, filledSpecCodes } = useMemo(() => {
    const faculties = new Set<string>();
    const specs = new Set<string>();
    for (const r of [...localRowsAll, ...approvedRowsAll]) {
      if (r.categoryCode !== categoryCode) continue;
      faculties.add(r.facultyCode);
      if (r.kind === 'university') {
        specs.add((r as LocalUniversityRow).specializationCode);
      }
    }
    return { filledFacultyCodes: faculties, filledSpecCodes: specs };
  }, [localRowsAll, approvedRowsAll, categoryCode]);

  const isLoading =
    facultiesQuery.isLoading ||
    specializationsQuery.isLoading ||
    maritalQuery.isLoading ||
    gradesQuery.isLoading ||
    degreesQuery.isLoading ||
    committeesQuery.isLoading ||
    graduationYearsQuery.isLoading;

  const isError =
    facultiesQuery.isError ||
    specializationsQuery.isError ||
    maritalQuery.isError ||
    gradesQuery.isError ||
    degreesQuery.isError ||
    committeesQuery.isError ||
    graduationYearsQuery.isError;

  /* ─── Faculty + specialization scoping ────────────────────────── */

  /** Active faculties allowed for this category. Falls back to "all
   *  active faculties" when the category exposes no facultyCodes. */
  const scopedFaculties = useMemo(() => {
    const allActive = (facultiesQuery.data ?? []).filter((f) => f.isActive);
    if (facultyCodes.length === 0) return allActive;
    const allowed = new Set(facultyCodes);
    return allActive.filter((f) => allowed.has(f.code));
  }, [facultiesQuery.data, facultyCodes]);

  /** Specializations grouped by facultyCode, scoped to the category's
   *  `specializationCodes` when non-empty. */
  const specsByFaculty = useMemo(() => {
    const allow =
      specializationCodes.length > 0 ? new Set(specializationCodes) : null;
    const map = new Map<string, Array<{ code: string; name: string }>>();
    for (const s of specializationsQuery.data ?? []) {
      if (!s.isActive) continue;
      if (allow && !allow.has(s.code)) continue;
      const arr = map.get(s.facultyCode);
      if (arr) arr.push({ code: s.code, name: s.name });
      else map.set(s.facultyCode, [{ code: s.code, name: s.name }]);
    }
    return map;
  }, [specializationsQuery.data, specializationCodes]);

  /* ─── Option sets ─────────────────────────────────────────────── */

  const maritalOptions = useMemo(
    () =>
      (maritalQuery.data ?? [])
        .filter((m) => m.isActive)
        .map((m) => ({ value: m.code, label: m.name })),
    [maritalQuery.data],
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

  const degreeOptions = useMemo<SearchSelectOption[]>(
    () =>
      (degreesQuery.data ?? [])
        .filter((d) => d.isActive)
        .map((d) => ({ value: d.code, label: d.name })),
    [degreesQuery.data],
  );

  /** Committees scoped to the active category (committees lookup row
   *  carries `applicantCategoryId` → matches `categoryCode`). */
  const committeeOptions = useMemo<SearchSelectOption[]>(
    () =>
      (committeesQuery.data ?? [])
        .filter((c) => c.isActive && c.applicantCategoryId === categoryCode)
        .map((c) => ({ value: c.code, label: c.name })),
    [committeesQuery.data, categoryCode],
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

  /* ─── Approve handler ─────────────────────────────────────────── */

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
          facultiesQuery.refetch();
          specializationsQuery.refetch();
          maritalQuery.refetch();
          gradesQuery.refetch();
          degreesQuery.refetch();
          committeesQuery.refetch();
          graduationYearsQuery.refetch();
        }}
      />
    );
  }

  /* ─── Faculty/spec workspace rendering ────────────────────────── */

  const formOptions: PerSpecFormOptions = {
    categoryCode,
    maritalOptions,
    gradeOptions,
    gradeRank,
    degreeOptions,
    committeeOptions,
    graduationYearOptions,
    excellenceMode,
  };
  const scopedSpecCount = [...specsByFaculty.values()].reduce(
    (count, specs) => count + specs.length,
    0,
  );
  const shouldUseScopedWorkspace =
    categoryCode === SPECIALIZED_OFFICERS_CATEGORY_CODE ||
    scopedFaculties.length > 1 ||
    scopedSpecCount > 1;

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
            عيّن نطاق التقديم، الحالة الاجتماعية، وشروط اللجنة لكل تخصص نشط.
          </p>
        </div>
      </header>

      <TopFields
        categoryCode={categoryCode}
        maritalOptions={maritalOptions}
        canWrite={canWrite}
      />

      <div className="mt-4">
        {shouldUseScopedWorkspace ? (
          <SpecializedOfficersWorkspace
            faculties={scopedFaculties}
            specsByFaculty={specsByFaculty}
            filledFacultyCodes={filledFacultyCodes}
            filledSpecCodes={filledSpecCodes}
            options={formOptions}
            canWrite={canWrite}
          />
        ) : (
          <ImplicitUniversityPanel
            faculties={scopedFaculties}
            specsByFaculty={specsByFaculty}
            filledSpecCodes={filledSpecCodes}
            options={formOptions}
            canWrite={canWrite}
          />
        )}
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

interface TopFieldsProps {
  categoryCode: string;
  maritalOptions: ReadonlyArray<{ value: string; label: string }>;
  canWrite: boolean;
}

function TopFields({
  categoryCode,
  maritalOptions,
  canWrite,
}: TopFieldsProps): JSX.Element {
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

/* ── University category bodies ───────────────────────────────────── */

type FacultyOption = {
  code: string;
  name: string;
};

type SpecializationOption = {
  code: string;
  name: string;
};

interface ImplicitUniversityPanelProps {
  faculties: readonly FacultyOption[];
  specsByFaculty: ReadonlyMap<string, SpecializationOption[]>;
  /** Specialization codes with at least one authored row. */
  filledSpecCodes: ReadonlySet<string>;
  options: PerSpecFormOptions;
  canWrite: boolean;
}

function ImplicitUniversityPanel({
  faculties,
  specsByFaculty,
  filledSpecCodes,
  options,
  canWrite,
}: ImplicitUniversityPanelProps): JSX.Element {
  const firstFaculty =
    faculties.find((faculty) => (specsByFaculty.get(faculty.code) ?? []).length > 0) ??
    faculties[0] ??
    null;
  const firstSpec = firstFaculty
    ? specsByFaculty.get(firstFaculty.code)?.[0] ?? null
    : null;

  if (!firstFaculty || !firstSpec) {
    return (
      <EmptyState
        variant="generic"
        title="لا توجد تخصصات مرتبطة بهذه الفئة"
        description="فعّل تخصصاً واحداً على الأقل أو اضبط نطاق الفئة في الأكواد المرجعية."
      />
    );
  }

  return (
    <div className="rounded-md border border-border-subtle bg-surface-card p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="m-0 font-ar text-lg font-bold text-ink-900">
              شروط اللجنة
            </h4>
            <span className="rounded-full bg-ink-50 px-2 py-0.5 font-ar text-2xs font-medium text-ink-600">
              {firstFaculty.name} · {firstSpec.name}
            </span>
          </div>
          <p className="m-0 mt-2 font-ar text-xs text-ink-500">
            هذه الفئة لها نطاق تخصص واحد، لذلك تظهر شروطها مباشرة دون تنقل إضافي.
          </p>
        </div>
        {filledSpecCodes.has(firstSpec.code) && (
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-1 font-ar text-2xs font-medium text-teal-700">
            <CheckCircle2 size={12} strokeWidth={2} aria-hidden />
            يحتوي على شروط
          </span>
        )}
      </div>

      <PerSpecForm
        key={`${firstFaculty.code}::${firstSpec.code}`}
        facultyCode={firstFaculty.code}
        facultyNameAr={firstFaculty.name}
        specializationCode={firstSpec.code}
        specializationNameAr={firstSpec.name}
        options={options}
        canWrite={canWrite}
      />
    </div>
  );
}

interface SpecializedOfficersWorkspaceProps {
  faculties: readonly FacultyOption[];
  specsByFaculty: ReadonlyMap<string, SpecializationOption[]>;
  /** Faculty codes with at least one authored row. */
  filledFacultyCodes: ReadonlySet<string>;
  /** Specialization codes with at least one authored row. */
  filledSpecCodes: ReadonlySet<string>;
  options: PerSpecFormOptions;
  canWrite: boolean;
}

function SpecializedOfficersWorkspace({
  faculties,
  specsByFaculty,
  filledFacultyCodes,
  filledSpecCodes,
  options,
  canWrite,
}: SpecializedOfficersWorkspaceProps): JSX.Element {
  const [selectedFacultyCode, setSelectedFacultyCode] = useState<string | null>(
    null,
  );
  const [selectedSpecCodes, setSelectedSpecCodes] = useState<Set<string>>(
    () => new Set(),
  );
  const [facultySearch, setFacultySearch] = useState('');
  const [specSearch, setSpecSearch] = useState('');
  const localRows = useAdmissionSetupWizardStore((s) => s.local);
  const approvedRows = useAdmissionSetupWizardStore((s) => s.approved);
  const editingRowId = useAdmissionSetupWizardStore((s) => s.editingRowId);
  const removeLocalRow = useAdmissionSetupWizardStore((s) => s.removeLocalRow);
  const removeApprovedRow = useAdmissionSetupWizardStore(
    (s) => s.removeApprovedRow,
  );
  const setEditingRow = useAdmissionSetupWizardStore((s) => s.setEditingRow);
  const categoryRows = useMemo(
    () =>
      sortGeneralRuleRowsNewestFirst(
        [...localRows, ...approvedRows].filter(
          (r): r is LocalUniversityRow =>
            r.kind === 'university' && r.categoryCode === options.categoryCode,
        ),
      ),
    [localRows, approvedRows, options.categoryCode],
  );

  const overlapPairs = useMemo<OverlapPair[]>(
    () => findUniversityOverlaps(categoryRows, options.gradeRank),
    [categoryRows, options.gradeRank],
  );
  const overlapsById = useMemo(
    () => overlapsByRowId(overlapPairs),
    [overlapPairs],
  );

  const filteredFaculties = useMemo(() => {
    const needle = facultySearch.trim().toLowerCase();
    if (needle === '') return faculties;
    return faculties.filter((faculty) =>
      [faculty.name, faculty.code].join(' ').toLowerCase().includes(needle),
    );
  }, [faculties, facultySearch]);

  const selectedFaculty =
    faculties.find((faculty) => faculty.code === selectedFacultyCode) ??
    filteredFaculties[0] ??
    faculties[0] ??
    null;

  const selectedFacultySpecs = selectedFaculty
    ? specsByFaculty.get(selectedFaculty.code) ?? []
    : [];

  const filteredSpecs = useMemo(() => {
    const needle = specSearch.trim().toLowerCase();
    if (needle === '') return selectedFacultySpecs;
    return selectedFacultySpecs.filter((spec) =>
      [spec.name, spec.code].join(' ').toLowerCase().includes(needle),
    );
  }, [selectedFacultySpecs, specSearch]);

  const selectedSpecCodesInFaculty = useMemo(() => {
    const scopedCodes = new Set(selectedFacultySpecs.map((spec) => spec.code));
    return new Set(
      [...selectedSpecCodes].filter((code) => scopedCodes.has(code)),
    );
  }, [selectedSpecCodes, selectedFacultySpecs]);

  const selectedSpecTargets: SpecKey[] = useMemo(() => {
    if (!selectedFaculty) return [];
    return selectedFacultySpecs
      .filter((spec) => selectedSpecCodesInFaculty.has(spec.code))
      .map((spec) => ({
        facultyCode: selectedFaculty.code,
        facultyNameAr: selectedFaculty.name,
        specializationCode: spec.code,
        specializationNameAr: spec.name,
      }));
  }, [selectedFaculty, selectedFacultySpecs, selectedSpecCodesInFaculty]);

  const handleFacultySelect = (facultyCode: string): void => {
    if (facultyCode === selectedFaculty?.code) return;
    if (selectedSpecCodes.size > 0) {
      toast('تم مسح التحديد بعد تغيير الكلية', 'info');
    }
    setSelectedFacultyCode(facultyCode);
    setSelectedSpecCodes(new Set());
    setSpecSearch('');
  };

  const handleSpecToggle = (specCode: string): void => {
    setSelectedSpecCodes((current) => {
      const next = new Set(current);
      if (next.has(specCode)) next.delete(specCode);
      else next.add(specCode);
      return next;
    });
  };

  const handleSelectAllSpecs = (): void => {
    setSelectedSpecCodes(new Set(selectedFacultySpecs.map((spec) => spec.code)));
  };

  const handleClearSpecs = (): void => {
    setSelectedSpecCodes(new Set());
  };

  const handleDeleteCategoryRow = (id: string): void => {
    if (!canWrite) return;
    removeLocalRow(id);
    removeApprovedRow(id);
  };

  const handleEditCategoryRow = (id: string): void => {
    if (!canWrite) return;
    const row = categoryRows.find((r) => r.id === id);
    if (!row) return;
    setSelectedFacultyCode(row.facultyCode);
    setSelectedSpecCodes(new Set([row.specializationCode]));
    setEditingRow(id);
  };

  if (faculties.length === 0) {
    return (
      <EmptyState
        variant="generic"
        title="لا توجد كليات مرتبطة بهذه الفئة"
        description="فعّل كلية واحدة على الأقل أو اضبط نطاق الفئة في الأكواد المرجعية."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid min-h-[520px] grid-cols-1 overflow-hidden rounded-md border border-border-subtle bg-surface-card xl:grid-cols-[260px_minmax(0,1fr)]">
        <section className="min-w-0 border-b border-border-subtle bg-surface xl:border-b-0 xl:border-e">
          <WorkspaceColumnHeader
            title="الكليات"
            subtitle="اختر كلية لعرض تخصصاتها"
          />
          <SearchBox
            label="بحث في الكليات"
            value={facultySearch}
            onChange={setFacultySearch}
            placeholder="ابحث عن كلية…"
          />
          <div className="max-h-[520px] overflow-y-auto border-t border-border-subtle">
            {filteredFaculties.length === 0 ? (
              <p className="px-4 py-8 text-center font-ar text-xs text-ink-500">
                لا توجد كليات مطابقة للبحث.
              </p>
            ) : (
              filteredFaculties.map((faculty) => {
                const specs = specsByFaculty.get(faculty.code) ?? [];
                const isSelected = selectedFaculty?.code === faculty.code;
                const isFilled = filledFacultyCodes.has(faculty.code);
                return (
                  <button
                    key={faculty.code}
                    type="button"
                    onClick={() => handleFacultySelect(faculty.code)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 border-b border-border-subtle px-4 py-4 text-start transition-colors duration-fast',
                      'focus-visible:outline-none focus-visible:shadow-[var(--ring)]',
                      isSelected
                        ? 'bg-[var(--accent-50)] shadow-[inset_0_0_0_1px_var(--accent-500)]'
                        : 'bg-surface-card hover:bg-ink-50/70',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-ar text-sm font-semibold text-ink-900">
                        {faculty.name}
                      </span>
                      <span className="mt-1 inline-flex items-center gap-1 font-ar text-2xs text-ink-500">
                        <Layers size={11} strokeWidth={1.75} aria-hidden />
                        {num(specs.length)} تخصص مرتبط
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-2">
                      {isFilled && (
                        <span className="size-2 rounded-full bg-[var(--accent-600)]" />
                      )}
                      {isSelected && (
                        <ChevronLeft
                          size={14}
                          strokeWidth={2}
                          className="text-[var(--accent-600)]"
                          aria-hidden
                        />
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="min-w-0 bg-surface">
          <WorkspaceColumnHeader
            title={
              selectedFaculty
                ? `تخصصات: ${selectedFaculty.name}`
                : 'التخصصات'
            }
            subtitle={`${num(selectedSpecCodesInFaculty.size)} / ${num(selectedFacultySpecs.length)} محددة`}
          />
          <SearchBox
            label="بحث في التخصصات"
            value={specSearch}
            onChange={setSpecSearch}
            placeholder="ابحث عن تخصص…"
          />
          <div className="mx-4 mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="font-ar text-2xs text-ink-500">
              اختر تخصصاً أو أكثر لتطبيق نفس الشروط.
            </span>
            <span className="inline-flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAllSpecs}
                disabled={!canWrite || selectedFacultySpecs.length === 0}
              >
                تحديد الكل
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSpecs}
                disabled={!canWrite || selectedSpecCodesInFaculty.size === 0}
              >
                إلغاء
              </Button>
            </span>
          </div>
          <div className="max-h-[520px] overflow-y-auto border-t border-border-subtle">
            {selectedFacultySpecs.length === 0 ? (
              <p className="px-4 py-8 text-center font-ar text-xs text-ink-500">
                لا توجد تخصصات نشطة في هذه الكلية.
              </p>
            ) : filteredSpecs.length === 0 ? (
              <p className="px-4 py-8 text-center font-ar text-xs text-ink-500">
                لا توجد تخصصات مطابقة للبحث.
              </p>
            ) : (
              filteredSpecs.map((spec) => {
                const isSelected = selectedSpecCodesInFaculty.has(spec.code);
                const isFilled = filledSpecCodes.has(spec.code);
                return (
                  <div
                    key={spec.code}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSpecToggle(spec.code)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleSpecToggle(spec.code);
                      }
                    }}
                    className={cn(
                      'flex w-full cursor-pointer items-center justify-between gap-3 border-b border-border-subtle px-4 py-4 text-start transition-colors duration-fast',
                      'focus-visible:outline-none focus-visible:shadow-[var(--ring)]',
                      isSelected
                        ? 'bg-[var(--accent-50)] shadow-[inset_0_0_0_1px_var(--accent-500)]'
                        : 'bg-surface-card hover:bg-ink-50/70',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleSpecToggle(spec.code)}
                          disabled={!canWrite}
                          aria-label={`اختيار ${spec.name}`}
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-ar text-sm font-semibold text-ink-900">
                          {spec.name}
                        </span>
                      </span>
                    </span>
                    {isFilled && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-50)] px-2 py-1 font-ar text-2xs font-medium text-[var(--accent-700)]">
                        <CheckCircle2 size={12} strokeWidth={2} aria-hidden />
                        شروط
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

      </div>

      <section className="min-w-0 rounded-md border border-border-subtle bg-ink-50/20 p-4">
        {selectedSpecTargets.length > 0 && selectedFaculty ? (
          <PerSpecForm
            key={`${selectedFaculty.code}::${selectedSpecTargets
              .map((target) => target.specializationCode)
              .join('|')}`}
            facultyCode={selectedFaculty.code}
            facultyNameAr={selectedFaculty.name}
            specializationCode={selectedSpecTargets[0].specializationCode}
            specializationNameAr={selectedSpecTargets[0].specializationNameAr}
            options={options}
            bulkTargets={selectedSpecTargets}
            emptyRowsLabel="لم تُضف شروط لجان بعد للتخصصات المحددة."
            showScopeColumn={selectedSpecTargets.length > 1}
            hideRowsGrid
            onAddSuccess={handleClearSpecs}
            bulkBanner={
              <BulkApplyBanner
                facultyName={selectedFaculty.name}
                targets={selectedSpecTargets}
              />
            }
            canWrite={canWrite}
          />
        ) : (
          <EmptyState
            variant="generic"
            title="اختر تخصصاً لإضافة الشروط"
            description="اختر كلية ثم حدد تخصصاً أو أكثر لعرض نموذج شروط اللجنة."
          />
        )}
      </section>

      <section className="min-w-0 rounded-md border border-border-subtle bg-surface-card p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="m-0 font-ar text-sm font-semibold text-ink-900">
              شروط الفئة المضافة
            </h4>
          </div>
          {categoryRows.length > 0 && (
            <span className="rounded-full bg-ink-50 px-2 py-1 font-ar text-2xs font-medium text-ink-600">
              {num(categoryRows.length)} شرط
            </span>
          )}
        </div>
        <RuleRangeIndicator
          rows={categoryRows}
          overlappingIds={new Set(overlapsById.keys())}
        />
        <UniversityOverlapBanner pairs={overlapPairs} rows={categoryRows} />
        <LocalUniversityGrid
          rows={categoryRows}
          editingId={editingRowId}
          gradeOptions={options.gradeOptions}
          degreeOptions={options.degreeOptions}
          committeeOptions={options.committeeOptions}
          maritalOptions={options.maritalOptions}
          onEdit={handleEditCategoryRow}
          onDelete={handleDeleteCategoryRow}
          emptyRowsLabel="لم تُضف شروط لجان بعد لهذه الفئة."
          showScopeColumn
          overlapsById={overlapsById}
          canWrite={canWrite}
        />
      </section>
    </div>
  );
}

function BulkApplyBanner({
  facultyName,
  targets,
}: {
  facultyName: string;
  targets: readonly SpecKey[];
}): JSX.Element {
  return (
    <div className="rounded-md border border-gold-200 bg-gold-50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-ar text-xs font-semibold text-gold-800">
          تطبيق دفعة واحدة على {num(targets.length)} تخصصات
        </span>
        <span className="font-ar text-xs text-gold-700">· {facultyName}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {targets.map((target) => (
          <span
            key={`${target.facultyCode}::${target.specializationCode}`}
            className="rounded-full border border-gold-200 bg-surface-card px-2 py-1 font-ar text-2xs font-medium text-gold-800"
          >
            {target.specializationNameAr}
          </span>
        ))}
      </div>
    </div>
  );
}

function WorkspaceColumnHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}): JSX.Element {
  return (
    <header className="flex min-h-16 items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <h4 className="m-0 truncate font-ar text-sm font-bold text-ink-900">
          {title}
        </h4>
        <p className="m-0 mt-1 truncate font-ar text-2xs text-ink-500">
          {subtitle}
        </p>
      </div>
    </header>
  );
}

function SearchBox({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}): JSX.Element {
  return (
    <label className="relative mx-4 mb-4 block">
      <span className="sr-only">{label}</span>
      <Search
        size={15}
        strokeWidth={1.75}
        className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-400 start-3"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-md border border-border-default bg-surface-card ps-9 pe-3 font-ar text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-teal-500 focus:shadow-focus-teal"
      />
    </label>
  );
}

/* ── Per-specialization form ─────────────────────────────────────── */

interface PerSpecFormOptions {
  categoryCode: string;
  maritalOptions: ReadonlyArray<{ value: string; label: string }>;
  gradeOptions: ReadonlyArray<SearchSelectOption>;
  gradeRank: Map<string, number>;
  degreeOptions: ReadonlyArray<SearchSelectOption>;
  committeeOptions: ReadonlyArray<SearchSelectOption>;
  graduationYearOptions: ReadonlyArray<SearchSelectOption>;
  /** Discriminates which bound pair the form surfaces — see
   *  `GeneralRulesSectionProps.excellenceMode`. */
  excellenceMode: ExcellenceMode | null;
}

interface PerSpecFormProps {
  facultyCode: string;
  facultyNameAr: string;
  specializationCode: string;
  specializationNameAr: string;
  options: PerSpecFormOptions;
  bulkTargets?: readonly SpecKey[];
  bulkBanner?: React.ReactNode;
  emptyRowsLabel?: string;
  showScopeColumn?: boolean;
  hideRowsGrid?: boolean;
  onAddSuccess?: () => void;
  canWrite: boolean;
}

function rowToUniversityInput(r: LocalUniversityRow): GeneralRuleRowInput {
  return {
    excellenceMode: r.excellenceMode ?? (r.grade ? 'TAGDIR' : 'GRADES'),
    type: [...r.type],
    grade: r.grade,
    gradeMax: r.gradeMax,
    scoreMin: r.scoreMin,
    /* Defensive fallback for legacy rows authored before operator fields
     * existed on the row shape — defaults to the inclusive (`≥`/`≤`)
     * behaviour the bare numeric bounds historically implied. */
    minScoreOperator: r.minScoreOperator ?? DEFAULT_MIN_SCORE_OPERATOR,
    scoreMax: r.scoreMax,
    maxScoreOperator: r.maxScoreOperator ?? DEFAULT_MAX_SCORE_OPERATOR,
    academicDegrees: [...r.academicDegrees],
    committee: r.committees[0] ?? '',
    graduationYear: r.graduationYears[0] ?? null,
  };
}

function universityInputKey(
  categoryCode: string,
  spec: SpecKey,
  input: GeneralRuleRowInput,
): string {
  return [
    categoryCode,
    spec.facultyCode,
    spec.specializationCode,
    input.excellenceMode,
    [...input.type].sort().join('|'),
    input.grade,
    input.gradeMax,
    String(input.scoreMin),
    input.minScoreOperator,
    String(input.scoreMax),
    input.maxScoreOperator,
    [...input.academicDegrees].sort().join('|'),
    input.committee,
    input.graduationYear === null ? '' : String(input.graduationYear),
  ].join('::');
}

function universityRowKey(r: LocalUniversityRow): string {
  return [
    r.categoryCode,
    r.facultyCode,
    r.specializationCode,
    r.excellenceMode,
    [...r.type].sort().join('|'),
    r.grade,
    r.gradeMax,
    String(r.scoreMin),
    r.minScoreOperator,
    String(r.scoreMax),
    r.maxScoreOperator,
    [...r.academicDegrees].sort().join('|'),
    [...r.committees].sort().join('|'),
    [...r.graduationYears].sort().join('|'),
  ].join('::');
}

function PerSpecForm({
  facultyCode,
  facultyNameAr,
  specializationCode,
  specializationNameAr,
  options,
  bulkTargets,
  bulkBanner,
  emptyRowsLabel = 'لم تُضف شروط لجان بعد لهذا التخصص.',
  showScopeColumn = false,
  hideRowsGrid = false,
  onAddSuccess,
  canWrite,
}: PerSpecFormProps): JSX.Element {
  const {
    categoryCode,
    gradeOptions,
    gradeRank,
    degreeOptions,
    committeeOptions,
    graduationYearOptions,
    excellenceMode,
  } = options;
  const defaultExcellenceMode = excellenceMode ?? 'GRADES';
  const [draft, setDraft] = useState<GeneralRuleRowInput>(() =>
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

  const addUniversityRow = useAdmissionSetupWizardStore(
    (s) => s.addUniversityRow,
  );
  const updateUniversityRow = useAdmissionSetupWizardStore(
    (s) => s.updateUniversityRow,
  );
  const removeLocalRow = useAdmissionSetupWizardStore((s) => s.removeLocalRow);
  const removeApprovedRow = useAdmissionSetupWizardStore(
    (s) => s.removeApprovedRow,
  );
  const setEditingRow = useAdmissionSetupWizardStore((s) => s.setEditingRow);
  const clearEditingRow = useAdmissionSetupWizardStore(
    (s) => s.clearEditingRow,
  );
  /* Read both buckets so rows promoted via the section-level «اعتماد»
   * button (which moves them from `local` → `approved`) stay visible
   * in the editor grid. Without this the grid would empty out while
   * the category badge still reads مكتمل — confusing on round-trips
   * through `application_settings_review`. */
  const localRows = useAdmissionSetupWizardStore((s) => s.local);
  const approvedRows = useAdmissionSetupWizardStore((s) => s.approved);
  const primarySpec: SpecKey = {
    facultyCode,
    facultyNameAr,
    specializationCode,
    specializationNameAr,
  };
  const submitTargets =
    bulkTargets && bulkTargets.length > 0 ? bulkTargets : [primarySpec];
  const rows = useMemo(
    () =>
      sortGeneralRuleRowsNewestFirst(
        [...localRows, ...approvedRows].filter(
          (r): r is LocalUniversityRow =>
            r.kind === 'university' && r.categoryCode === categoryCode,
        ),
      ),
    [localRows, approvedRows, categoryCode],
  );

  const overlapPairs = useMemo<OverlapPair[]>(
    () => findUniversityOverlaps(rows, gradeRank),
    [rows, gradeRank],
  );
  const overlapsById = useMemo(
    () => overlapsByRowId(overlapPairs),
    [overlapPairs],
  );

  const shouldShowScopeColumn =
    showScopeColumn ||
    rows.some(
      (r) =>
        r.facultyCode !== facultyCode ||
        r.specializationCode !== specializationCode,
    );
  const handleDelete = (id: string): void => {
    if (!canWrite) return;
    removeLocalRow(id);
    removeApprovedRow(id);
  };

  /** The row currently being edited, scoped to the current category.
   *  The visible grid is category-wide, so editing must be able to pick
   *  up any row in that category, not just the currently selected
   *  faculty/specialization targets. */
  const editingRow = useAdmissionSetupWizardStore((s) => {
    if (s.editingRowId === null) return null;
    const r =
      s.local.find((x) => x.id === s.editingRowId) ??
      s.approved.find((x) => x.id === s.editingRowId);
    if (
      !r ||
      r.kind !== 'university' ||
      r.categoryCode !== categoryCode
    ) {
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
    setDraft(editingRow ? rowToUniversityInput(editingRow) : emptyInputFor(defaultExcellenceMode));
  }
  const lastDefaultModeRef = useRef<ExcellenceMode>(defaultExcellenceMode);
  if (!isEditing && lastDefaultModeRef.current !== defaultExcellenceMode) {
    lastDefaultModeRef.current = defaultExcellenceMode;
    setDraft(emptyInputFor(defaultExcellenceMode));
  }
  const showGradePair = draft.excellenceMode === 'TAGDIR';
  const showScorePair = draft.excellenceMode === 'GRADES';

  /* ─── Validation ─── */

  /* `gradeRank` reflects the academic-grades lookup order, which is
   * authored best→worst (امتياز=0 … مقبول=N). So a higher rank index
   * means a *worse* grade. The max bound must not be a worse grade
   * than the min bound, i.e. invalid when `max-rank > min-rank`. */
  const gradeOrderInvalid =
    draft.grade !== '' &&
    draft.gradeMax !== '' &&
    (gradeRank.get(draft.gradeMax) ?? -Infinity) >
      (gradeRank.get(draft.grade) ?? Infinity);

  /* OperatorScoreField clamps to [0, maxBound] on blur, but we still
   *  guard the submit gate so a focus-stolen blur or paste-then-submit
   *  can't sneak an out-of-range value past. Max has no upper bound;
   *  only enforce the lower 0. */
  const scoreMinOutOfBounds =
    draft.scoreMin !== null &&
    (draft.scoreMin < SCORE_MIN_BOUND || draft.scoreMin > MIN_SCORE_UPPER_BOUND);

  const scoreMaxOutOfBounds =
    draft.scoreMax !== null && draft.scoreMax < SCORE_MIN_BOUND;

  /* Local clamp messages surfaced under each input. Null = no error. */
  const [scoreMinMessage, setScoreMinMessage] = useState<string | null>(null);
  const [scoreMaxMessage, setScoreMaxMessage] = useState<string | null>(null);

  const scoreOrderInvalid =
    draft.scoreMin !== null &&
    draft.scoreMax !== null &&
    draft.scoreMax < draft.scoreMin;

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
    draft.type.length > 0 &&
    gradePairOk &&
    scorePairOk &&
    draft.academicDegrees.length > 0 &&
    draft.committee.length > 0 &&
    draft.graduationYear !== null;

  /** Blank-out fields that the active criterion hides so a row authored
   *  under one criterion doesn't carry orphan values if the admin switches
   *  later. The store still receives both pairs on the row — just zeroed
   *  for the inactive branch. */
  const normalizeForSubmit = (input: GeneralRuleRowInput): GeneralRuleRowInput => ({
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
      const editingSpec: SpecKey = editingRow
        ? {
            facultyCode: editingRow.facultyCode,
            facultyNameAr: editingRow.facultyNameAr,
            specializationCode: editingRow.specializationCode,
            specializationNameAr: editingRow.specializationNameAr,
          }
        : primarySpec;
      const overlap = previewUniversityOverlapForTarget(
        editingId,
        categoryCode,
        editingSpec,
        payload,
        rows,
        gradeRank,
        editingRow?.header,
      );
      if (overlap) {
        toast(overlapMessageFor(overlap, editingSpec), 'danger');
        return;
      }
      const result = updateUniversityRow(editingId, editingSpec, payload);
      if (!result.ok) {
        toast(
          result.reason === 'duplicate'
            ? 'هذا الشرط موجود بالفعل بنفس البيانات'
            : 'تعذر تعديل الشرط',
          'danger',
        );
        return;
      }
      setDraft(emptyInputFor(defaultExcellenceMode));
      toast('تم تعديل الشرط', 'success');
      return;
    }

    const existingKeys = new Set(
      [...localRows, ...approvedRows]
        .filter(
          (r): r is LocalUniversityRow =>
            r.kind === 'university' && r.categoryCode === categoryCode,
        )
        .map(universityRowKey),
    );
    const duplicateTarget = submitTargets.find((target) =>
      existingKeys.has(universityInputKey(categoryCode, target, payload)),
    );
    if (duplicateTarget) {
      toast(
        `هذا الشرط موجود بالفعل في تخصص ${duplicateTarget.specializationNameAr}`,
        'danger',
      );
      return;
    }

    /* Pre-store overlap check so the user gets a single targeted reason
     * instead of an opaque "duplicate" rejection from the store. Run
     * against the current siblings under this category — running it
     * before any add prevents partial fan-out (one target succeeds,
     * the next collides with the row we just added). */
    for (const target of submitTargets) {
      const overlap = previewUniversityOverlapForTarget(
        null,
        categoryCode,
        target,
        payload,
        rows,
        gradeRank,
        header,
      );
      if (overlap) {
        toast(overlapMessageFor(overlap, target), 'danger');
        return;
      }
    }

    for (const target of submitTargets) {
      const result = addUniversityRow(categoryCode, target, payload);
      if (!result.ok) {
        toast('هذا الشرط موجود بالفعل بنفس البيانات', 'danger');
        return;
      }
    }
    resetForm();
    onAddSuccess?.();
    toast(
      submitTargets.length > 1
        ? `تمت إضافة الشرط إلى ${num(submitTargets.length)} تخصصات`
        : 'تمت إضافة الشرط محلياً',
      'success',
    );
  };

  const handleCancelEdit = (): void => {
    clearEditingRow();
  };

  const handleEdit = (id: string): void => {
    if (!canWrite) return;
    setEditingRow(id);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {bulkBanner}
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

        <FieldGroup title="بيانات القبول">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <FieldLabel label="النوع" required>
              <MultiSelect
                ariaLabel="النوع"
                value={draft.type}
                onChange={(next) => setDraft((d) => ({ ...d, type: next }))}
                options={GENDER_OPTIONS}
                disabled={!canWrite}
                placeholder="اختر النوع…"
              />
            </FieldLabel>

            {showGradePair && (
              <>
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
              </>
            )}

            <FieldLabel label="الدرجة العلمية" required>
              {degreeOptions.length === 0 ? (
                <p className="font-ar text-2xs text-ink-500">
                  لا توجد درجات علمية مفعّلة في المراجع.
                </p>
              ) : (
                <MultiSelect
                  ariaLabel="الدرجة العلمية"
                  value={draft.academicDegrees}
                  onChange={(next) =>
                    setDraft((d) => ({ ...d, academicDegrees: next }))
                  }
                  options={degreeOptions.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                  disabled={!canWrite}
                  placeholder="اختر الدرجة العلمية…"
                />
              )}
            </FieldLabel>
          </div>
        </FieldGroup>

        {showScorePair && (
          <div className="mt-3">
            <FieldGroup title="حدود التمييز">
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
            </FieldGroup>
          </div>
        )}

        <div className="mt-3">
          <FieldGroup title="اللجنة وسنة التخرج">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FieldLabel label="اللجنة" required>
                {committeeOptions.length === 0 ? (
                  <p className="font-ar text-2xs text-ink-500">
                    لا توجد لجان مرتبطة بهذه الفئة.
                  </p>
                ) : (
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
                )}
              </FieldLabel>

              <FieldLabel label="سنة التخرج" required>
                <SearchSelect
                  ariaLabel="سنة التخرج"
                  value={
                    draft.graduationYear !== null ? String(draft.graduationYear) : null
                  }
                  disabled={!canWrite}
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
            </div>
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

      {!hideRowsGrid && (
        <>
          <RuleRangeIndicator
            rows={rows}
            overlappingIds={new Set(overlapsById.keys())}
          />
          <UniversityOverlapBanner pairs={overlapPairs} rows={rows} />
          <LocalUniversityGrid
            rows={rows}
            editingId={editingId}
            gradeOptions={gradeOptions}
            degreeOptions={degreeOptions}
            committeeOptions={committeeOptions}
            maritalOptions={options.maritalOptions}
            onEdit={handleEdit}
            onDelete={handleDelete}
            emptyRowsLabel={emptyRowsLabel}
            showScopeColumn={shouldShowScopeColumn}
            overlapsById={overlapsById}
            canWrite={canWrite}
          />
        </>
      )}
    </div>
  );
}

/* ── Per-spec local rows grid ─────────────────────────────────────── */

interface LocalUniversityGridProps {
  rows: LocalUniversityRow[];
  /** Row id currently in edit mode for this form (null = add mode). */
  editingId: string | null;
  gradeOptions: ReadonlyArray<SearchSelectOption>;
  degreeOptions: ReadonlyArray<SearchSelectOption>;
  committeeOptions: ReadonlyArray<SearchSelectOption>;
  maritalOptions: ReadonlyArray<{ value: string; label: string }>;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  emptyRowsLabel: string;
  showScopeColumn: boolean;
  canWrite: boolean;
  /** Map of rowId → reasons it overlaps a sibling. Drives the per-row
   *  terra tint and the «تداخل» badge in the «م» column. */
  overlapsById?: ReadonlyMap<string, ReadonlySet<OverlapReason>>;
}

function LocalUniversityGrid({
  rows,
  editingId,
  gradeOptions,
  degreeOptions,
  committeeOptions,
  maritalOptions,
  onEdit,
  onDelete,
  emptyRowsLabel,
  showScopeColumn,
  canWrite,
  overlapsById,
}: LocalUniversityGridProps): JSX.Element {
  const labelForGrade = (v: string): string =>
    gradeOptions.find((o) => o.value === v)?.label ?? v;
  const labelForDegree = (v: string): string =>
    degreeOptions.find((o) => o.value === v)?.label ?? v;
  const labelForCommittee = (v: string): string =>
    committeeOptions.find((o) => o.value === v)?.label ?? v;
  const labelForType = (v: string): string =>
    GENDER_OPTIONS.find((o) => o.value === v)?.label ?? v;
  const labelForMarital = (v: string): string =>
    maritalOptions.find((o) => o.value === v)?.label ?? v;
  const labelForExcellenceMode = (r: LocalUniversityRow): string =>
    (r.excellenceMode ?? (r.grade ? 'TAGDIR' : 'GRADES')) === 'TAGDIR'
      ? 'تقدير'
      : 'درجة';

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border-subtle bg-ink-50/40 px-3 py-3 text-2xs text-ink-500">
        {emptyRowsLabel}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border-subtle bg-surface-card">
      <table className="min-w-[112rem] border-collapse text-sm">
        <thead className="bg-ink-50/80">
          <tr>
            <Th>م</Th>
            {showScopeColumn && <Th>الكلية / التخصص</Th>}
            <Th>اللجنة</Th>
            <Th>بداية التقديم</Th>
            <Th>نهاية التقديم</Th>
            <Th>تاريخ احتساب السن</Th>
            <Th>الحالة الاجتماعية</Th>
            <Th>النوع</Th>
            <Th>معيار التمييز</Th>
            <Th>الحد الأدنى للتقدير</Th>
            <Th>الحد الأقصى للتقدير</Th>
            <Th>الحد الأدنى للدرجة</Th>
            <Th>الحد الأقصى للدرجة</Th>
            <Th>الدرجة العلمية</Th>
            <Th>سنة التخرج</Th>
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
                {showScopeColumn && (
                  <Td>
                    <span className="block font-medium text-ink-900">
                      {r.facultyNameAr}
                    </span>
                    <span className="mt-0.5 block text-ink-500">
                      {r.specializationNameAr}
                    </span>
                  </Td>
                )}
                <Td>
                  <MultiValueCell
                    values={r.committees.map(labelForCommittee)}
                  />
                </Td>
                <Td>{formatIsoDate(r.header.applicationStart)}</Td>
                <Td>{formatIsoDate(r.header.applicationEnd)}</Td>
                <Td>{formatIsoDate(r.header.ageReferenceDate)}</Td>
                <Td>
                  <MultiValueCell
                    values={r.maritalStatus.map(labelForMarital)}
                  />
                </Td>
                <Td>
                  <MultiValueCell values={r.type.map(labelForType)} />
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
                <Td>
                  <MultiValueCell
                    values={r.academicDegrees.map(labelForDegree)}
                  />
                </Td>
                <Td>
                  <MultiValueCell
                    values={r.graduationYears.map((y) =>
                      toEasternArabicNumerals(y),
                    )}
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

/** Build a candidate `LocalUniversityRow` from the form draft and run
 *  the overlap check against the supplied siblings. Returns the first
 *  overlapping sibling so the caller can name it in the toast. */
function previewUniversityOverlapForTarget(
  candidateId: string | null,
  categoryCode: string,
  spec: SpecKey,
  payload: GeneralRuleRowInput,
  siblings: readonly LocalUniversityRow[],
  gradeRank: ReadonlyMap<string, number>,
  header: LocalUniversityRow['header'] | undefined,
): { row: LocalUniversityRow; reason: OverlapReason } | null {
  const headerSnapshot: LocalUniversityRow['header'] = header ?? {
    applicationStart: '',
    applicationEnd: '',
    ageReferenceDate: '',
    graduationYears: [],
    maritalStatus: [],
    maxAge: null,
  };
  const candidate: LocalUniversityRow = {
    id: candidateId ?? '__candidate__',
    kind: 'university',
    categoryCode,
    header: headerSnapshot,
    facultyCode: spec.facultyCode,
    facultyNameAr: spec.facultyNameAr,
    specializationCode: spec.specializationCode,
    specializationNameAr: spec.specializationNameAr,
    type: [...payload.type],
    maritalStatus: [...headerSnapshot.maritalStatus],
    excellenceMode: payload.excellenceMode,
    grade: payload.grade,
    gradeMax: payload.gradeMax,
    scoreMin: payload.scoreMin,
    minScoreOperator: payload.minScoreOperator,
    scoreMax: payload.scoreMax,
    maxScoreOperator: payload.maxScoreOperator,
    academicDegrees: [...payload.academicDegrees],
    committees: payload.committee ? [payload.committee] : [],
    graduationYears: payload.graduationYear !== null ? [payload.graduationYear] : [],
  };
  const matches = findCandidateUniversityOverlaps(candidate, siblings, gradeRank);
  return matches[0] ?? null;
}

function overlapMessageFor(
  match: { row: LocalUniversityRow; reason: OverlapReason },
  target: SpecKey,
): string {
  const reasonLabel = OVERLAP_REASON_LABEL_AR[match.reason];
  const sameSpec =
    match.row.facultyCode === target.facultyCode &&
    match.row.specializationCode === target.specializationCode;
  const scope = sameSpec
    ? target.specializationNameAr
    : `${match.row.specializationNameAr} — ${match.row.facultyNameAr}`;
  return `لا يمكن حفظ الشرط: ${reasonLabel} مع شرط آخر في ${scope}.`;
}

/** Banner listing every detected overlap pair under one university
 *  category. The grid row tint already flags individual rows; this
 *  surfaces *which* rules collide and *why* so admins can fix the
 *  offending pair. */
interface UniversityOverlapBannerProps {
  pairs: readonly OverlapPair[];
  rows: readonly LocalUniversityRow[];
}

function UniversityOverlapBanner({
  pairs,
  rows,
}: UniversityOverlapBannerProps): JSX.Element | null {
  if (pairs.length === 0) return null;
  const rowById = new Map(rows.map((r) => [r.id, r] as const));
  const indexById = new Map(rows.map((r, idx) => [r.id, idx + 1] as const));
  const labelFor = (row: LocalUniversityRow): string =>
    `${row.specializationNameAr} — ${row.facultyNameAr}`;
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
              {`الشرط #${toEasternArabicNumerals(indexById.get(pair.aId) ?? 0)} (${labelFor(aRow)}) ↔ الشرط #${toEasternArabicNumerals(indexById.get(pair.bId) ?? 0)} (${labelFor(bRow)}) — ${OVERLAP_REASON_LABEL_AR[pair.reason]}`}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
