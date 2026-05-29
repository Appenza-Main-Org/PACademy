/**
 * ApprovedCategoryCompositionsSummary — read-only summary of every
 * application-settings year row, grouped by applicant category. Shared
 * by:
 *
 *   • the pre-review wizard step (`application_settings_review`) that
 *     sits between `application_settings` and `review`.
 *   • the final `review` step — same section the admin sees before
 *     hitting «اعتماد ونشر».
 *
 * Prefers the selected cycle's wizard draft (`local` + `approved`) when
 * that draft exists, because the preceding `application_settings` step
 * persists its authored category conditions there. Falls back to the
 * committed app-settings tree only when the cycle draft is empty.
 *
 * One Card per applicant category that has saved settings:
 *
 *   • multi-axis configs (e.g. specialized_officers) render one
 *     sub-section per attached specialization, each followed by its own
 *     year-rows table.
 *   • singleAxis configs (officers_general, law_bachelor,
 *     physical_education_bachelor) render the year-rows table inline
 *     under the category header — the implicit-default junction has no
 *     user-facing specialization name.
 *
 * Each year row surfaces every field the admin entered:
 * graduation years · gender · marital status · maxAge · grade gate
 * (branched on TAGDIR vs GRADES) · application start / end · age
 * reference date · school category (only for officers_general).
 * Multi-value cells render as wrapping chip pills with a tooltip,
 * mirroring the YearTable contract.
 */

import { useMemo } from 'react';
import {
  Card,
  EmptyState,
  LoadingState,
  Tooltip,
  TooltipProvider,
} from '@/shared/components';
import { useLookup } from '@/features/lookups';
import { toEasternArabicNumerals } from '@/shared/lib/arabic';
import { date as fmtDate } from '@/shared/lib/format';
import {
  useApplicationSettingsSummary,
  useCategoryConfigs,
} from '../api/applicationSettings.queries';
import type {
  CategorySettingsSummary,
  YearGroupForReview,
} from '../api/applicationSettings.service';
import type {
  ApprovedGeneralRuleRow,
  GeneralRulesHeader,
  LocalGeneralRuleRow,
  LocalThanawiRow,
  LocalUniversityRow,
  MaxScoreOperator,
  MinScoreOperator,
} from '../store/wizardSharedState';
import {
  DEFAULT_MAX_SCORE_OPERATOR,
  DEFAULT_MIN_SCORE_OPERATOR,
  useAdmissionSetupWizardStore,
} from '../store/wizardSharedState';
import type { ApplicantSpecializationYear } from '../types';

const GENDER_LABEL: Readonly<Record<string, string>> = {
  male: 'ذكر',
  female: 'أنثى',
  both: 'ذكور وإناث',
  ذكر: 'ذكر',
  أنثى: 'أنثى',
};

