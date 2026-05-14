/**
 * GeneralRulesSection — «قواعد عامة» sub-section under «الضباط المتخصصون».
 *
 * Composed of:
 *   1. Header — bounded dates + top-level graduation years (shared state).
 *   2. Faculty / Specialization accordion (Radix, type="multiple").
 *      Each specialization panel hosts its own «القواعد العامة» form and
 *      a local grid of rows the admin has added but not yet approved.
 *   3. «اعتماد» button — promotes every local row across all specializations
 *      into the committees view (shared Zustand slice) and clears local.
 *
 * The faculties and specializations come from the existing lookup
 * catalogue (`useLookup('faculties')` / `useLookup('specializations')`);
 * filtered by `isActive === true`. No new query layer is introduced.
 */

import { useMemo, useState } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  Checkbox,
  DatePicker,
  EmptyState,
  ErrorState,
  LoadingState,
  MultiSelect,
  Select,
  toast,
} from '@/shared/components';
import type { ComboboxOption } from '@/shared/components';
import { useLookup } from '@/features/lookups';
import { useCommittees } from '@/features/committees/api/committee.queries';
import { deriveCommitteeGender } from '@/shared/lib/committee-gender';
import { num } from '@/shared/lib/format';
import {
  useAdmissionSetupWizardStore,
  type GeneralRuleRowInput,
  type LocalGeneralRuleRow,
} from '../../store/wizardSharedState';

/* ── Static option sets ──────────────────────────────────────────────
 * النوع is per-row gender (ذكر/أنثى). Academic degrees are a fixed
 * multi-checkbox set. Graduation years cover the last 5 years inclusive
 * of the current calendar year. Marital status + التقدير come from the
 * lookup catalogue. */

const GENDER_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'male', label: 'ذكر' },
  { value: 'female', label: 'أنثى' },
];

/**
 * Shape of a committee option flowing down the accordion. Carries
 * `gender` so the per-spec form can filter the اللجنة list against the
 * selected النوع. The runtime source is `Committee[]` from the
 * committees feature; this is the projection the inner components see.
 */
interface CommitteeOption {
  id: string;
  name: string;
  /** Derived from the committee's name via `deriveCommitteeGender` —
   *  optional because some upstream committees may predate the helper;
   *  the per-spec filter falls back to the helper at the call site. */
  gender?: 'male' | 'female' | 'any';
}

const CURRENT_YEAR = new Date().getFullYear();
const GRADUATION_YEAR_OPTIONS: ReadonlyArray<ComboboxOption> = Array.from(
  { length: 5 },
  (_, i) => {
    const y = CURRENT_YEAR - i;
    return { value: String(y), label: String(y) };
  },
);

/** Code of the «الضباط المتخصصون» applicant-category. The «اللجنة»
 *  multi-checkbox is scoped to committees with this `categoryKey` so
 *  the picker stays focused on the active section. */
const SPECIALIZED_OFFICERS_KEY = 'specialized_officers';

