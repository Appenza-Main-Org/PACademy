/**
 * ApplicantGradesChangesPage — audit surface for grade changes.
 *
 * Lists every grade row whose `gradeChangedAt` is non-null OR whose log
 * carries at least one adjustment. Renders previousGrade vs. current
 * effective grade side-by-side so admins can see at a glance what moved.
 *
 *   GET /admin/applicant-grades/changes
 *
 * Backed by `useApplicantGradesList({ changedOnly: true })` — same
 * paginated query the main list uses, with the changed-only filter
 * pinned on. Sort + search + filter set mirror the main page so the
 * audit view feels familiar.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  History,
  Search,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  DataTable,
  EmptyState,
  LoadingState,
  PageHeader,
  StatCard,
} from '@/shared/components';
import type { DataTableColumn, DataTableSort } from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { toEasternArabicNumerals } from '@/shared/lib/arabic';
import { useApplicantGradesList, useGrades } from '../api/grades.queries';
import { deriveRow, type DerivedRow } from '../lib/derive';
import type { GradeRow } from '../types';

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200] as const;
const DEFAULT_PAGE_SIZE = 50;
const DEBOUNCE_MS = 250;

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

interface ChangedRow extends DerivedRow {
  /** Effective grade *before* the most recent change. When `previousGrade`
   *  is null (only adjustments / overrideMax shifted), falls back to the
   *  current raw total so the "before" column still renders a number. */
  previousEffective: number;
  /** Signed delta = current effective - previousEffective. */
  delta: number;
  /** Latest change instant, parsed into a Date for sort/display. */
  changedAt: Date | null;
}

function deriveChangedRow(r: GradeRow): ChangedRow {
  const derived = deriveRow(r);
  const previousRaw = r.previousGrade ?? r.total;
  /* When previousGrade is null but adjustments exist, "before" is the
   * raw total (no adjustments applied yet) — that's the closest thing
   * we have to "what the value used to be" without keeping a per-edit
   * audit log. */
  const previousEffective = previousRaw;
  const changedAt = r.gradeChangedAt ? new Date(r.gradeChangedAt) : null;
  return {
    ...derived,
    previousEffective,
    delta: derived.eff - previousEffective,
    changedAt,
  };
}