export function ApprovedCategoryCompositionsSummary(): JSX.Element {
  const summaryQuery = useApplicationSettingsSummary();
  const configsQuery = useCategoryConfigs();
  const maritalQuery = useLookup('marital-statuses');
  const academicGradesQuery = useLookup('academic-grades');
  const academicDegreesQuery = useLookup('academic-degrees');
  const committeesQuery = useLookup('committees');
  const examRoundsQuery = useLookup('exam-rounds');
  const schoolCategoriesQuery = useLookup('school-categories');
  const localDraftRows = useAdmissionSetupWizardStore((state) => state.local);
  const approvedDraftRows = useAdmissionSetupWizardStore((state) => state.approved);
  const draftHeaders = useAdmissionSetupWizardStore((state) => state.headers);
  const draftRows = useMemo(
    () => [...localDraftRows, ...approvedDraftRows],
    [localDraftRows, approvedDraftRows],
  );
  const hasDraftData = draftRows.length > 0 || Object.keys(draftHeaders).length > 0;

  const isLoading =
    summaryQuery.isLoading ||
    configsQuery.isLoading ||
    maritalQuery.isLoading ||
    academicGradesQuery.isLoading ||
    academicDegreesQuery.isLoading ||
    committeesQuery.isLoading ||
    examRoundsQuery.isLoading ||
    schoolCategoriesQuery.isLoading;

  const labels = useMemo<LabelMaps>(
    () => ({
      marital: new Map((maritalQuery.data ?? []).map((r) => [r.code, r.name])),
      academicGrade: new Map(
        (academicGradesQuery.data ?? []).map((r) => [r.code, r.name]),
      ),
      academicDegree: new Map(
        (academicDegreesQuery.data ?? []).map((r) => [r.code, r.name]),
      ),
      committee: new Map(
        (committeesQuery.data ?? []).map((r) => [r.code, r.name]),
      ),
      examRound: new Map(
        (examRoundsQuery.data ?? []).map((r) => [r.code, r.name]),
      ),
      schoolCategory: new Map(
        (schoolCategoriesQuery.data ?? []).map((r) => [r.code, r.name]),
      ),
    }),
    [
      maritalQuery.data,
      academicGradesQuery.data,
      academicDegreesQuery.data,
      committeesQuery.data,
      examRoundsQuery.data,
      schoolCategoriesQuery.data,
    ],
  );
  if (isLoading) return <LoadingState variant="list" />;

  if (hasDraftData) {
    return (
      <TooltipProvider delayDuration={120}>
        <DraftCompositionsSummary
          headers={draftHeaders}
          rows={draftRows}
          categories={configsQuery.data ?? []}
          labels={labels}
        />
      </TooltipProvider>
    );
  }

  const summary = summaryQuery.data ?? [];
  /* Review is not the category catalogue. It should only show categories
   * that actually have saved settings rows, even if other lookup
   * categories are active. */
  const categoriesWithSavedSettings = summary.filter(hasSavedSettings);

  if (categoriesWithSavedSettings.length === 0) {
    return (
      <EmptyState
        variant="generic"
        title="لا توجد إعدادات محفوظة"
        description="ارجع إلى خطوة «إعدادات التقديم» وأضف شروط القبول للفئات المطلوبة."
      />
    );
  }

  return (
    <TooltipProvider delayDuration={120}>
      <div className="flex flex-col gap-3">
        <h2 className="font-ar-display text-md font-bold text-ink-900">
          التركيبات المعتمدة لكل فئة
        </h2>
        {categoriesWithSavedSettings.map((cat) => (
          <Card key={cat.config.id} variant="compact">
            <CategoryBlock summary={cat} labels={labels} />
          </Card>
        ))}
      </div>
    </TooltipProvider>
  );
}

function DraftCompositionsSummary({
  headers,
  rows,
  categories,
  labels,
}: {
  headers: Readonly<Record<string, GeneralRulesHeader>>;
  rows: readonly LocalGeneralRuleRow[];
  categories: readonly CategorySettingsSummary['config'][];
  labels: LabelMaps;
}): JSX.Element {
  const grouped = groupDraftRows(headers, rows, categories);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-ar-display text-md font-bold text-ink-900">
        التركيبات المحفوظة لكل فئة
      </h2>
      {grouped.map((group) => (
        <Card key={group.categoryCode} variant="compact">
          <section
            className="flex flex-col gap-3"
            aria-label={`تركيبات فئة ${group.categoryNameAr}`}
          >
            <header className="flex flex-wrap items-baseline gap-2">
              <h3 className="font-ar text-sm font-semibold text-ink-900">
                {group.categoryNameAr}
              </h3>
              <span className="font-ar text-2xs text-ink-500">
                {group.categoryType === 'pre_university' ? 'ثانوي' : 'جامعي'}
              </span>
            </header>
            {group.header && (
              <DraftHeaderSummary header={group.header} labels={labels} />
            )}
            {group.universityRows.length > 0 && (
              <DraftUniversityRowsTable rows={group.universityRows} labels={labels} />
            )}
            {group.thanawiRows.length > 0 && (
              <DraftThanawiRowsTable rows={group.thanawiRows} labels={labels} />
            )}
            {group.universityRows.length === 0 && group.thanawiRows.length === 0 && (
              <p className="rounded-md border border-dashed border-border-subtle bg-ink-50/40 px-3 py-2 font-ar text-2xs text-ink-500">
                تم حفظ بيانات الفئة الأساسية، ولم تُضف شروط لجان بعد.
              </p>
            )}
          </section>
        </Card>
      ))}
    </div>
  );
}

