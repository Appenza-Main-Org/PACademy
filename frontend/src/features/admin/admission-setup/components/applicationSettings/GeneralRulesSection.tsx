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

import { useMemo, useState } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
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
} from '@/shared/components';
import type { SearchSelectOption } from '@/shared/components';
import { useLookup } from '@/features/lookups';
import { num } from '@/shared/lib/format';
import { toEasternArabicNumerals } from '@/shared/lib/arabic';
import {
  useAdmissionSetupWizardStore,
  type GeneralRuleRowInput,
  type LocalUniversityRow,
} from '../../store/wizardSharedState';

/* ── Static option sets ───────────────────────────────────────────── */

const GENDER_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'male', label: 'ذكر' },
  { value: 'female', label: 'أنثى' },
];

const CURRENT_YEAR = new Date().getFullYear();
const GRADUATION_YEAR_OPTIONS: ReadonlyArray<SearchSelectOption> = Array.from(
  { length: 5 },
  (_, i) => {
    const y = CURRENT_YEAR - i;
    return { value: String(y), label: toEasternArabicNumerals(y) };
  },
);

const EMPTY_INPUT: GeneralRuleRowInput = {
  type: [],
  grade: '',
  gradeMax: '',
  scoreMin: null,
  scoreMax: null,
  academicDegree: '',
  committee: '',
  graduationYear: null,
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
}

export function GeneralRulesSection({
  categoryCode,
  facultyCodes,
  specializationCodes,
}: GeneralRulesSectionProps): JSX.Element {
  const facultiesQuery = useLookup('faculties');
  const specializationsQuery = useLookup('specializations');
  const maritalQuery = useLookup('marital-statuses');
  const gradesQuery = useLookup('academic-grades');
  const degreesQuery = useLookup('academic-degrees');
  const committeesQuery = useLookup('committees');

  const approve = useAdmissionSetupWizardStore((s) => s.approveLocalForCategory);
  const localCount = useAdmissionSetupWizardStore(
    (s) => s.local.filter((r) => r.categoryCode === categoryCode).length,
  );

  const isLoading =
    facultiesQuery.isLoading ||
    specializationsQuery.isLoading ||
    maritalQuery.isLoading ||
    gradesQuery.isLoading ||
    degreesQuery.isLoading ||
    committeesQuery.isLoading;

  const isError =
    facultiesQuery.isError ||
    specializationsQuery.isError ||
    maritalQuery.isError ||
    gradesQuery.isError ||
    degreesQuery.isError ||
    committeesQuery.isError;

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

  /* ─── Approve handler ─────────────────────────────────────────── */

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
          facultiesQuery.refetch();
          specializationsQuery.refetch();
          maritalQuery.refetch();
          gradesQuery.refetch();
          degreesQuery.refetch();
          committeesQuery.refetch();
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
            عيّن نطاق التقديم، الحالة الاجتماعية، وقواعد القبول لكل تخصص نشط.
          </p>
        </div>
      </header>

      <TopFields categoryCode={categoryCode} maritalOptions={maritalOptions} />

      <div className="mt-4">{tree}</div>

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

/* ── Faculty accordion item ───────────────────────────────────────── */

interface FacultyItemProps {
  facultyCode: string;
  facultyNameAr: string;
  specializations: Array<{ code: string; name: string }>;
  options: PerSpecFormOptions;
}

function FacultyItem({
  facultyCode,
  facultyNameAr,
  specializations,
  options,
}: FacultyItemProps): JSX.Element {
  return (
    <Accordion.Item
      value={facultyCode}
      className="rounded-md border border-border-subtle bg-surface"
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
          <span className="font-ar text-2xs text-ink-500">
            {num(specializations.length)} تخصص نشط
          </span>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="border-t border-border-subtle bg-ink-50/30 px-3 py-3">
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
  options: PerSpecFormOptions;
}

function SpecializationItem({
  facultyCode,
  facultyNameAr,
  specializationCode,
  specializationNameAr,
  options,
}: SpecializationItemProps): JSX.Element {
  const value = `${facultyCode}::${specializationCode}`;
  return (
    <Accordion.Item
      value={value}
      className="rounded-md border border-border-subtle bg-surface-card"
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
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="border-t border-border-subtle px-3 py-3">
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
}

interface PerSpecFormProps {
  facultyCode: string;
  facultyNameAr: string;
  specializationCode: string;
  specializationNameAr: string;
  options: PerSpecFormOptions;
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
  } = options;
  const [draft, setDraft] = useState<GeneralRuleRowInput>(EMPTY_INPUT);

  const addUniversityRow = useAdmissionSetupWizardStore(
    (s) => s.addUniversityRow,
  );
  const removeLocalRow = useAdmissionSetupWizardStore((s) => s.removeLocalRow);
  const rows = useAdmissionSetupWizardStore((s) =>
    s.local.filter(
      (r): r is LocalUniversityRow =>
        r.kind === 'university' &&
        r.categoryCode === categoryCode &&
        r.facultyCode === facultyCode &&
        r.specializationCode === specializationCode,
    ),
  );

  /* ─── Validation ─── */

  const gradeOrderInvalid =
    draft.grade !== '' &&
    draft.gradeMax !== '' &&
    (gradeRank.get(draft.gradeMax) ?? Infinity) <
      (gradeRank.get(draft.grade) ?? -Infinity);

  const scoreNegative =
    (draft.scoreMin !== null && draft.scoreMin < 0) ||
    (draft.scoreMax !== null && draft.scoreMax < 0);

  const scoreOrderInvalid =
    draft.scoreMin !== null &&
    draft.scoreMax !== null &&
    draft.scoreMax < draft.scoreMin;

  const canAdd =
    draft.type.length > 0 &&
    draft.grade.length > 0 &&
    draft.gradeMax.length > 0 &&
    !gradeOrderInvalid &&
    draft.scoreMin !== null &&
    draft.scoreMax !== null &&
    !scoreNegative &&
    !scoreOrderInvalid &&
    draft.academicDegree.length > 0 &&
    draft.committee.length > 0 &&
    draft.graduationYear !== null;

  const handleAdd = (): void => {
    if (!canAdd) return;
    const result = addUniversityRow(
      categoryCode,
      {
        facultyCode,
        facultyNameAr,
        specializationCode,
        specializationNameAr,
      },
      draft,
    );
    if (!result.ok) {
      toast('هذه القاعدة موجودة بالفعل بنفس البيانات', 'danger');
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
            شروط التخصص
          </h4>
        </header>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <FieldLabel label="النوع">
            <MultiSelect
              ariaLabel="النوع"
              value={draft.type}
              onChange={(next) => setDraft((d) => ({ ...d, type: next }))}
              options={GENDER_OPTIONS}
              placeholder="اختر النوع…"
            />
          </FieldLabel>

          <FieldLabel label="الحد الأدنى للتقدير">
            <SearchSelect
              ariaLabel="الحد الأدنى للتقدير"
              value={draft.grade || null}
              onChange={(v) => setDraft((d) => ({ ...d, grade: v ?? '' }))}
              options={gradeOptions}
              placeholder="اختر التقدير…"
            />
          </FieldLabel>

          <FieldLabel label="الحد الأقصى للتقدير">
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
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <FieldLabel label="الحد الأدنى للدرجة">
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              placeholder="مثال: ٦٠"
              value={draft.scoreMin ?? ''}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  scoreMin: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              error={
                draft.scoreMin !== null && draft.scoreMin < 0
                  ? 'الدرجة غير قابلة للسالب'
                  : undefined
              }
            />
          </FieldLabel>

          <FieldLabel label="الحد الأقصى للدرجة">
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              placeholder="مثال: ١٠٠"
              value={draft.scoreMax ?? ''}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  scoreMax: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              error={
                draft.scoreMax !== null && draft.scoreMax < 0
                  ? 'الدرجة غير قابلة للسالب'
                  : scoreOrderInvalid
                    ? 'يجب ألا تقل عن الحد الأدنى'
                    : undefined
              }
            />
          </FieldLabel>

          <FieldLabel label="الدرجة العلمية">
            {degreeOptions.length === 0 ? (
              <p className="font-ar text-2xs text-ink-500">
                لا توجد درجات علمية مفعّلة في المراجع.
              </p>
            ) : (
              <SearchSelect
                ariaLabel="الدرجة العلمية"
                value={draft.academicDegree || null}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, academicDegree: v ?? '' }))
                }
                options={degreeOptions}
                placeholder="اختر الدرجة العلمية…"
              />
            )}
          </FieldLabel>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <FieldLabel label="اللجنة">
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

      <LocalUniversityGrid
        rows={rows}
        gradeOptions={gradeOptions}
        degreeOptions={degreeOptions}
        committeeOptions={committeeOptions}
        onDelete={(id) => removeLocalRow(id)}
      />
    </div>
  );
}

