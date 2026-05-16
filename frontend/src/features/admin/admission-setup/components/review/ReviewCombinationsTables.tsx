/**
 * ReviewCombinationsTables — read-only summary of every approved
 * application-settings combination, grouped by applicant category.
 *
 * Pulls the already-configured data straight from the wizard store
 * (`useAdmissionSetupWizardStore.approved`) — no refetch. Categories
 * come from the `applicant-categories` lookup (same source the
 * application_settings step writes to); label resolution for faculties,
 * specializations, committees, academic-degrees, exam-rounds and
 * school-categories goes through the lookup catalogue.
 *
 * One table per active applicant category:
 *
 *   • `university` (جامعي)     → flat rows (no rowspan): الكلية ·
 *     الدرجة العلمية · التخصص · النوع · اللجنة. Rows sort by faculty
 *     then degree then specialization; a subtle token-based divider
 *     marks the boundary between faculty groups.
 *
 *   • `pre_university` (ثانوي) → separate column set: الدور · اللجنة ·
 *     سنة التخرج · فئة المدرسة.
 *
 * Multi-select fields (academic-degrees, gender, school-category) render
 * as comma-separated chip pills, truncating with a tooltip on overflow.
 *
 * Categories with no approved combinations still render their card with
 * a single «لا توجد بيانات» row so the section reads as exhaustive.
 */

import { useMemo } from 'react';
import { Card, LoadingState, Tooltip, TooltipProvider } from '@/shared/components';
import { useLookup } from '@/features/lookups';
import { toEasternArabicNumerals } from '@/shared/lib/arabic';
import {
  useAdmissionSetupWizardStore,
  type ApprovedGeneralRuleRow,
  type LocalThanawiRow,
  type LocalUniversityRow,
} from '../../store/wizardSharedState';

const GENDER_LABEL: Readonly<Record<string, string>> = {
  male: 'ذكر',
  female: 'أنثى',
};

