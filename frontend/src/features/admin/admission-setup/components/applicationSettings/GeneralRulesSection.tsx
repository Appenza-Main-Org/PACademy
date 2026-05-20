/**
 * GeneralRulesSection — «الشروط العامة» editor for one
 * university (`type === 'university'`) applicant-category.
 *
 * Layout
 * ------
 *  1. Section header — application dates + الحالة الاجتماعية + top-level
 *     graduation years (kept per-category in the wizard store).
 *  2. Faculty + specialization tree — rendered per the V2 accordion rule:
 *       • 1 faculty + 1 specialization → flat (no accordion).
 *       • 1 faculty + N specializations → accordion over specializations.
 *       • N faculties → accordion per faculty (each pane recurses into a
 *         per-specialization accordion when the faculty has >1 specs).
 *     The same component tree is used for every university category;
 *     the brief explicitly asked for the «الضباط المتخصصون» pattern to be
 *     generalised here.
 *  3. «اعتماد» — promotes every local row authored under this category
 *     into the «عرض» tab via the shared wizard store.
 *
 * Single-select fields use the shared `SearchSelect` primitive
 * (Radix-backed). NO multi-select committee/degree picker remains —
 * single-select per the V2 brief.
 *
 * Duplicate rows are blocked at the store boundary (composite key over
 * every combination field). The form surfaces a danger toast when the
 * store rejects.
 */

import { useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, Pencil, Trash2, X } from 'lucide-react';
import {
  Accordion,
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
import type { RadixSelectOption, SearchSelectOption } from '@/shared/components';
import { useLookup } from '@/features/lookups';
import { date as fmtDate, num } from '@/shared/lib/format';
import { toEasternArabicNumerals } from '@/shared/lib/arabic';
import type { ExcellenceMode } from '../../lib/excellenceMode';
import {
  DEFAULT_MAX_SCORE_OPERATOR,
  DEFAULT_MIN_SCORE_OPERATOR,
  useAdmissionSetupWizardStore,
  type GeneralRuleRowInput,
  type LocalUniversityRow,
  type MaxScoreOperator,
  type MinScoreOperator,
} from '../../store/wizardSharedState';
import { OperatorScoreField } from './OperatorScoreField';

/* ── Static option sets ───────────────────────────────────────────── */

const GENDER_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'male', label: 'ذكر' },
  { value: 'female', label: 'أنثى' },
];

