/**
 * Step 1.5 — مراجعة إعدادات التقديم لكل فئة.
 *
 * Read-only checkpoint between authoring (`application_settings`) and
 * the final approval gate (`review`). Sources directly from the same
 * Zustand store the editor writes to (`useAdmissionSetupWizardStore`)
 * so what the admin sees here is exactly what they just authored — no
 * service round-trip, no parallel fetch.
 *
 * Per category, the page surfaces every field captured by the
 * `application_settings` step:
 *
 *   • Header — applicationStart / applicationEnd / ageReferenceDate
 *     (per-row snapshot, since each row stamps its own header at add
 *     time) + multi-marital-status + max-age
 *   • University rows (kind === 'university') — grouped per
 *     faculty → specialization. Surfaces multi-gender (النوع),
 *     min/max grade band (academic grade codes), min/max score band
 *     (percentages), multi-academic-degrees, committees, and
 *     graduation years (Eastern Arabic numerals).
 *   • Pre-university rows (kind === 'thanawi') — flat table with
 *     exam-round, committee, graduation year, and multi-school-category.
 *
 * Unapproved local rows are surfaced as a conflict notice so the admin
 * doesn't sail past forgotten «اعتماد» clicks. The actual «السابق /
 * التالي» footer is owned by `AdmissionSetupWizardPage`.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Printer } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
  PageHeader,
  Tooltip,
  TooltipProvider,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { useLookup } from '@/features/lookups';
import { toEasternArabicNumerals } from '@/shared/lib/arabic';
import { date as fmtDate, num } from '@/shared/lib/format';
import { AdmissionSetupShell } from '../components/AdmissionSetupShell';
import {
  DEFAULT_MAX_SCORE_OPERATOR,
  DEFAULT_MIN_SCORE_OPERATOR,
  useAdmissionSetupWizardStore,
  type ApprovedGeneralRuleRow,
  type GeneralRulesHeader,
  type LocalGeneralRuleRow,
  type LocalThanawiRow,
  type LocalUniversityRow,
  type MaxScoreOperator,
  type MinScoreOperator,
} from '../store/wizardSharedState';

const GENDER_LABEL: Readonly<Record<string, string>> = {
  male: 'ذكر',
  female: 'أنثى',
};

const MIN_OPERATOR_SYMBOL: Record<MinScoreOperator, string> = {
  GREATER_THAN_OR_EQUAL: '≥',
  GREATER_THAN: '>',
};
const MAX_OPERATOR_SYMBOL: Record<MaxScoreOperator, string> = {
  LESS_THAN_OR_EQUAL: '≤',
  LESS_THAN: '<',
};

/* Print: landscape A4 fits the wide row tables comfortably; tighter
 * font keeps two-column data legible on paper. The global print.css
 * already hides chrome-side elements that carry `.no-print`. */