function formatDateTime(d: Date | null): string {
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ApplicantGradesChangesPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const sizeFromUrl = Number(searchParams.get('size') ?? DEFAULT_PAGE_SIZE);
  const pageSize = PAGE_SIZE_OPTIONS.includes(sizeFromUrl as 20 | 50 | 100 | 200)
    ? (sizeFromUrl as number)
    : DEFAULT_PAGE_SIZE;
  const qFromUrl = searchParams.get('q') ?? '';

  const [searchInput, setSearchInput] = useState(qFromUrl);
  const debouncedSearch = useDebouncedValue(searchInput, DEBOUNCE_MS);
  const [sort, setSort] = useState<DataTableSort<ChangedRow> | null>(null);

  useEffect(() => {
    if (debouncedSearch === qFromUrl) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (debouncedSearch.trim() === '') next.delete('q');
        else next.set('q', debouncedSearch);
        next.set('page', '1');
        return next;
      },
      { replace: true },
    );
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [debouncedSearch]);

  const { data: paginatedData, isLoading } = useApplicantGradesList({
    page,
    pageSize,
    search: qFromUrl,
    /* The grades-paginated query is generic over GradeRow keys; sort by
     * a derived key here would be invalid at the service layer, so we
     * pass through total/seat sorts only and let the client refine. */
    sort: null,
    changedOnly: true,
  });
  const { data: allRows } = useGrades();

  const allChangedRows = useMemo<ChangedRow[]>(() => {
    return (allRows ?? [])
      .filter((r) => r.gradeChangedAt != null || r.log.length > 0)
      .map(deriveChangedRow);
  }, [allRows]);

  const rows = useMemo<ChangedRow[]>(
    () => (paginatedData?.rows ?? []).map(deriveChangedRow),
    [paginatedData?.rows],
  );

  const sortedRows = useMemo<ChangedRow[]>(() => {
    if (!sort) return rows;
    const dir = sort.direction === 'asc' ? 1 : -1;
    const key = sort.key;
    return rows.slice().sort((a, b) => {
      const av = a[key] as unknown;
      const bv = b[key] as unknown;
      if (av instanceof Date || bv instanceof Date) {
        const at = av instanceof Date ? av.getTime() : 0;
        const bt = bv instanceof Date ? bv.getTime() : 0;
        return (at - bt) * dir;
      }
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av ?? '').localeCompare(String(bv ?? ''), 'ar', {
        sensitivity: 'base',
      }) * dir;
    });
  }, [rows, sort]);

  const total = paginatedData?.total ?? 0;
  const totalChanged = allChangedRows.length;
  const upsCount = allChangedRows.filter((r) => r.delta > 0).length;
  const downsCount = allChangedRows.filter((r) => r.delta < 0).length;

  function setPage(p: number): void {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('page', String(Math.max(1, p)));
        return next;
      },
      { replace: true },
    );
  }
  function setSize(s: number): void {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('size', String(s));
        next.set('page', '1');
        return next;
      },
      { replace: true },
    );
  }

  const columns: DataTableColumn<ChangedRow>[] = [
    {
      key: 'nid',
      label: 'الرقم القومي',
      sortable: true,
      getSortValue: (r) => r.nid,
      filter: { kind: 'text', getValue: (r) => r.nid, placeholder: '14 رقماً…' },
      className: 'min-w-[14ch]',
      render: (r) => (
        <span className="font-mono text-2xs text-ink-600" dir="ltr">
          {r.nid}
        </span>
      ),
    },
    {
      key: 'seatingNumber',
      label: 'رقم الجلوس',
      sortable: true,
      align: 'center',
      getSortValue: (r) => r.seatingNumber ?? '',
      filter: { kind: 'text', getValue: (r) => r.seatingNumber ?? '' },
      className: 'min-w-[9ch] font-numeric tabular-nums whitespace-nowrap',
      render: (r) =>
        r.seatingNumber ? (
          <span dir="ltr" className="font-en text-xs text-ink-700">
            {r.seatingNumber}
          </span>
        ) : (
          <span className="text-2xs text-ink-300">—</span>
        ),
    },
    {
      key: 'name',
      label: 'الاسم',
      sortable: true,
      getSortValue: (r) => r.name,
      filter: { kind: 'text', getValue: (r) => r.name },
      className: 'min-w-[18ch] whitespace-normal',
      render: (r) => <span className="font-medium text-ink-900">{r.name}</span>,
    },
    {
      key: 'previousEffective',
      label: 'الدرجة السابقة',
      align: 'center',
      sortable: true,
      getSortValue: (r) => r.previousEffective,
      filter: { kind: 'number', getValue: (r) => r.previousEffective },
      className: 'min-w-[10ch] font-numeric tabular-nums whitespace-nowrap',
      render: (r) => (
        <span className="text-ink-600">{Math.round(r.previousEffective)}</span>
      ),
    },
    {
      key: 'eff',
      label: 'الدرجة الحالية',
      align: 'center',
      sortable: true,
      getSortValue: (r) => r.eff,
      filter: { kind: 'number', getValue: (r) => r.eff },
      className: 'min-w-[14ch] font-numeric tabular-nums whitespace-nowrap',
      render: (r) => (
        <span className="flex items-center justify-center gap-2">
          <span
            className={`font-semibold ${
              r.delta > 0 ? 'text-gold-700' : r.delta < 0 ? 'text-terra-700' : 'text-ink-900'
            }`}
          >
            {Math.round(r.eff)}
          </span>
          {r.delta !== 0 && (
            <Badge
              tone={r.delta > 0 ? 'warning' : 'danger'}
              icon={
                r.delta > 0 ? (
                  <TrendingUp size={9} strokeWidth={2.5} aria-hidden />
                ) : (
                  <TrendingDown size={9} strokeWidth={2.5} aria-hidden />
                )
              }
              className="!px-1.5 !py-0 !text-2xs"
            >
              <span className="font-numeric tabular-nums">
                {r.delta > 0 ? '+' : ''}
                {Math.round(r.delta)}
              </span>
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: 'changedAt',
      label: 'تاريخ التعديل',
      align: 'center',
      sortable: true,
      getSortValue: (r) => (r.changedAt ? r.changedAt.getTime() : 0),
      className: 'min-w-[16ch] whitespace-nowrap',
      render: (r) => (
        <span className="text-2xs text-ink-600">{formatDateTime(r.changedAt)}</span>
      ),
    },
    {
      key: 'lastEditedBy',
      label: 'المسؤول عن التعديل',
      sortable: true,
      getSortValue: (r) => r.lastEditedBy ?? '',
      filter: { kind: 'text', getValue: (r) => r.lastEditedBy ?? '' },
      className: 'min-w-[14ch]',
      render: (r) =>
        r.lastEditedBy ? (
          <span className="text-xs text-ink-700">{r.lastEditedBy}</span>
        ) : (
          <span className="text-2xs text-ink-300">—</span>
        ),
    },
  ];

  if (isLoading && !paginatedData) {
    return (
      <div>
        <PageHeader
          title="تعديلات درجات المتقدمين"
          subtitle="جميع الطلاب الذين تم تعديل درجاتهم منذ الاستيراد الأصلي"
          breadcrumbs={[
            { label: 'لوحة القبول', href: ROUTES.admin.dashboard },
            { label: 'درجات المتقدمين', href: ROUTES.admin.applicantGrades },
            { label: 'تعديلات الدرجات' },
          ]}
        />
        <LoadingState variant="page" />
      </div>
    );
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <PageHeader
        title="تعديلات درجات المتقدمين"
        subtitle="جميع الطلاب الذين تم تعديل درجاتهم منذ الاستيراد الأصلي"
        breadcrumbs={[
          { label: 'لوحة القبول', href: ROUTES.admin.dashboard },
          { label: 'درجات المتقدمين', href: ROUTES.admin.applicantGrades },
          { label: 'تعديلات الدرجات' },
        ]}
        actions={
          <Button
            variant="ghost"
            leadingIcon={<ArrowLeft size={14} strokeWidth={1.75} />}
            onClick={() => navigate(ROUTES.admin.applicantGrades)}
          >
            العودة للقائمة
          </Button>
        }
      />

      {totalChanged === 0 ? (
        <Card>
          <CardBody className="px-6 py-12">
            <EmptyState
              variant="generic"
              title="لا توجد تعديلات بعد"
              description="لم يتم تعديل درجات أي طالب منذ آخر استيراد. ستظهر التعديلات هنا بمجرد تسجيلها."
              icon={<History size={28} strokeWidth={1.5} />}
              action={
                <Button
                  variant="primary"
                  onClick={() => navigate(ROUTES.admin.applicantGrades)}
                >
                  العودة للقائمة
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <>
          <div
            className="mb-6 grid gap-5"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
          >
            <StatCard
              label="إجمالي التعديلات"
              value={totalChanged}
              icon={<History size={16} strokeWidth={1.75} />}
              iconBg="var(--gold-50)"
              iconColor="var(--gold-700)"
            />
            <StatCard
              label="درجات ارتفعت"
              value={upsCount}
              icon={<TrendingUp size={16} strokeWidth={1.75} />}
              iconBg="var(--gold-50)"
              iconColor="var(--gold-700)"
            />
            <StatCard
              label="درجات انخفضت"
              value={downsCount}
              icon={<TrendingDown size={16} strokeWidth={1.75} />}
              iconBg="var(--terra-50)"
              iconColor="var(--terra-700)"
            />
          </div>

          <Card>
            <CardBody className="card-body">
              <div className="filters">
                <div className="search flex-1" style={{ minInlineSize: 360 }}>
                  <input
                    className="input"
                    type="search"
                    placeholder="بحث بالاسم / الرقم القومي / رقم الجلوس"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    aria-label="بحث"
                  />
                  <Search size={18} />
                </div>
                {qFromUrl && (
                  <button
                    type="button"
                    onClick={() => setSearchInput('')}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-full border-0 bg-transparent px-2 py-0.5 text-2xs text-teal-700 hover:bg-teal-50"
                  >
                    <X size={11} strokeWidth={1.75} aria-hidden /> مسح البحث
                  </button>
                )}
                <span className="ms-auto self-center text-2xs text-ink-500">
                  <span className="font-numeric font-medium tabular-nums text-ink-700">
                    {total}
                  </span>{' '}
                  نتيجة
                </span>
              </div>

              <DataTable<ChangedRow>
                data={sortedRows}
                columns={columns}
                rowKey={(r) => r.seat}
                sort={sort}
                onSortChange={setSort}
                empty={
                  <EmptyState
                    variant="generic"
                    title="لا نتائج مطابقة"
                    description={
                      qFromUrl
                        ? `لا توجد نتائج لـ "${qFromUrl}"`
                        : 'لا توجد صفوف مطابقة للتصفية الحالية'
                    }
                    icon={<Search size={28} strokeWidth={1.5} />}
                    action={
                      qFromUrl ? (
                        <Button variant="ghost" onClick={() => setSearchInput('')}>
                          مسح البحث
                        </Button>
                      ) : undefined
                    }
                  />
                }
                zebraStripes
                stickyHeader
                density="compact"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle bg-surface-card px-4 py-2 text-sm text-ink-500">
                <span className="font-numeric tnum">
                  عرض{' '}
                  <span className="text-ink-900">{toEasternArabicNumerals(from)}</span>
                  –<span className="text-ink-900">{toEasternArabicNumerals(to)}</span> من{' '}
                  <span className="text-ink-900">{toEasternArabicNumerals(total)}</span>
                </span>
                <label className="inline-flex items-center gap-2">
                  <span>لكل صفحة:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setSize(Number(e.target.value))}
                    className="rounded-md border border-border-default bg-surface-card px-2 py-1 text-sm focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none"
                    aria-label="عدد الصفوف لكل صفحة"
                  >
                    {PAGE_SIZE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    aria-label="الصفحة السابقة"
                  >
                    السابق
                  </Button>
                  <span className="px-2 font-en">
                    {page} / {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                    aria-label="الصفحة التالية"
                  >
                    التالي
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