const EMPTY_INPUT: GeneralRuleRowInput = {
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
  const facultiesQuery = useLookup('faculties');
  const specializationsQuery = useLookup('specializations');
  const maritalQuery = useLookup('marital-statuses');
  const gradesQuery = useLookup('academic-grades');
  const degreesQuery = useLookup('academic-degrees');
  const committeesQuery = useLookup('committees');
  const graduationYearsQuery = useLookup('graduation-years');

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

  /* ─── Faculty/spec accordion-rule rendering ───────────────────── */

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

  let tree: JSX.Element;
  if (scopedFaculties.length === 0) {
    tree = (
      <EmptyState
        variant="generic"
        title="لا توجد كليات مرتبطة بهذه الفئة"
        description="فعّل كلية واحدة على الأقل أو اضبط نطاق الفئة في الأكواد المرجعية."
      />
    );
  } else if (scopedFaculties.length === 1) {
    const faculty = scopedFaculties[0]!;
    const specs = specsByFaculty.get(faculty.code) ?? [];
    if (specs.length === 0) {
      tree = (
        <EmptyState
          variant="generic"
          title="لا توجد تخصصات نشطة في هذه الكلية"
          description="فعّل تخصصاً واحداً على الأقل من الأكواد المرجعية."
        />
      );
    } else if (specs.length === 1) {
      /* 1F + 1S → flat. No accordion at all. */
      const spec = specs[0]!;
      tree = (
        <Card variant="compact">
          <SpecHeader
            facultyNameAr={faculty.name}
            specializationNameAr={spec.name}
          />
          <PerSpecForm
            facultyCode={faculty.code}
            facultyNameAr={faculty.name}
            specializationCode={spec.code}
            specializationNameAr={spec.name}
            options={formOptions}
          />
        </Card>
      );
    } else {
      /* 1F + NS → accordion for specializations only. */
      tree = (
        <Accordion.Root type="multiple" dir="rtl" className="flex flex-col gap-2">
          {specs.map((spec) => (
            <SpecializationItem
              key={spec.code}
              isFilled={filledSpecCodes.has(spec.code)}
              facultyCode={faculty.code}
              facultyNameAr={faculty.name}
              specializationCode={spec.code}
              specializationNameAr={spec.name}
              options={formOptions}
            />
          ))}
        </Accordion.Root>
      );
    }
  } else {
    /* >1 faculties → accordion per faculty, each one drilling into a
     * specialization accordion. */
    tree = (
      <Accordion.Root type="multiple" dir="rtl" className="flex flex-col gap-2">
        {scopedFaculties.map((faculty) => (
          <FacultyItem
            key={faculty.code}
            facultyCode={faculty.code}
            facultyNameAr={faculty.name}
            specializations={specsByFaculty.get(faculty.code) ?? []}
            isFilled={filledFacultyCodes.has(faculty.code)}
            filledSpecCodes={filledSpecCodes}
            options={formOptions}
          />
        ))}
      </Accordion.Root>
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
            عيّن نطاق التقديم، الحالة الاجتماعية، وشروط اللجنة لكل تخصص نشط.
          </p>
        </div>
      </header>

      <TopFields categoryCode={categoryCode} maritalOptions={maritalOptions} />

      <div className="mt-4">{tree}</div>

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

interface TopFieldsProps {
  categoryCode: string;
  maritalOptions: ReadonlyArray<{ value: string; label: string }>;
}

function TopFields({ categoryCode, maritalOptions }: TopFieldsProps): JSX.Element {
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

/* ── Faculty accordion item ───────────────────────────────────────── */

interface FacultyItemProps {
  facultyCode: string;
  facultyNameAr: string;
  specializations: Array<{ code: string; name: string }>;
  /** `true` when at least one specialization under this faculty has an
   *  authored row (local or approved) — drives the highlighted header
   *  treatment so the admin can spot configured faculties at a glance. */
  isFilled: boolean;
  /** Specialization codes that have authored rows — passed through to
   *  the nested per-spec accordion so its items can highlight too. */
  filledSpecCodes: ReadonlySet<string>;
  options: PerSpecFormOptions;
}

function FacultyItem({
  facultyCode,
  facultyNameAr,
  specializations,
  isFilled,
  filledSpecCodes,
  options,
}: FacultyItemProps): JSX.Element {
  return (
    <Accordion.Item
      value={facultyCode}
      className={
        isFilled
          ? 'rounded-md border border-teal-200 bg-teal-50/40'
          : 'rounded-md border border-border-subtle bg-surface'
      }
    >
      <Accordion.Header className="flex">
        <Accordion.Trigger className="group flex w-full items-center justify-between gap-3 px-3 py-2 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
          <span className="inline-flex items-center gap-2 font-ar text-sm font-medium text-ink-900">
            <ChevronDown
              size={14}
              strokeWidth={1.75}
              className="text-ink-500 transition-transform duration-fast group-data-[state=closed]:rotate-180"
              aria-hidden
            />
            {facultyNameAr}
          </span>
          <span className="inline-flex items-center gap-1.5 font-ar text-2xs text-ink-500">
            {isFilled && (
              <CheckCircle2
                size={12}
                strokeWidth={2}
                className="text-teal-600"
                aria-label="تحتوي على شروط محفوظة"
              />
            )}
            <span>{num(specializations.length)} تخصص نشط</span>
          </span>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content
        className={
          isFilled
            ? 'border-t border-teal-200 bg-ink-50/30 px-3 py-3'
            : 'border-t border-border-subtle bg-ink-50/30 px-3 py-3'
        }
      >
        {specializations.length === 0 ? (
          <p className="font-ar text-xs text-ink-500">
            لا توجد تخصصات نشطة في هذه الكلية.
          </p>
        ) : specializations.length === 1 ? (
          <PerSpecForm
            facultyCode={facultyCode}
            facultyNameAr={facultyNameAr}
            specializationCode={specializations[0]!.code}
            specializationNameAr={specializations[0]!.name}
            options={options}
          />
        ) : (
          <Accordion.Root type="multiple" dir="rtl" className="flex flex-col gap-2">
            {specializations.map((spec) => (
              <SpecializationItem
                key={spec.code}
                facultyCode={facultyCode}
                facultyNameAr={facultyNameAr}
                specializationCode={spec.code}
                specializationNameAr={spec.name}
                isFilled={filledSpecCodes.has(spec.code)}
                options={options}
              />
            ))}
          </Accordion.Root>
        )}
      </Accordion.Content>
    </Accordion.Item>
  );
}

/* ── Specialization accordion item ────────────────────────────────── */

interface SpecializationItemProps {
  facultyCode: string;
  facultyNameAr: string;
  specializationCode: string;
  specializationNameAr: string;
  /** `true` when this specialization has at least one authored row
   *  (local or approved) — drives the highlighted header treatment. */
  isFilled: boolean;
  options: PerSpecFormOptions;
}

function SpecializationItem({
  facultyCode,
  facultyNameAr,
  specializationCode,
  specializationNameAr,
  isFilled,
  options,
}: SpecializationItemProps): JSX.Element {
  const value = `${facultyCode}::${specializationCode}`;
  return (
    <Accordion.Item
      value={value}
      className={
        isFilled
          ? 'rounded-md border border-teal-200 bg-teal-50/40'
          : 'rounded-md border border-border-subtle bg-surface-card'
      }
    >
      <Accordion.Header className="flex">
        <Accordion.Trigger className="group flex w-full items-center justify-between gap-3 px-3 py-2 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
          <span className="inline-flex items-center gap-2 font-ar text-sm text-ink-900">
            <ChevronDown
              size={14}
              strokeWidth={1.75}
              className="text-ink-500 transition-transform duration-fast group-data-[state=closed]:rotate-180"
              aria-hidden
            />
            {specializationNameAr}
          </span>
          {isFilled && (
            <CheckCircle2
              size={12}
              strokeWidth={2}
              className="text-teal-600"
              aria-label="تحتوي على شروط محفوظة"
            />
          )}
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content
        className={
          isFilled
            ? 'border-t border-teal-200 px-3 py-3'
            : 'border-t border-border-subtle px-3 py-3'
        }
      >
        <PerSpecForm
          facultyCode={facultyCode}
          facultyNameAr={facultyNameAr}
          specializationCode={specializationCode}
          specializationNameAr={specializationNameAr}
          options={options}
        />
      </Accordion.Content>
    </Accordion.Item>
  );
}

function SpecHeader({
  facultyNameAr,
  specializationNameAr,
}: {
  facultyNameAr: string;
  specializationNameAr: string;
}): JSX.Element {
  return (
    <div className="mb-3 flex items-center gap-2 font-ar text-sm text-ink-700">
      <span className="font-medium text-ink-900">{facultyNameAr}</span>
      <span className="text-ink-400">·</span>
      <span>{specializationNameAr}</span>
    </div>
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
}

function rowToUniversityInput(r: LocalUniversityRow): GeneralRuleRowInput {
  return {
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

function PerSpecForm({
  facultyCode,
  facultyNameAr,
  specializationCode,
  specializationNameAr,
  options,
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
  /* `null` (criterion not picked) keeps both pairs visible so admins
   * can still fill the row in until they assign a criterion. */
  const showGradePair = excellenceMode !== 'GRADES';
  const showScorePair = excellenceMode !== 'TAGDIR';
  const [draft, setDraft] = useState<GeneralRuleRowInput>(EMPTY_INPUT);
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
  const rows = useMemo(
    () =>
      [...localRows, ...approvedRows].filter(
        (r): r is LocalUniversityRow =>
          r.kind === 'university' &&
          r.categoryCode === categoryCode &&
          r.facultyCode === facultyCode &&
          r.specializationCode === specializationCode,
      ),
    [localRows, approvedRows, categoryCode, facultyCode, specializationCode],
  );
  const handleDelete = (id: string): void => {
    removeLocalRow(id);
    removeApprovedRow(id);
  };

  /** The row currently being edited, scoped to *this* form: must be a
   *  university row under the same (category, faculty, specialization)
   *  triple. Editing a row in another scope drops this form back into
   *  add-mode without losing the user's place in the wizard. */
  const editingRow = useAdmissionSetupWizardStore((s) => {
    if (s.editingRowId === null) return null;
    const r =
      s.local.find((x) => x.id === s.editingRowId) ??
      s.approved.find((x) => x.id === s.editingRowId);
    if (
      !r ||
      r.kind !== 'university' ||
      r.categoryCode !== categoryCode ||
      r.facultyCode !== facultyCode ||
      r.specializationCode !== specializationCode
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
    setDraft(editingRow ? rowToUniversityInput(editingRow) : EMPTY_INPUT);
  }

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
    isHeaderComplete &&
    draft.type.length > 0 &&
    gradePairOk &&
    scorePairOk &&
    draft.academicDegrees.length > 0 &&
    draft.committee.length > 0 &&
    draft.graduationYear !== null;

  const spec = {
    facultyCode,
    facultyNameAr,
    specializationCode,
    specializationNameAr,
  };

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

  const handleSubmit = (): void => {
    if (!canSubmit) return;
    const payload = normalizeForSubmit(draft);
    if (isEditing && editingId !== null) {
      const result = updateUniversityRow(editingId, spec, payload);
      if (!result.ok) {
        toast(
          result.reason === 'duplicate'
            ? 'هذا الشرط موجود بالفعل بنفس البيانات'
            : 'تعذر تعديل الشرط',
          'danger',
        );
        return;
      }
      setDraft(EMPTY_INPUT);
      toast('تم تعديل الشرط', 'success');
      return;
    }
    const result = addUniversityRow(categoryCode, spec, payload);
    if (!result.ok) {
      toast('هذا الشرط موجود بالفعل بنفس البيانات', 'danger');
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

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <FieldLabel label="النوع" required>
            <MultiSelect
              ariaLabel="النوع"
              value={draft.type}
              onChange={(next) => setDraft((d) => ({ ...d, type: next }))}
              options={GENDER_OPTIONS}
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
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          {showScorePair && (
            <>
              <FieldLabel label="الحد الأدنى للدرجة (٪)" required>
                <OperatorScoreField<MinScoreOperator>
                  operatorValue={draft.minScoreOperator}
                  onOperatorChange={(v) =>
                    setDraft((d) => ({ ...d, minScoreOperator: v }))
                  }
                  operatorOptions={MIN_SCORE_OPERATOR_OPTIONS}
                  operatorAriaLabel="عملية المقارنة للحد الأدنى للدرجة"
                  scoreValue={draft.scoreMin}
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
                placeholder="اختر الدرجة العلمية…"
              />
            )}
          </FieldLabel>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
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

      <LocalUniversityGrid
        rows={rows}
        editingId={editingId}
        gradeOptions={gradeOptions}
        degreeOptions={degreeOptions}
        committeeOptions={committeeOptions}
        maritalOptions={options.maritalOptions}
        showGradePair={showGradePair}
        showScorePair={showScorePair}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
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
  /** Mirror the form's visibility — hides تقدير / درجة columns when the
   *  active criterion does not surface them. */
  showGradePair: boolean;
  showScorePair: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function LocalUniversityGrid({
  rows,
  editingId,
  gradeOptions,
  degreeOptions,
  committeeOptions,
  maritalOptions,
  showGradePair,
  showScorePair,
  onEdit,
  onDelete,
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

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border-subtle bg-ink-50/40 px-3 py-3 text-2xs text-ink-500">
        لم تُضف شروط لجان بعد لهذا التخصص.
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
            <Th>النوع</Th>
            {showGradePair && <Th>الحد الأدنى للتقدير</Th>}
            {showGradePair && <Th>الحد الأقصى للتقدير</Th>}
            {showScorePair && <Th>الحد الأدنى للدرجة</Th>}
            {showScorePair && <Th>الحد الأقصى للدرجة</Th>}
            <Th>الدرجة العلمية</Th>
            <Th>سنة التخرج</Th>
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
                {showGradePair && <Td>{labelForGrade(r.grade)}</Td>}
                {showGradePair && <Td>{labelForGrade(r.gradeMax)}</Td>}
                {showScorePair && (
                  <Td>
                    {r.scoreMin !== null
                      ? `${MIN_OPERATOR_SYMBOL[r.minScoreOperator ?? DEFAULT_MIN_SCORE_OPERATOR]} ${toEasternArabicNumerals(r.scoreMin)}٪`
                      : '—'}
                  </Td>
                )}
                {showScorePair && (
                  <Td>
                    {r.scoreMax !== null
                      ? `${MAX_OPERATOR_SYMBOL[r.maxScoreOperator ?? DEFAULT_MAX_SCORE_OPERATOR]} ${toEasternArabicNumerals(r.scoreMax)}٪`
                      : '—'}
                  </Td>
                )}
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