export function GeneralRulesSection(): JSX.Element {
  const facultiesQuery = useLookup('faculties');
  const specializationsQuery = useLookup('specializations');
  const maritalQuery = useLookup('marital-statuses');
  const gradesQuery = useLookup('academic-grades');
  const degreesQuery = useLookup('academic-degrees');
  const committeesQuery = useCommittees();

  const approveLocal = useAdmissionSetupWizardStore((s) => s.approveLocal);
  const localCount = useAdmissionSetupWizardStore((s) => s.local.length);

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

  const activeFaculties = useMemo(
    () => (facultiesQuery.data ?? []).filter((f) => f.isActive),
    [facultiesQuery.data],
  );

  const activeSpecializationsByFaculty = useMemo(() => {
    const map = new Map<string, Array<{ code: string; name: string }>>();
    for (const s of specializationsQuery.data ?? []) {
      if (!s.isActive) continue;
      const list = map.get(s.facultyCode);
      if (list) list.push({ code: s.code, name: s.name });
      else map.set(s.facultyCode, [{ code: s.code, name: s.name }]);
    }
    return map;
  }, [specializationsQuery.data]);

  const maritalOptions = useMemo<Array<{ value: string; label: string }>>(
    () =>
      (maritalQuery.data ?? [])
        .filter((m) => m.isActive)
        .map((m) => ({ value: m.code, label: m.name })),
    [maritalQuery.data],
  );

  const gradeOptions = useMemo<Array<{ value: string; label: string }>>(
    () =>
      (gradesQuery.data ?? [])
        .filter((g) => g.isActive)
        .map((g) => ({ value: g.code, label: g.name })),
    [gradesQuery.data],
  );

  const degreeOptions = useMemo<Array<{ value: string; label: string }>>(
    () =>
      (degreesQuery.data ?? [])
        .filter((d) => d.isActive)
        .map((d) => ({ value: d.code, label: d.name })),
    [degreesQuery.data],
  );

  /* Committees are scoped to the «الضباط المتخصصون» category. النوع is
   * gender now and no longer gates this list. */
  const committeeOptions = useMemo(
    () =>
      (committeesQuery.data ?? []).filter(
        (c) => !c.deletedAt && c.categoryKey === SPECIALIZED_OFFICERS_KEY,
      ),
    [committeesQuery.data],
  );

  const handleApprove = (): void => {
    const moved = approveLocal();
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
        title="تعذر تحميل بيانات الكليات والتخصصات"
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
            عيّن نطاق التقديم وقواعد القبول لكل تخصص نشط.
          </p>
        </div>
      </header>

      <TopFields />

      <div className="mt-4">
        {activeFaculties.length === 0 ? (
          <EmptyState
            variant="generic"
            title="لا توجد كليات نشطة"
            description="فعّل كلية واحدة على الأقل من قائمة المراجع."
          />
        ) : (
          <Accordion.Root
            type="multiple"
            dir="rtl"
            className="flex flex-col gap-2"
          >
            {activeFaculties.map((faculty) => {
              const specs = activeSpecializationsByFaculty.get(faculty.code) ?? [];
              return (
                <FacultyItem
                  key={faculty.code}
                  facultyCode={faculty.code}
                  facultyNameAr={faculty.name}
                  specializations={specs}
                  maritalOptions={maritalOptions}
                  gradeOptions={gradeOptions}
                  degreeOptions={degreeOptions}
                  committeeOptions={committeeOptions}
                />
              );
            })}
          </Accordion.Root>
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

/* ── Top fields ──────────────────────────────────────────────────── */

function TopFields(): JSX.Element {
  const header = useAdmissionSetupWizardStore((s) => s.header);
  const setHeaderField = useAdmissionSetupWizardStore((s) => s.setHeaderField);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <FieldLabel label="بداية التقديم">
        <DatePicker
          value={isoToDate(header.applicationStart)}
          onChange={(d) => setHeaderField('applicationStart', dateToIso(d))}
          placeholder="اختر اليوم…"
        />
      </FieldLabel>
      <FieldLabel label="نهاية التقديم">
        <DatePicker
          value={isoToDate(header.applicationEnd)}
          onChange={(d) => setHeaderField('applicationEnd', dateToIso(d))}
          placeholder="اختر اليوم…"
        />
      </FieldLabel>
      <FieldLabel label="تاريخ احتساب السن">
        <DatePicker
          value={isoToDate(header.ageReferenceDate)}
          onChange={(d) => setHeaderField('ageReferenceDate', dateToIso(d))}
          placeholder="اختر اليوم…"
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
  htmlFor?: string;
  children: React.ReactNode;
}

function FieldLabel({ label, htmlFor, children }: FieldLabelProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={htmlFor}
        className="font-ar text-xs font-medium text-ink-700"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

/* ── Faculty accordion item ──────────────────────────────────────── */

interface FacultyItemProps {
  facultyCode: string;
  facultyNameAr: string;
  specializations: Array<{ code: string; name: string }>;
  maritalOptions: ReadonlyArray<{ value: string; label: string }>;
  gradeOptions: ReadonlyArray<{ value: string; label: string }>;
  degreeOptions: ReadonlyArray<{ value: string; label: string }>;
  committeeOptions: ReadonlyArray<CommitteeOption>;
}

function FacultyItem({
  facultyCode,
  facultyNameAr,
  specializations,
  maritalOptions,
  gradeOptions,
  degreeOptions,
  committeeOptions,
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
        ) : (
          <Accordion.Root type="multiple" dir="rtl" className="flex flex-col gap-2">
            {specializations.map((spec) => (
              <SpecializationItem
                key={spec.code}
                facultyCode={facultyCode}
                facultyNameAr={facultyNameAr}
                specializationCode={spec.code}
                specializationNameAr={spec.name}
                maritalOptions={maritalOptions}
                gradeOptions={gradeOptions}
                degreeOptions={degreeOptions}
                committeeOptions={committeeOptions}
              />
            ))}
          </Accordion.Root>
        )}
      </Accordion.Content>
    </Accordion.Item>
  );
}

/* ── Specialization accordion item ───────────────────────────────── */

interface SpecializationItemProps {
  facultyCode: string;
  facultyNameAr: string;
  specializationCode: string;
  specializationNameAr: string;
  maritalOptions: ReadonlyArray<{ value: string; label: string }>;
  gradeOptions: ReadonlyArray<{ value: string; label: string }>;
  degreeOptions: ReadonlyArray<{ value: string; label: string }>;
  committeeOptions: ReadonlyArray<CommitteeOption>;
}

function SpecializationItem({
  facultyCode,
  facultyNameAr,
  specializationCode,
  specializationNameAr,
  maritalOptions,
  gradeOptions,
  degreeOptions,
  committeeOptions,
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
        <SpecializationPanel
          facultyCode={facultyCode}
          facultyNameAr={facultyNameAr}
          specializationCode={specializationCode}
          specializationNameAr={specializationNameAr}
          maritalOptions={maritalOptions}
          gradeOptions={gradeOptions}
          degreeOptions={degreeOptions}
          committeeOptions={committeeOptions}
        />
      </Accordion.Content>
    </Accordion.Item>
  );
}

/* ── القواعد العامة form + per-spec grid ─────────────────────────── */

interface SpecializationPanelProps extends SpecializationItemProps {}

const EMPTY_INPUT: GeneralRuleRowInput = {
  type: [],
  maritalStatus: [],
  grade: '',
  academicDegrees: [],
  committees: [],
  graduationYears: [],
};

function SpecializationPanel({
  facultyCode,
  facultyNameAr,
  specializationCode,
  specializationNameAr,
  maritalOptions,
  gradeOptions,
  degreeOptions,
  committeeOptions,
}: SpecializationPanelProps): JSX.Element {
  const [draft, setDraft] = useState<GeneralRuleRowInput>(EMPTY_INPUT);

  const addLocalRow = useAdmissionSetupWizardStore((s) => s.addLocalRow);
  const removeLocalRow = useAdmissionSetupWizardStore((s) => s.removeLocalRow);
  const rows = useAdmissionSetupWizardStore((s) =>
    s.local.filter(
      (r) =>
        r.facultyCode === facultyCode &&
        r.specializationCode === specializationCode,
    ),
  );

  /**
   * Committees visible in the اللجنة CheckboxGroup honour the selected
   * النوع. النوع is a multi-select (`string[]`) — a committee passes
   * the filter when its derived gender is included in the picked set,
   * or when nothing is picked (empty array = "any"). We read the
   * committee's `gender` field when present (set by the seed and the
   * create form via `deriveCommitteeGender`) and fall back to the same
   * helper when missing so the "طالبات" check has exactly one
   * implementation across the app.
   *
   * Memoised against `(committeeOptions, draft.type)`. Stale picks that
   * no longer match the filter are deselected in the النوع onChange
   * handler below so `draft.committees` stays in sync with the visible
   * options without a useEffect.
   */
  const filteredCommitteeOptions = useMemo(() => {
    if (draft.type.length === 0) return committeeOptions;
    const allowed = new Set(draft.type);
    return committeeOptions.filter((c) =>
      allowed.has(c.gender ?? deriveCommitteeGender(c.name)),
    );
  }, [committeeOptions, draft.type]);

  const isGenderFilterActive = draft.type.length > 0;
  const isFilteredCommitteeListEmpty =
    isGenderFilterActive && filteredCommitteeOptions.length === 0;

  /**
   * Event-driven reconciliation of stale committee picks when النوع
   * changes. Computes the next filter inline (the
   * `filteredCommitteeOptions` memo still uses the previous `draft.type`
   * until the state batch lands) and trims `draft.committees` to ids
   * present in the new list. No confirmation modal — the dropdown
   * visibly updates.
   */
  const handleGenderChange = (nextType: string[]): void => {
    setDraft((d) => {
      const nextAllowed =
        nextType.length > 0
          ? new Set(
              committeeOptions
                .filter((c) =>
                  nextType.includes(c.gender ?? deriveCommitteeGender(c.name)),
                )
                .map((c) => c.id),
            )
          : null;
      const nextCommittees = nextAllowed
        ? d.committees.filter((id) => nextAllowed.has(id))
        : d.committees;
      return { ...d, type: nextType, committees: nextCommittees };
    });
  };

  const canAdd =
    draft.type.length > 0 &&
    draft.maritalStatus.length > 0 &&
    draft.grade.length > 0 &&
    draft.academicDegrees.length > 0 &&
    draft.committees.length > 0 &&
    draft.graduationYears.length > 0;

  const handleAdd = (): void => {
    if (!canAdd) return;
    addLocalRow(
      { facultyCode, facultyNameAr, specializationCode, specializationNameAr },
      draft,
    );
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
              onChange={handleGenderChange}
              options={GENDER_OPTIONS}
              placeholder="اختر النوع…"
            />
          </FieldLabel>

          <FieldLabel label="الحالة الاجتماعية">
            <MultiSelect
              ariaLabel="الحالة الاجتماعية"
              value={draft.maritalStatus}
              onChange={(next) =>
                setDraft((d) => ({ ...d, maritalStatus: next }))
              }
              options={maritalOptions}
              placeholder="اختر الحالة الاجتماعية…"
            />
          </FieldLabel>

          <FieldLabel label="الحد الأدنى للتقدير">
            <Select
              aria-label="الحد الأدنى للتقدير"
              value={draft.grade}
              onChange={(e) =>
                setDraft((d) => ({ ...d, grade: e.target.value }))
              }
              options={[{ value: '', label: 'اختر…' }, ...gradeOptions]}
            />
          </FieldLabel>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <FieldLabel label="الدرجة العلمية">
            {degreeOptions.length === 0 ? (
              <p className="font-ar text-2xs text-ink-500">
                لا توجد درجات علمية مفعّلة في المراجع.
              </p>
            ) : (
              <CheckboxGroup
                options={degreeOptions}
                value={draft.academicDegrees}
                onChange={(next) =>
                  setDraft((d) => ({ ...d, academicDegrees: next }))
                }
              />
            )}
          </FieldLabel>

          <FieldLabel label="اللجنة">
            {committeeOptions.length === 0 ? (
              <p className="font-ar text-2xs text-ink-500">
                لا توجد لجان مرتبطة بفئة «الضباط المتخصصون».
              </p>
            ) : isFilteredCommitteeListEmpty ? (
              <p
                className="rounded-md border border-dashed border-border-subtle bg-ink-50/40 px-3 py-2 font-ar text-2xs text-ink-500"
                aria-live="polite"
              >
                لا توجد لجان متاحة لهذا النوع
              </p>
            ) : (
              <CheckboxGroup
                options={filteredCommitteeOptions.map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
                value={draft.committees}
                onChange={(next) =>
                  setDraft((d) => ({ ...d, committees: next }))
                }
              />
            )}
          </FieldLabel>

          <FieldLabel label="سنة التخرج">
            <CheckboxGroup
              options={GRADUATION_YEAR_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
              }))}
              value={draft.graduationYears.map(String)}
              onChange={(next) =>
                setDraft((d) => ({
                  ...d,
                  graduationYears: next
                    .map((v) => Number(v))
                    .filter((n) => Number.isFinite(n)),
                }))
              }
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

      <LocalRulesGrid
        rows={rows}
        maritalOptions={maritalOptions}
        gradeOptions={gradeOptions}
        degreeOptions={degreeOptions}
        committeeOptions={committeeOptions}
        onDelete={(id) => removeLocalRow(id)}
      />
    </div>
  );
}

/* ── CheckboxGroup primitive ─────────────────────────────────────── *
 * Wrap-friendly multi-checkbox built on the shared <Checkbox /> Radix
 * wrapper. Lives inside this section because it is one-shot — promote
 * to shared/ only if a third caller appears. */

interface CheckboxGroupProps {
  options: ReadonlyArray<{ value: string; label: string }>;
  value: readonly string[];
  onChange: (next: string[]) => void;
}

function CheckboxGroup({
  options,
  value,
  onChange,
}: CheckboxGroupProps): JSX.Element {
  const selected = new Set(value);

  const toggle = (v: string): void => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(Array.from(next));
  };

  if (options.length === 0) {
    return <p className="font-ar text-2xs text-ink-500">لا توجد خيارات.</p>;
  }

  return (
    <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-md border border-border-subtle bg-surface-card p-2">
      {options.map((opt) => (
        <Checkbox
          key={opt.value}
          checked={selected.has(opt.value)}
          onCheckedChange={() => toggle(opt.value)}
          label={opt.label}
        />
      ))}
    </div>
  );
}