export function ReviewCombinationsTables(): JSX.Element {
  const approved = useAdmissionSetupWizardStore((s) => s.approved);

  const categoriesQuery = useLookup('applicant-categories');
  const facultiesQuery = useLookup('faculties');
  const specializationsQuery = useLookup('specializations');
  const committeesQuery = useLookup('committees');
  const degreesQuery = useLookup('academic-degrees');
  const examRoundsQuery = useLookup('exam-rounds');
  const schoolCategoriesQuery = useLookup('school-categories');

  const isLoading =
    categoriesQuery.isLoading ||
    facultiesQuery.isLoading ||
    specializationsQuery.isLoading ||
    committeesQuery.isLoading ||
    degreesQuery.isLoading ||
    examRoundsQuery.isLoading ||
    schoolCategoriesQuery.isLoading;

  /** Approved rows bucketed by `categoryCode`. */
  const rowsByCategory = useMemo(() => {
    const map = new Map<string, ApprovedGeneralRuleRow[]>();
    for (const row of approved) {
      const arr = map.get(row.categoryCode);
      if (arr) arr.push(row);
      else map.set(row.categoryCode, [row]);
    }
    return map;
  }, [approved]);

  /** Active applicant categories — same filter the application_settings
   *  step uses (lookup row's `isActive`). */
  const activeCategories = useMemo(
    () => (categoriesQuery.data ?? []).filter((c) => c.isActive),
    [categoriesQuery.data],
  );

  const labels = useMemo(() => {
    const faculty = new Map<string, string>(
      (facultiesQuery.data ?? []).map((r) => [r.code, r.name]),
    );
    const specialization = new Map<string, string>(
      (specializationsQuery.data ?? []).map((r) => [r.code, r.name]),
    );
    const committee = new Map<string, string>(
      (committeesQuery.data ?? []).map((r) => [r.code, r.name]),
    );
    const degree = new Map<string, string>(
      (degreesQuery.data ?? []).map((r) => [r.code, r.name]),
    );
    const examRound = new Map<string, string>(
      (examRoundsQuery.data ?? []).map((r) => [r.code, r.name]),
    );
    const schoolCategory = new Map<string, string>(
      (schoolCategoriesQuery.data ?? []).map((r) => [r.code, r.name]),
    );
    return { faculty, specialization, committee, degree, examRound, schoolCategory };
  }, [
    facultiesQuery.data,
    specializationsQuery.data,
    committeesQuery.data,
    degreesQuery.data,
    examRoundsQuery.data,
    schoolCategoriesQuery.data,
  ]);

  if (isLoading) return <LoadingState variant="list" />;
  if (activeCategories.length === 0) return <></>;

  return (
    <TooltipProvider delayDuration={120}>
      <div className="flex flex-col gap-3">
        <h2 className="font-ar-display text-md font-bold text-ink-900">
          التركيبات المعتمدة لكل فئة
        </h2>
        {activeCategories.map((cat) => {
          const rows = rowsByCategory.get(cat.code) ?? [];
          return (
            <Card key={cat.code} variant="compact">
              <CategoryTable
                categoryNameAr={cat.name}
                categoryType={cat.type}
                rows={rows}
                labels={labels}
              />
            </Card>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

interface LabelMaps {
  faculty: Map<string, string>;
  specialization: Map<string, string>;
  committee: Map<string, string>;
  degree: Map<string, string>;
  examRound: Map<string, string>;
  schoolCategory: Map<string, string>;
}

interface CategoryTableProps {
  categoryNameAr: string;
  categoryType: 'university' | 'pre_university';
  rows: ApprovedGeneralRuleRow[];
  labels: LabelMaps;
}

function CategoryTable({
  categoryNameAr,
  categoryType,
  rows,
  labels,
}: CategoryTableProps): JSX.Element {
  return (
    <section className="flex flex-col gap-3" aria-label={`تركيبات فئة ${categoryNameAr}`}>
      <header className="flex items-baseline gap-2">
        <h3 className="font-ar text-sm font-semibold text-ink-900">{categoryNameAr}</h3>
        <span className="font-ar text-2xs text-ink-500">
          {categoryType === 'university' ? 'جامعي' : 'ثانوي'}
        </span>
      </header>
      {categoryType === 'university' ? (
        <UniversityTable
          rows={rows.filter(
            (r): r is LocalUniversityRow => r.kind === 'university',
          )}
          labels={labels}
        />
      ) : (
        <ThanawiTable
          rows={rows.filter(
            (r): r is LocalThanawiRow => r.kind === 'thanawi',
          )}
          labels={labels}
        />
      )}
    </section>
  );
}

/* ── University table ─────────────────────────────────────────────── */

interface UniversityTableProps {
  rows: LocalUniversityRow[];
  labels: LabelMaps;
}

function UniversityTable({ rows, labels }: UniversityTableProps): JSX.Element {
  /** Rows are grouped by faculty (contiguous block), then sorted within
   *  the group by primary academic-degree then specialization name. The
   *  faculty column is repeated on every row — no rowspan — so the
   *  table stays export-friendly and screen-reader scannable. */
  const sorted = useMemo(() => {
    const facultyOrder = new Map<string, number>();
    let nextOrder = 0;
    for (const r of rows) {
      if (!facultyOrder.has(r.facultyCode)) {
        facultyOrder.set(r.facultyCode, nextOrder);
        nextOrder += 1;
      }
    }
    return [...rows].sort((a, b) => {
      const fa = facultyOrder.get(a.facultyCode) ?? 0;
      const fb = facultyOrder.get(b.facultyCode) ?? 0;
      if (fa !== fb) return fa - fb;
      const da = a.academicDegrees[0] ?? '';
      const db = b.academicDegrees[0] ?? '';
      if (da !== db) return da.localeCompare(db, 'ar');
      return a.specializationNameAr.localeCompare(b.specializationNameAr, 'ar');
    });
  }, [rows]);

  if (sorted.length === 0) {
    return <EmptyTable columns={UNI_HEADERS} />;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border-subtle bg-surface-card">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-ink-50/80">
          <tr>
            {UNI_HEADERS.map((h) => (
              <Th key={h}>{h}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => {
            const prev = sorted[i - 1];
            const isFacultyBoundary =
              prev !== undefined && prev.facultyCode !== r.facultyCode;
            return (
              <tr
                key={r.id}
                className={
                  isFacultyBoundary
                    ? 'border-t-2 border-border-default'
                    : 'border-t border-border-subtle'
                }
              >
                <Td>{r.facultyNameAr || labels.faculty.get(r.facultyCode) || '—'}</Td>
                <Td>
                  <ChipList
                    values={r.academicDegrees.map(
                      (c) => labels.degree.get(c) ?? c,
                    )}
                  />
                </Td>
                <Td>
                  {r.specializationNameAr ||
                    labels.specialization.get(r.specializationCode) ||
                    '—'}
                </Td>
                <Td>
                  <ChipList values={r.type.map((g) => GENDER_LABEL[g] ?? g)} />
                </Td>
                <Td>
                  <ChipList
                    values={r.committees.map(
                      (c) => labels.committee.get(c) ?? c,
                    )}
                  />
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const UNI_HEADERS = [
  'الكلية',
  'الدرجة العلمية',
  'التخصص',
  'النوع',
  'اللجنة',
] as const;

/* ── Thanawi table ────────────────────────────────────────────────── */

interface ThanawiTableProps {
  rows: LocalThanawiRow[];
  labels: LabelMaps;
}

function ThanawiTable({ rows, labels }: ThanawiTableProps): JSX.Element {
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const ra = labels.examRound.get(a.examRound) ?? a.examRound;
        const rb = labels.examRound.get(b.examRound) ?? b.examRound;
        if (ra !== rb) return ra.localeCompare(rb, 'ar');
        const ya = a.graduationYear ?? 0;
        const yb = b.graduationYear ?? 0;
        if (ya !== yb) return ya - yb;
        const ca = labels.committee.get(a.committee) ?? a.committee;
        const cb = labels.committee.get(b.committee) ?? b.committee;
        return ca.localeCompare(cb, 'ar');
      }),
    [rows, labels],
  );

  if (sorted.length === 0) {
    return <EmptyTable columns={THANAWI_HEADERS} />;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border-subtle bg-surface-card">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-ink-50/80">
          <tr>
            {THANAWI_HEADERS.map((h) => (
              <Th key={h}>{h}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className="border-t border-border-subtle">
              <Td>{labels.examRound.get(r.examRound) ?? r.examRound}</Td>
              <Td>{labels.committee.get(r.committee) ?? r.committee}</Td>
              <Td>
                {r.graduationYear !== null
                  ? toEasternArabicNumerals(r.graduationYear)
                  : '—'}
              </Td>
              <Td>
                <ChipList
                  values={r.schoolCategories.map(
                    (c) => labels.schoolCategory.get(c) ?? c,
                  )}
                />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const THANAWI_HEADERS = [
  'الدور',
  'اللجنة',
  'سنة التخرج',
  'فئة المدرسة',
] as const;

/* ── Shared bits ──────────────────────────────────────────────────── */

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

/** Renders a multi-select value list as inline pill chips. The whole
 *  group is wrapped in a single-line container that truncates with
 *  ellipsis and exposes the full list through a tooltip on hover or
 *  keyboard focus — matching the truncation contract used elsewhere in
 *  the wizard's grids. */
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