interface DraftCategoryGroup {
  categoryCode: string;
  categoryNameAr: string;
  categoryType: 'university' | 'pre_university';
  header: GeneralRulesHeader | null;
  universityRows: LocalUniversityRow[];
  thanawiRows: LocalThanawiRow[];
}

function groupDraftRows(
  headers: Readonly<Record<string, GeneralRulesHeader>>,
  rows: readonly LocalGeneralRuleRow[],
  categories: readonly CategorySettingsSummary['config'][],
): DraftCategoryGroup[] {
  const categoryByCode = new Map(
    categories.map((category) => [category.categoryCode, category] as const),
  );
  const groups = new Map<string, DraftCategoryGroup>();

  for (const [categoryCode, header] of Object.entries(headers)) {
    const category = categoryByCode.get(categoryCode);
    groups.set(categoryCode, {
      categoryCode,
      categoryNameAr: category?.categoryNameAr ?? categoryCode,
      categoryType:
        category?.categoryType === 'pre_university'
          ? 'pre_university'
          : 'university',
      header,
      universityRows: [],
      thanawiRows: [],
    });
  }

  for (const row of rows) {
    const category = categoryByCode.get(row.categoryCode);
    const existing =
      groups.get(row.categoryCode) ??
      {
        categoryCode: row.categoryCode,
        categoryNameAr: category?.categoryNameAr ?? row.categoryCode,
        categoryType:
          category?.categoryType === 'pre_university' || row.kind === 'thanawi'
            ? 'pre_university'
            : 'university',
        header: headers[row.categoryCode] ?? row.header,
        universityRows: [],
        thanawiRows: [],
      };
    if (!existing.header) existing.header = headers[row.categoryCode] ?? row.header;
    if (row.kind === 'thanawi') existing.thanawiRows.push(row);
    else existing.universityRows.push(row);
    groups.set(row.categoryCode, existing);
  }

  return [...groups.values()];
}

function DraftHeaderSummary({
  header,
  labels,
}: {
  header: GeneralRulesHeader;
  labels: LabelMaps;
}): JSX.Element {
  return (
    <dl className="grid grid-cols-1 gap-2 rounded-md border border-border-subtle bg-ink-50/40 p-3 md:grid-cols-5">
      <HeaderItem label="بداية التقديم" value={formatIsoDate(header.applicationStart)} />
      <HeaderItem label="نهاية التقديم" value={formatIsoDate(header.applicationEnd)} />
      <HeaderItem label="تاريخ احتساب السن" value={formatIsoDate(header.ageReferenceDate)} />
      <HeaderItem
        label="الحالة الاجتماعية"
        value={formatList(header.maritalStatus.map((c) => labels.marital.get(c) ?? c))}
      />
      <HeaderItem label="الحد الأقصى للسن" value={formatMaxAge(header.maxAge)} />
    </dl>
  );
}

function HeaderItem({
  label,
  value,
}: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="min-w-0">
      <dt className="font-ar text-2xs text-ink-500">{label}</dt>
      <dd className="mt-1 break-words font-ar text-2xs font-semibold text-ink-900">
        {value}
      </dd>
    </div>
  );
}