/* ── Per-specialization local grid ───────────────────────────────── */

interface LocalRulesGridProps {
  rows: LocalGeneralRuleRow[];
  maritalOptions: ReadonlyArray<{ value: string; label: string }>;
  gradeOptions: ReadonlyArray<{ value: string; label: string }>;
  degreeOptions: ReadonlyArray<{ value: string; label: string }>;
  committeeOptions: ReadonlyArray<CommitteeOption>;
  onDelete: (id: string) => void;
}

function LocalRulesGrid({
  rows,
  maritalOptions,
  gradeOptions,
  degreeOptions,
  committeeOptions,
  onDelete,
}: LocalRulesGridProps): JSX.Element {
  const labelForType = (v: string): string =>
    GENDER_OPTIONS.find((o) => o.value === v)?.label ?? v;
  const labelForTypes = (values: readonly string[]): string =>
    values.length === 0 ? '—' : values.map(labelForType).join('، ');
  const labelForMarital = (v: string): string =>
    maritalOptions.find((o) => o.value === v)?.label ?? v;
  const labelForMaritals = (values: readonly string[]): string =>
    values.length === 0 ? '—' : values.map(labelForMarital).join('، ');
  const labelForGrade = (v: string): string =>
    gradeOptions.find((o) => o.value === v)?.label ?? v;
  const labelForDegree = (v: string): string =>
    degreeOptions.find((o) => o.value === v)?.label ?? v;
  const labelForCommittee = (id: string): string =>
    committeeOptions.find((c) => c.id === id)?.name ?? id;

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
            <Th>الحالة الاجتماعية</Th>
            <Th>الحد الأدنى للتقدير</Th>
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
              <Td>{labelForTypes(r.type)}</Td>
              <Td>{labelForMaritals(r.maritalStatus)}</Td>
              <Td>{labelForGrade(r.grade)}</Td>
              <Td>{r.academicDegrees.map(labelForDegree).join('، ')}</Td>
              <Td>
                {r.committees.map((id) => labelForCommittee(id)).join('، ')}
              </Td>
              <Td>{r.graduationYears.map((y) => num(y)).join('، ')}</Td>
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