const PRINT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 12mm 10mm; }
  .app-settings-review-print table { font-size: 9pt; }
  .app-settings-review-print thead th { font-size: 8pt; }
}
`;

export function ApplicationSettingsReviewPage(): JSX.Element {
  return (
    <AdmissionSetupShell>
      <style>{PRINT_CSS}</style>
      <div className="app-settings-review-print flex flex-col gap-4">
        <PageHeader
          title="مراجعة إعدادات التقديم لكل فئة"
          subtitle="مراجعة قراءة فقط لكل ما تم إدخاله في خطوة «إعدادات التقديم»."
          actions={
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Printer size={14} strokeWidth={1.75} aria-hidden />}
              onClick={() => window.print()}
            >
              طباعة
            </Button>
          }
        />
        <ReviewBody />
      </div>
    </AdmissionSetupShell>
  );
}

function ReviewBody(): JSX.Element {
  const approved = useAdmissionSetupWizardStore((s) => s.approved);
  const local = useAdmissionSetupWizardStore((s) => s.local);
  const headers = useAdmissionSetupWizardStore((s) => s.headers);

  const categoriesQuery = useLookup('applicant-categories');
  const facultiesQuery = useLookup('faculties');
  const specializationsQuery = useLookup('specializations');
  const maritalQuery = useLookup('marital-statuses');
  const academicGradesQuery = useLookup('academic-grades');
  const academicDegreesQuery = useLookup('academic-degrees');
  const committeesQuery = useLookup('committees');
  const examRoundsQuery = useLookup('exam-rounds');
  const schoolCategoriesQuery = useLookup('school-categories');

  const isLoading =
    categoriesQuery.isLoading ||
    facultiesQuery.isLoading ||
    specializationsQuery.isLoading ||
    maritalQuery.isLoading ||
    academicGradesQuery.isLoading ||
    academicDegreesQuery.isLoading ||
    committeesQuery.isLoading ||
    examRoundsQuery.isLoading ||
    schoolCategoriesQuery.isLoading;

  const labels = useMemo<LabelMaps>(
    () => ({
      category: new Map(
        (categoriesQuery.data ?? []).map((r) => [
          r.code,
          { nameAr: r.name, type: r.type },
        ]),
      ),
      faculty: new Map((facultiesQuery.data ?? []).map((r) => [r.code, r.name])),
      specialization: new Map(
        (specializationsQuery.data ?? []).map((r) => [r.code, r.name]),
      ),
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
      categoriesQuery.data,
      facultiesQuery.data,
      specializationsQuery.data,
      maritalQuery.data,
      academicGradesQuery.data,
      academicDegreesQuery.data,
      committeesQuery.data,
      examRoundsQuery.data,
      schoolCategoriesQuery.data,
    ],
  );

  if (isLoading) return <LoadingState variant="list" />;

  if (approved.length === 0 && local.length === 0) {
    return (
      <Card>
        <EmptyState
          variant="generic"
          title="لا توجد قواعد معتمدة بعد"
          description="ارجع إلى خطوة «إعدادات التقديم» وأضف قواعد القبول لكل فئة ثم اضغط «اعتماد»."
          action={
            <Link
              to={ROUTES.admin.admissionSetup.wizard('application_settings')}
              className="inline-flex"
            >
              <Button
                variant="primary"
                leadingIcon={<ArrowLeft size={14} strokeWidth={1.75} />}
              >
                العودة لإعدادات التقديم
              </Button>
            </Link>
          }
        />
      </Card>
    );
  }

  /* Group approved rows by categoryCode for per-category cards.
   * Unapproved local rows share the same grouping key so the conflict
   * banner can call out which categories still have un-«اعتماد» rules. */
  const approvedByCategory = groupByCategory(approved);
  const localByCategory = groupByCategory(local);
  const allCategoryCodes = Array.from(
    new Set<string>([
      ...approvedByCategory.keys(),
      ...localByCategory.keys(),
    ]),
  );

  return (
    <TooltipProvider delayDuration={120}>
      <div className="flex flex-col gap-3">
        <UnapprovedLocalBanner localByCategory={localByCategory} labels={labels} />
        {allCategoryCodes.map((categoryCode) => (
          <CategoryReviewCard
            key={categoryCode}
            categoryCode={categoryCode}
            approvedRows={approvedByCategory.get(categoryCode) ?? []}
            localRows={localByCategory.get(categoryCode) ?? []}
            header={headers[categoryCode] ?? null}
            labels={labels}
          />
        ))}
      </div>
    </TooltipProvider>
  );
}

/* ── Conflict banner — surfaces un-«اعتماد» local rows ───────────────── */

interface UnapprovedLocalBannerProps {
  localByCategory: Map<string, LocalGeneralRuleRow[]>;
  labels: LabelMaps;
}

function UnapprovedLocalBanner({
  localByCategory,
  labels,
}: UnapprovedLocalBannerProps): JSX.Element | null {
  const total = Array.from(localByCategory.values()).reduce(
    (acc, rows) => acc + rows.length,
    0,
  );
  if (total === 0) return null;
  const categoryNames = Array.from(localByCategory.keys())
    .map((code) => labels.category.get(code)?.nameAr ?? code)
    .join('، ');
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-terra-500 bg-terra-50 px-3 py-2"
    >
      <AlertTriangle
        size={16}
        strokeWidth={1.75}
        className="mt-0.5 shrink-0 text-terra-700"
        aria-hidden
      />
      <div className="flex flex-col gap-1">
        <p className="font-ar text-sm font-semibold text-terra-700">
          {`${num(total)} قاعدة غير معتمدة في الفئات: ${categoryNames}`}
        </p>
        <p className="font-ar text-2xs text-terra-700">
          ارجع إلى خطوة «إعدادات التقديم» واضغط «اعتماد» قبل المتابعة لتثبيت
          هذه القواعد في المراجعة.
        </p>
      </div>
    </div>
  );
}

/* ── Per-category card ───────────────────────────────────────────────── */

interface CategoryReviewCardProps {
  categoryCode: string;
  approvedRows: LocalGeneralRuleRow[];
  localRows: LocalGeneralRuleRow[];
  header: GeneralRulesHeader | null;
  labels: LabelMaps;
}

function CategoryReviewCard({
  categoryCode,
  approvedRows,
  localRows,
  header,
  labels,
}: CategoryReviewCardProps): JSX.Element {
  const categoryInfo = labels.category.get(categoryCode);
  const nameAr = categoryInfo?.nameAr ?? categoryCode;
  const type = categoryInfo?.type ?? null;
  const universityRows = approvedRows.filter(
    (r): r is LocalUniversityRow => r.kind === 'university',
  );
  const thanawiRows = approvedRows.filter(
    (r): r is LocalThanawiRow => r.kind === 'thanawi',
  );

  return (
    <Card variant="compact">
      <section
        className="flex flex-col gap-3"
        aria-label={`مراجعة فئة ${nameAr}`}
      >
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="font-ar text-sm font-semibold text-ink-900">
              {nameAr}
            </h3>
            {type && (
              <span className="font-ar text-2xs text-ink-500">
                {type === 'university' ? 'جامعي' : 'ثانوي'}
              </span>
            )}
            <span className="font-ar text-2xs text-ink-400">·</span>
            <span className="font-ar text-2xs text-ink-500">
              {`${num(approvedRows.length)} قاعدة معتمدة`}
            </span>
          </div>
          {localRows.length > 0 && (
            <Badge tone="warning">
              {`${num(localRows.length)} غير معتمدة`}
            </Badge>
          )}
        </header>

        <HeaderSummary header={header} labels={labels} />

        {universityRows.length > 0 && (
          <UniversityRowsByFacultySpec
            rows={universityRows}
            labels={labels}
          />
        )}
        {thanawiRows.length > 0 && (
          <ThanawiRowsTable rows={thanawiRows} labels={labels} />
        )}
        {approvedRows.length === 0 && (
          <p className="rounded-md border border-dashed border-border-subtle bg-ink-50/40 px-3 py-2 font-ar text-2xs text-ink-500">
            لا توجد قواعد معتمدة لهذه الفئة بعد.
          </p>
        )}
      </section>
    </Card>
  );
}

/* ── Header summary (per-category) ───────────────────────────────────── */

interface HeaderSummaryProps {
  header: GeneralRulesHeader | null;
  labels: LabelMaps;
}

function HeaderSummary({ header, labels }: HeaderSummaryProps): JSX.Element | null {
  if (!header) return null;
  const maritalLabels = header.maritalStatus.map(
    (c) => labels.marital.get(c) ?? c,
  );
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-md border border-border-subtle bg-ink-50/40 px-3 py-2 sm:grid-cols-2 xl:grid-cols-5">
      <DefinitionPair label="بداية التقديم" value={formatIsoDate(header.applicationStart)} />
      <DefinitionPair label="نهاية التقديم" value={formatIsoDate(header.applicationEnd)} />
      <DefinitionPair
        label="تاريخ احتساب السن"
        value={formatIsoDate(header.ageReferenceDate)}
      />
      <DefinitionPair
        label="الحالة الاجتماعية"
        value={maritalLabels.length > 0 ? maritalLabels.join('، ') : '—'}
      />
      <DefinitionPair
        label="الحد الأقصى للسن"
        value={
          header.maxAge !== null
            ? `${toEasternArabicNumerals(header.maxAge)} سنة`
            : '—'
        }
      />
    </dl>
  );
}

function DefinitionPair({
  label,
  value,
}: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-ar text-2xs font-medium text-ink-500">{label}</dt>
      <dd className="font-ar text-2xs text-ink-900">{value}</dd>
    </div>
  );
}

/* ── University rows — faculty → specialization → grid ───────────────── */

interface UniversityRowsByFacultySpecProps {
  rows: LocalUniversityRow[];
  labels: LabelMaps;
}

function UniversityRowsByFacultySpec({
  rows,
  labels,
}: UniversityRowsByFacultySpecProps): JSX.Element {
  const byFaculty = useMemo(() => {
    const map = new Map<string, Map<string, LocalUniversityRow[]>>();
    for (const r of rows) {
      const facKey = r.facultyCode || '__none__';
      const specKey = r.specializationCode || '__none__';
      const specMap = map.get(facKey) ?? new Map<string, LocalUniversityRow[]>();
      const list = specMap.get(specKey) ?? [];
      list.push(r);
      specMap.set(specKey, list);
      map.set(facKey, specMap);
    }
    return map;
  }, [rows]);

  return (
    <div className="flex flex-col gap-3">
      {Array.from(byFaculty.entries()).map(([facCode, specMap]) => {
        const facName =
          facCode === '__none__'
            ? '—'
            : labels.faculty.get(facCode) ?? facCode;
        return (
          <div key={facCode} className="flex flex-col gap-2">
            <h4 className="font-ar text-2xs font-semibold tracking-wide text-ink-500">
              {`الكلية: ${facName}`}
            </h4>
            {Array.from(specMap.entries()).map(([specCode, specRows]) => {
              const specName =
                specCode === '__none__'
                  ? '—'
                  : labels.specialization.get(specCode) ?? specCode;
              return (
                <div key={`${facCode}::${specCode}`} className="flex flex-col gap-1.5">
                  <h5 className="font-ar text-2xs text-ink-600">
                    <span className="text-ink-400">التخصص:</span> {specName}
                  </h5>
                  <UniversityRowsTable rows={specRows} labels={labels} />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

interface UniversityRowsTableProps {
  rows: LocalUniversityRow[];
  labels: LabelMaps;
}

function UniversityRowsTable({
  rows,
  labels,
}: UniversityRowsTableProps): JSX.Element {
  const headers: string[] = [
    'اللجنة',
    'الكلية',
    'التخصص',
    'النوع',
    'الحد الأدنى للتقدير',
    'الحد الأقصى للتقدير',
    'الحد الأدنى للدرجة',
    'الحد الأقصى للدرجة',
    'الدرجة العلمية',
    'سنوات التخرج',
    'الحالة الاجتماعية',
    'بداية التقديم',
    'نهاية التقديم',
    'تاريخ احتساب السن',
  ];
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
                  values={row.committees.map(
                    (c) => labels.committee.get(c) ?? c,
                  )}
                />
              </Td>
              <Td>{labels.faculty.get(row.facultyCode) ?? row.facultyNameAr ?? '—'}</Td>
              <Td>
                {labels.specialization.get(row.specializationCode) ??
                  row.specializationNameAr ??
                  '—'}
              </Td>
              <Td>
                <ChipList
                  values={row.type.map((g) => GENDER_LABEL[g] ?? g)}
                />
              </Td>
              <Td>
                {row.grade ? labels.academicGrade.get(row.grade) ?? row.grade : '—'}
              </Td>
              <Td>
                {row.gradeMax
                  ? labels.academicGrade.get(row.gradeMax) ?? row.gradeMax
                  : '—'}
              </Td>
              <Td>
                {row.scoreMin !== null
                  ? `${MIN_OPERATOR_SYMBOL[row.minScoreOperator ?? DEFAULT_MIN_SCORE_OPERATOR]} ${toEasternArabicNumerals(row.scoreMin)}٪`
                  : '—'}
              </Td>
              <Td>
                {row.scoreMax !== null
                  ? `${MAX_OPERATOR_SYMBOL[row.maxScoreOperator ?? DEFAULT_MAX_SCORE_OPERATOR]} ${toEasternArabicNumerals(row.scoreMax)}٪`
                  : '—'}
              </Td>
              <Td>
                <ChipList
                  values={row.academicDegrees.map(
                    (c) => labels.academicDegree.get(c) ?? c,
                  )}
                />
              </Td>
              <Td>
                <ChipList
                  values={row.graduationYears.map((y) =>
                    toEasternArabicNumerals(y),
                  )}
                />
              </Td>
              <Td>
                <ChipList
                  values={row.maritalStatus.map(
                    (c) => labels.marital.get(c) ?? c,
                  )}
                />
              </Td>
              <Td>{formatIsoDate(row.header.applicationStart)}</Td>
              <Td>{formatIsoDate(row.header.applicationEnd)}</Td>
              <Td>{formatIsoDate(row.header.ageReferenceDate)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Thanawi rows — flat grid ────────────────────────────────────────── */

interface ThanawiRowsTableProps {
  rows: LocalThanawiRow[];
  labels: LabelMaps;
}

function ThanawiRowsTable({
  rows,
  labels,
}: ThanawiRowsTableProps): JSX.Element {
  const headers: string[] = [
    'اللجنة',
    'الدور',
    'سنة التخرج',
    'فئة المدرسة',
    'الحد الأدنى للدرجة',
    'الحد الأقصى للدرجة',
    'الحالة الاجتماعية',
    'بداية التقديم',
    'نهاية التقديم',
    'تاريخ احتساب السن',
  ];
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
                {row.committee
                  ? labels.committee.get(row.committee) ?? row.committee
                  : '—'}
              </Td>
              <Td>
                {row.examRound
                  ? labels.examRound.get(row.examRound) ?? row.examRound
                  : '—'}
              </Td>
              <Td>
                {row.graduationYear !== null
                  ? toEasternArabicNumerals(row.graduationYear)
                  : '—'}
              </Td>
              <Td>
                <ChipList
                  values={row.schoolCategories.map(
                    (c) => labels.schoolCategory.get(c) ?? c,
                  )}
                />
              </Td>
              <Td>
                {row.scoreMin !== null
                  ? `${MIN_OPERATOR_SYMBOL[row.minScoreOperator ?? DEFAULT_MIN_SCORE_OPERATOR]} ${toEasternArabicNumerals(row.scoreMin)}٪`
                  : '—'}
              </Td>
              <Td>
                {row.scoreMax !== null
                  ? `${MAX_OPERATOR_SYMBOL[row.maxScoreOperator ?? DEFAULT_MAX_SCORE_OPERATOR]} ${toEasternArabicNumerals(row.scoreMax)}٪`
                  : '—'}
              </Td>
              <Td>
                <ChipList
                  values={row.maritalStatus.map(
                    (c) => labels.marital.get(c) ?? c,
                  )}
                />
              </Td>
              <Td>{formatIsoDate(row.header.applicationStart)}</Td>
              <Td>{formatIsoDate(row.header.applicationEnd)}</Td>
              <Td>{formatIsoDate(row.header.ageReferenceDate)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Shared bits ─────────────────────────────────────────────────────── */

interface LabelMaps {
  category: Map<string, { nameAr: string; type: 'university' | 'pre_university' }>;
  faculty: Map<string, string>;
  specialization: Map<string, string>;
  marital: Map<string, string>;
  academicGrade: Map<string, string>;
  academicDegree: Map<string, string>;
  committee: Map<string, string>;
  examRound: Map<string, string>;
  schoolCategory: Map<string, string>;
}

function groupByCategory<T extends ApprovedGeneralRuleRow>(
  rows: readonly T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const list = map.get(r.categoryCode) ?? [];
    list.push(r);
    map.set(r.categoryCode, list);
  }
  return map;
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
    <td className="max-w-[14rem] px-3 py-2 align-middle font-ar text-2xs text-ink-900">
      {children}
    </td>
  );
}

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