function DraftUniversityRowsTable({
  rows,
  labels,
}: {
  rows: readonly LocalUniversityRow[];
  labels: LabelMaps;
}): JSX.Element {
  const headers = [
    'الكلية / التخصص',
    'اللجنة',
    'بداية التقديم',
    'نهاية التقديم',
    'تاريخ احتساب السن',
    'الحالة الاجتماعية',
    'النوع',
    'معيار التمييز',
    'الحد الأدنى للتقدير',
    'الحد الأقصى للتقدير',
    'الحد الأدنى للدرجة',
    'الحد الأقصى للدرجة',
    'الدرجة العلمية',
    'سنة التخرج',
    'الحد الأقصى للسن',
  ];

  return (
    <DraftTable headers={headers} minWidthClass="min-w-[112rem]">
      {rows.map((row) => (
        <tr key={row.id} className="border-t border-border-subtle">
          <Td>
            <span className="block font-medium text-ink-900">{row.facultyNameAr}</span>
            <span className="mt-0.5 block text-ink-500">{row.specializationNameAr}</span>
          </Td>
          <Td><ChipList values={row.committees.map((c) => labels.committee.get(c) ?? c)} /></Td>
          <Td>{formatIsoDate(row.header.applicationStart)}</Td>
          <Td>{formatIsoDate(row.header.applicationEnd)}</Td>
          <Td>{formatIsoDate(row.header.ageReferenceDate)}</Td>
          <Td><ChipList values={row.maritalStatus.map((c) => labels.marital.get(c) ?? c)} /></Td>
          <Td><ChipList values={row.type.map((g) => GENDER_LABEL[g] ?? g)} /></Td>
          <Td>{formatExcellenceMode(row.excellenceMode)}</Td>
          <Td>{row.grade ? labels.academicGrade.get(row.grade) ?? row.grade : '—'}</Td>
          <Td>{row.gradeMax ? labels.academicGrade.get(row.gradeMax) ?? row.gradeMax : '—'}</Td>
          <Td>{formatScore(row.scoreMin, row.minScoreOperator ?? DEFAULT_MIN_SCORE_OPERATOR)}</Td>
          <Td>{formatScore(row.scoreMax, row.maxScoreOperator ?? DEFAULT_MAX_SCORE_OPERATOR)}</Td>
          <Td><ChipList values={row.academicDegrees.map((d) => labels.academicDegree.get(d) ?? d)} /></Td>
          <Td><ChipList values={row.graduationYears.map((y) => toEasternArabicNumerals(y))} /></Td>
          <Td>{formatMaxAge(row.header.maxAge)}</Td>
        </tr>
      ))}
    </DraftTable>
  );
}

function DraftThanawiRowsTable({
  rows,
  labels,
}: {
  rows: readonly LocalThanawiRow[];
  labels: LabelMaps;
}): JSX.Element {
  const headers = [
    'اللجنة',
    'بداية التقديم',
    'نهاية التقديم',
    'تاريخ احتساب السن',
    'الحالة الاجتماعية',
    'الدور',
    'سنة التخرج',
    'فئة المدرسة',
    'معيار التمييز',
    'الحد الأدنى للتقدير',
    'الحد الأقصى للتقدير',
    'الحد الأدنى للدرجة',
    'الحد الأقصى للدرجة',
    'الحد الأقصى للسن',
  ];

  return (
    <DraftTable headers={headers} minWidthClass="min-w-[104rem]">
      {rows.map((row) => (
        <tr key={row.id} className="border-t border-border-subtle">
          <Td>{labels.committee.get(row.committee) ?? row.committee}</Td>
          <Td>{formatIsoDate(row.header.applicationStart)}</Td>
          <Td>{formatIsoDate(row.header.applicationEnd)}</Td>
          <Td>{formatIsoDate(row.header.ageReferenceDate)}</Td>
          <Td><ChipList values={row.maritalStatus.map((c) => labels.marital.get(c) ?? c)} /></Td>
          <Td>{labels.examRound.get(row.examRound) ?? row.examRound}</Td>
          <Td>{row.graduationYear !== null ? toEasternArabicNumerals(row.graduationYear) : '—'}</Td>
          <Td><ChipList values={row.schoolCategories.map((c) => labels.schoolCategory.get(c) ?? c)} /></Td>
          <Td>{formatExcellenceMode(row.excellenceMode)}</Td>
          <Td>{row.grade ? labels.academicGrade.get(row.grade) ?? row.grade : '—'}</Td>
          <Td>{row.gradeMax ? labels.academicGrade.get(row.gradeMax) ?? row.gradeMax : '—'}</Td>
          <Td>{formatScore(row.scoreMin, row.minScoreOperator ?? DEFAULT_MIN_SCORE_OPERATOR)}</Td>
          <Td>{formatScore(row.scoreMax, row.maxScoreOperator ?? DEFAULT_MAX_SCORE_OPERATOR)}</Td>
          <Td>{formatMaxAge(row.header.maxAge)}</Td>
        </tr>
      ))}
    </DraftTable>
  );
}