/* ── Per-spec local rows grid ─────────────────────────────────────── */

interface LocalUniversityGridProps {
  rows: LocalUniversityRow[];
  gradeOptions: ReadonlyArray<SearchSelectOption>;
  degreeOptions: ReadonlyArray<SearchSelectOption>;
  committeeOptions: ReadonlyArray<SearchSelectOption>;
  onDelete: (id: string) => void;
}

function LocalUniversityGrid({
  rows,
  gradeOptions,
  degreeOptions,
  committeeOptions,
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

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border-subtle bg-ink-50/40 px-3 py-3 text-2xs text-ink-500">
        لم تُضف قواعد بعد لهذا التخصص.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border-subtle bg-surface-card">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-ink-50/80">
          <tr>
            <Th>النوع</Th>
            <Th>الحد الأدنى للتقدير</Th>
            <Th>الحد الأقصى للتقدير</Th>
            <Th>الحد الأدنى للدرجة</Th>
            <Th>الحد الأقصى للدرجة</Th>
            <Th>الدرجة العلمية</Th>
            <Th>اللجنة</Th>
            <Th>سنة التخرج</Th>
            <th className="px-3 py-2">
              <span className="sr-only">إجراءات</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border-subtle">
              <Td>{r.type.length === 0 ? '—' : r.type.map(labelForType).join('، ')}</Td>
              <Td>{labelForGrade(r.grade)}</Td>
              <Td>{labelForGrade(r.gradeMax)}</Td>
              <Td>
                {r.scoreMin !== null ? toEasternArabicNumerals(r.scoreMin) : '—'}
              </Td>
              <Td>
                {r.scoreMax !== null ? toEasternArabicNumerals(r.scoreMax) : '—'}
              </Td>
              <Td>
                {r.academicDegrees.length === 0
                  ? '—'
                  : r.academicDegrees.map(labelForDegree).join('، ')}
              </Td>
              <Td>
                {r.committees.length === 0
                  ? '—'
                  : r.committees.map(labelForCommittee).join('، ')}
              </Td>
              <Td>
                {r.graduationYears.length === 0
                  ? '—'
                  : r.graduationYears
                      .map((y) => toEasternArabicNumerals(y))
                      .join('، ')}
              </Td>
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
