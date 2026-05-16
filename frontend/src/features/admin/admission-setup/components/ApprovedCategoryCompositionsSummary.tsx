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
 * Pulls the live tree (configs → specializations → year rows) from the
 * application-settings service via `useApplicationSettingsSummary`. No
 * dependency on the legacy `useAdmissionSetupWizardStore.approved`
 * bucket — that store is fed by a deprecated form (GeneralRulesSection /
 * ThanawiRulesSection) that the live ApplicationSettingsPage no longer
 * uses, so reading from it always rendered empty tables (the original
 * bug).
 *
 * One Card per active applicant category:
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
 * Multi-value cells render as chip pills behind a truncation tooltip,
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
import { useApplicationSettingsSummary } from '../api/applicationSettings.queries';
import type {
  CategorySettingsSummary,
  YearGroupForReview,
} from '../api/applicationSettings.service';
import type { ApplicantSpecializationYear } from '../types';

const GENDER_LABEL: Readonly<Record<string, string>> = {
  male: 'ذكر',
  female: 'أنثى',
};

export function ApprovedCategoryCompositionsSummary(): JSX.Element {
  const summaryQuery = useApplicationSettingsSummary();
  const maritalQuery = useLookup('marital-statuses');
  const academicGradesQuery = useLookup('academic-grades');
  const schoolCategoriesQuery = useLookup('school-categories');

  const isLoading =
    summaryQuery.isLoading ||
    maritalQuery.isLoading ||
    academicGradesQuery.isLoading ||
    schoolCategoriesQuery.isLoading;

  const labels = useMemo<LabelMaps>(
    () => ({
      marital: new Map((maritalQuery.data ?? []).map((r) => [r.code, r.name])),
      academicGrade: new Map(
        (academicGradesQuery.data ?? []).map((r) => [r.code, r.name]),
      ),
      schoolCategory: new Map(
        (schoolCategoriesQuery.data ?? []).map((r) => [r.code, r.name]),
      ),
    }),
    [maritalQuery.data, academicGradesQuery.data, schoolCategoriesQuery.data],
  );

  if (isLoading) return <LoadingState variant="list" />;

  const summary = summaryQuery.data ?? [];
  /* Active categories only — same filter the editor uses. Categories
   * with no attached specializations or year rows still render so the
   * section reads as exhaustive (consistent with the original
   * contract). */
  const activeCategories = summary.filter((c) => c.config.isActive);

  if (activeCategories.length === 0) {
    return (
      <EmptyState
        variant="generic"
        title="لا توجد فئات نشطة"
        description="فعّل فئة واحدة على الأقل من خطوة «إعدادات التقديم»."
      />
    );
  }

  return (
    <TooltipProvider delayDuration={120}>
      <div className="flex flex-col gap-3">
        <h2 className="font-ar-display text-md font-bold text-ink-900">
          التركيبات المعتمدة لكل فئة
        </h2>
        {activeCategories.map((cat) => (
          <Card key={cat.config.id} variant="compact">
            <CategoryBlock summary={cat} labels={labels} />
          </Card>
        ))}
      </div>
    </TooltipProvider>
  );
}

interface LabelMaps {
  marital: Map<string, string>;
  academicGrade: Map<string, string>;
  schoolCategory: Map<string, string>;
}

interface CategoryBlockProps {
  summary: CategorySettingsSummary;
  labels: LabelMaps;
}

function CategoryBlock({ summary, labels }: CategoryBlockProps): JSX.Element {
  const { config, groups } = summary;
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

      {groups.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-subtle bg-ink-50/40 px-3 py-2 font-ar text-2xs text-ink-500">
          لم تُضف تخصصات لهذه الفئة بعد.
        </p>
      ) : (
        groups.map((group) => (
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
      <table className="w-full border-collapse text-sm">
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
  return <>{`${toEasternArabicNumerals(row.minPercentage)}٪`}</>;
}

/* ── Shared bits ──────────────────────────────────────────────────── */

function formatIsoDate(value: string): string {
  if (!value) return '—';
  return fmtDate(value, 'full');
}

function EmptyTable({ columns }: { columns: readonly string[] }): JSX.Element {
  return (
    <div className="overflow-x-auto rounded-md border border-border-subtle bg-surface-card">
      <table className="w-full border-collapse text-sm">
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
    <td className="max-w-[14rem] px-3 py-2 align-middle font-ar text-2xs text-ink-900">
      {children}
    </td>
  );
}

/** Renders a multi-value list as inline pill chips. Truncates with a
 *  tooltip exposing the full list — same contract as the application-
 *  settings editor grids. */
function ChipList({ values }: { values: readonly string[] }): JSX.Element {
  if (values.length === 0) return <>—</>;
  const full = values.join('، ');
  return (
    <Tooltip content={full} delayDuration={120}>
      <span
        tabIndex={0}
        className="flex max-w-full items-center gap-1 overflow-hidden whitespace-nowrap focus-visible:outline-none focus-visible:shadow-focus-teal"
      >
        {values.map((v, i) => (
          <span
            key={`${v}-${i}`}
            className="inline-flex shrink-0 items-center rounded-pill border border-border-subtle bg-ink-50 px-2 py-0.5 font-ar text-2xs text-ink-700"
          >
            {v}
          </span>
        ))}
      </span>
    </Tooltip>
  );
}