function DraftTable({
  headers,
  minWidthClass,
  children,
}: {
  headers: readonly string[];
  minWidthClass: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="overflow-x-auto rounded-md border border-border-subtle bg-surface-card">
      <table className={`${minWidthClass} border-collapse text-sm`}>
        <thead className="bg-ink-50/80">
          <tr>
            {headers.map((header) => (
              <Th key={header}>{header}</Th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function formatExcellenceMode(value: ApprovedGeneralRuleRow['excellenceMode']): string {
  return value === 'TAGDIR' ? 'تقدير' : 'درجة';
}

function formatMaxAge(value: number | null): string {
  return value !== null ? `${toEasternArabicNumerals(value)} سنة` : '—';
}

function formatList(values: readonly string[]): string {
  return values.length > 0 ? values.join('، ') : '—';
}

function formatScore(
  value: number | null | undefined,
  operator: MinScoreOperator | MaxScoreOperator,
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${operatorSymbol(operator)} ${toEasternArabicNumerals(value)}٪`;
}

function operatorSymbol(operator: MinScoreOperator | MaxScoreOperator): string {
  switch (operator) {
    case 'GREATER_THAN':
      return '>';
    case 'GREATER_THAN_OR_EQUAL':
      return '≥';
    case 'LESS_THAN':
      return '<';
    case 'LESS_THAN_OR_EQUAL':
      return '≤';
  }
}

function hasSavedSettings(summary: CategorySettingsSummary): boolean {
  return summary.groups.some((group) => group.years.length > 0);
}

interface LabelMaps {
  marital: Map<string, string>;
  academicGrade: Map<string, string>;
  academicDegree: Map<string, string>;
  committee: Map<string, string>;
  examRound: Map<string, string>;
  schoolCategory: Map<string, string>;
}

interface CategoryBlockProps {
  summary: CategorySettingsSummary;
  labels: LabelMaps;
}

function CategoryBlock({ summary, labels }: CategoryBlockProps): JSX.Element {
  const { config, groups } = summary;
  const groupsWithSavedRows = groups.filter((group) => group.years.length > 0);
  const showSchoolCategory = config.categoryCode === 'officers_general';

  return (
    <section
      className="flex flex-col gap-3"
      aria-label={`تركيبات فئة ${config.categoryNameAr}`}
    >
      <header className="flex flex-wrap items-baseline gap-2">
        <h3 className="font-ar text-sm font-semibold text-ink-900">
          {config.categoryNameAr}
        </h3>
        <span className="font-ar text-2xs text-ink-500">
          {config.categoryType === 'university' ? 'جامعي' : 'ثانوي'}
        </span>
        <span className="font-ar text-2xs text-ink-400">·</span>
        <span className="font-ar text-2xs text-ink-500">
          {summary.gradingMode === 'TAGDIR' ? 'تقدير' : 'درجة مئوية'}
        </span>
      </header>

      {groupsWithSavedRows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-subtle bg-ink-50/40 px-3 py-2 font-ar text-2xs text-ink-500">
          لا توجد إعدادات محفوظة لهذه الفئة بعد.
        </p>
      ) : (
        groupsWithSavedRows.map((group) => (
          <SpecializationGroup
            key={group.csId}
            group={group}
            gradingMode={summary.gradingMode}
            showSchoolCategory={showSchoolCategory}
            labels={labels}
          />
        ))
      )}
    </section>
  );
}

interface SpecializationGroupProps {
  group: YearGroupForReview;
  gradingMode: CategorySettingsSummary['gradingMode'];
  showSchoolCategory: boolean;
  labels: LabelMaps;
}

function SpecializationGroup({
  group,
  gradingMode,
  showSchoolCategory,
  labels,
}: SpecializationGroupProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      {group.nameAr !== null && (
        <h4 className="font-ar text-2xs font-semibold tracking-wide text-ink-500">
          {group.nameAr}
        </h4>
      )}
      <YearRowsTable
        rows={group.years}
        gradingMode={gradingMode}
        showSchoolCategory={showSchoolCategory}
        labels={labels}
      />
    </div>
  );
}

interface YearRowsTableProps {
  rows: readonly ApplicantSpecializationYear[];
  gradingMode: CategorySettingsSummary['gradingMode'];
  showSchoolCategory: boolean;
  labels: LabelMaps;
}

function YearRowsTable({
  rows,
  gradingMode,
  showSchoolCategory,
  labels,
}: YearRowsTableProps): JSX.Element {
  const gradeHeaderLabel =
    gradingMode === 'TAGDIR' ? 'التقدير' : 'الحد الأدنى للدرجة';
  const headers: string[] = [
    'سنوات التخرج',
    'النوع',
    'الحالة الاجتماعية',
    gradeHeaderLabel,
    'الحد الأقصى للسن',
    ...(showSchoolCategory ? ['فئة المدرسة'] : []),
    'بداية التقديم',
    'نهاية التقديم',
    'تاريخ احتساب السن',
    'الحالة',
  ];

  if (rows.length === 0) {
    return <EmptyTable columns={headers} />;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border-subtle bg-surface-card">
      <table className="min-w-[80rem] border-collapse text-sm">
        <thead className="bg-ink-50/80">
          <tr>
            {headers.map((h) => (
              <Th key={h}>{h}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border-subtle">
              <Td>
                <ChipList
                  values={row.graduationYears.map((y) =>
                    toEasternArabicNumerals(y),
                  )}
                />
              </Td>
              <Td>
                <ChipList
                  values={row.genderTypes.map((g) => GENDER_LABEL[g] ?? g)}
                />
              </Td>
              <Td>
                <ChipList
                  values={row.maritalStatusCodes.map(
                    (c) => labels.marital.get(c) ?? c,
                  )}
                />
              </Td>
              <Td>{renderGradeGate(row, labels)}</Td>
              <Td>
                {row.maxAge !== null
                  ? `${toEasternArabicNumerals(row.maxAge)} سنة`
                  : '—'}
              </Td>
              {showSchoolCategory && (
                <Td>
                  <ChipList
                    values={row.schoolCategoryCodes.map(
                      (c) => labels.schoolCategory.get(c) ?? c,
                    )}
                  />
                </Td>
              )}
              <Td>{formatIsoDate(row.applicationStartDate)}</Td>
              <Td>{formatIsoDate(row.applicationEndDate)}</Td>
              <Td>{formatIsoDate(row.ageReferenceDate)}</Td>
              <Td>
                <span
                  className={
                    row.isActive
                      ? 'inline-flex items-center rounded-pill bg-success-50 px-2 py-0.5 font-ar text-2xs text-success-700'
                      : 'inline-flex items-center rounded-pill bg-ink-100 px-2 py-0.5 font-ar text-2xs text-ink-600'
                  }
                >
                  {row.isActive ? 'نشط' : 'موقوف'}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderGradeGate(
  row: ApplicantSpecializationYear,
  labels: LabelMaps,
): JSX.Element {
  if (row.gradeKind === 'TAGDIR') {
    const label = labels.academicGrade.get(row.academicGradeId);
    return <>{label ?? (row.academicGradeId || '—')}</>;
  }
  return <>{formatBarePercentage(row.minPercentage)}</>;
}

/* ── Shared bits ──────────────────────────────────────────────────── */

function formatIsoDate(value: string): string {
  if (!value) return '—';
  return fmtDate(value, 'full');
}

function formatBarePercentage(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${toEasternArabicNumerals(value)}٪`;
}

function EmptyTable({ columns }: { columns: readonly string[] }): JSX.Element {
  return (
    <div className="overflow-x-auto rounded-md border border-border-subtle bg-surface-card">
      <table className="min-w-[80rem] border-collapse text-sm">
        <thead className="bg-ink-50/80">
          <tr>
            {columns.map((h) => (
              <Th key={h}>{h}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border-subtle">
            <td
              colSpan={columns.length}
              className="px-3 py-4 text-center font-ar text-2xs text-ink-500"
            >
              لا توجد بيانات
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
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

/** Renders a multi-value list as wrapping inline pill chips with a
 *  tooltip exposing the full list — same contract as the application-
 *  settings editor grids. */
function ChipList({ values }: { values: readonly string[] }): JSX.Element {
  if (values.length === 0) return <>—</>;
  const full = values.join('، ');
  return (
    <Tooltip content={full} delayDuration={120}>
      <span
        tabIndex={0}
        className="flex max-w-full flex-wrap items-center gap-1 focus-visible:outline-none focus-visible:shadow-focus-teal"
      >
        {values.map((v, i) => (
          <span
            key={`${v}-${i}`}
            className="inline-flex min-w-0 max-w-full items-center rounded-pill border border-border-subtle bg-ink-50 px-2 py-0.5 text-start font-ar text-2xs leading-snug text-ink-700"
          >
            {v}
          </span>
        ))}
      </span>
    </Tooltip>
  );
}
