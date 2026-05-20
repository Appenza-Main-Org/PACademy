/**
 * ApplicantGradesPage — admin landing for the grades import + adjustment
 * surface.
 *
 * v2 changes vs. the earlier modal-based wizard:
 *   • "استيراد ملف" navigates to the standalone `/admin/applicant-grades/import`
 *     wizard page (no more in-page modal).
 *   • Server-side pagination + search via `useApplicantGradesList` —
 *     `page`, `size`, `q` live in URL search params so refresh preserves
 *     position.
 *   • Toolbar "تصدير" Dropdown — current page vs. all-data, CSV vs. XLSX.
 *     The full-data export bypasses pagination via `gradesService.exportAll`.
 *   • Toolbar "تنزيل نموذج Excel" → `buildTemplateWorkbook`.
 *   • New `seatingNumber` column rendered in Western numerals (LTR).
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  History,
  Info,
  Layers,
  ListChecks,
  MoreVertical,
  Plus,
  Search,
  Sheet as SheetIcon,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  AlertDialog,
  Badge,
  Button,
  Card,
  CardBody,
  DataTable,
  DropdownMenu,
  EmptyState,
  LoadingState,
  PageHeader,
  StatCard,
  toast,
} from '@/shared/components';
import type { DataTableColumn, DataTableSort } from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { toEasternArabicNumerals } from '@/shared/lib/arabic';
import { serializeCsv } from '@/shared/lib/csv';
import { downloadBlob } from '@/shared/lib/download';
import { useLookup } from '@/features/lookups';
import { useApplicantGradesList, useClearGrades, useGrades } from '../api/grades.queries';
import { gradesService } from '../api/grades.service';
import { downloadTemplateWorkbook } from '../lib/buildTemplateWorkbook';
import { useImportWizardStore } from '../store/importWizard.store';
import { AddAdjustmentDialog } from '../components/AddAdjustmentDialog';
import { LogDrawer } from '../components/LogDrawer';
import { StudentDetailsDrawer } from '../components/StudentDetailsDrawer';
import { deriveRow, type DerivedRow } from '../lib/derive';
import type { ApplicantGender, GradeRow } from '../types';

type OverlayState =
  | { kind: 'add-adj'; seat: number }
  | { kind: 'log'; seat: number }
  | { kind: 'student'; seat: number }
  | null;

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 10_000;

function parsePageSize(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, n);
}

const DEBOUNCE_MS = 250;

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function ApplicantGradesPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const resetImportWizard = useImportWizardStore((s) => s.reset);

  /* Every "استيراد ملف" entry resets the wizard before navigating.
   * The persisted sessionStorage state is only there to survive an
   * accidental refresh mid-flow — starting a new import deliberately
   * should always begin at Step 1 with the prior File reference gone
   * (File objects don't survive a navigation anyway, so resuming a
   * past session at Step 5 would land in a broken empty state). */
  const startNewImport = (): void => {
    resetImportWizard();
    navigate(ROUTES.admin.applicantGradesImport);
  };

  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const pageSize = parsePageSize(searchParams.get('size'));
  const qFromUrl = searchParams.get('q') ?? '';

  /* Filter state lives in URL search params so refresh / share preserves
   * the active filter set. `'all'` is the sentinel for "no filter"; the
   * service layer treats it the same as omitting the field. */
  const genderFromUrl = (searchParams.get('gender') ?? 'all') as ApplicantGender | 'all';
  const branchFromUrl = searchParams.get('branch') ?? 'all';
  const yearFromUrlRaw = searchParams.get('year') ?? 'all';
  const yearFromUrl: number | 'all' =
    yearFromUrlRaw === 'all' ? 'all' : Number(yearFromUrlRaw) || 'all';
  const schoolCategoryFromUrl = searchParams.get('school') ?? 'all';
  const changedOnly = searchParams.get('changed') === '1';

  const schoolCategoriesQuery = useLookup('school-categories');
  const activeSchoolCategories = useMemo(
    () => (schoolCategoriesQuery.data ?? []).filter((r) => r.isActive),
    [schoolCategoriesQuery.data],
  );
  const schoolCategoryLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of schoolCategoriesQuery.data ?? []) map.set(r.code, r.name);
    return map;
  }, [schoolCategoriesQuery.data]);

  /* Local search input that debounces into the URL state. The URL
   * value is the source of truth for the query; the input only
   * mirrors it so a refresh restores both. */
  const [searchInput, setSearchInput] = useState(qFromUrl);
  const debouncedSearch = useDebouncedValue(searchInput, DEBOUNCE_MS);

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

  const [overlay, setOverlay] = useState<OverlayState>(null);
  const [sort, setSort] = useState<DataTableSort<GradeRow> | null>(null);
  const [exporting, setExporting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const clearMut = useClearGrades();

  const { data: paginatedData, isLoading } = useApplicantGradesList({
    page,
    pageSize,
    search: qFromUrl,
    sort,
    gender: genderFromUrl,
    branch: branchFromUrl,
    graduationYear: yearFromUrl,
    schoolCategoryCode: schoolCategoryFromUrl,
    changedOnly,
  });
  /* Keep the unpaginated query alive so the stats strip + overlay
   * drawers have the full set of rows to render against. */
  const { data: allRows } = useGrades();

  const rows = paginatedData?.rows ?? [];
  const total = paginatedData?.total ?? 0;
  const derived = useMemo<DerivedRow[]>(() => rows.map(deriveRow), [rows]);
  const totalsAll = allRows?.length ?? 0;
  const generalCount = (allRows ?? []).filter((r) => r.kind === 'general').length;
  const azharCount = (allRows ?? []).filter((r) => r.kind === 'azhar').length;
  const withAdjCount = (allRows ?? []).filter((r) => r.log.some((x) => x.isActive)).length;

  /* Branch + year filter options are derived from rows actually present
   * in the dataset. The year filter is back-padded with the last 10
   * years so newly-uploaded datasets always have a usable range even
   * before any row carries a real graduationYear. */
  const branchOptions = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const r of allRows ?? []) if (r.branch) set.add(r.branch);
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [allRows]);

  /* Year filter options come from the admin-managed `graduation-years`
   * lookup (active rows only). Falling back to the years actually
   * present in the imported rows + the current cycle year keeps the
   * filter usable while the lookup is loading or if it ends up empty
   * after admin pruning. */
  const graduationYearsQuery = useLookup('graduation-years');
  const yearOptions = useMemo<number[]>(() => {
    const set = new Set<number>();
    const lookupRows = graduationYearsQuery.data ?? [];
    for (const r of lookupRows) {
      if (r.isActive && Number.isFinite(r.year)) set.add(r.year);
    }
    if (set.size === 0) {
      for (const r of allRows ?? []) {
        if (typeof r.graduationYear === 'number') set.add(r.graduationYear);
      }
      set.add(new Date().getFullYear());
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [allRows, graduationYearsQuery.data]);

  function setFilter(key: 'gender' | 'branch' | 'year' | 'school', value: string): void {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === 'all') next.delete(key);
        else next.set(key, value);
        next.set('page', '1');
        return next;
      },
      { replace: true },
    );
  }

  function setChangedOnly(value: boolean): void {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set('changed', '1');
        else next.delete('changed');
        next.set('page', '1');
        return next;
      },
      { replace: true },
    );
  }

  const activeFilterCount =
    (genderFromUrl !== 'all' ? 1 : 0) +
    (branchFromUrl !== 'all' ? 1 : 0) +
    (yearFromUrl !== 'all' ? 1 : 0) +
    (schoolCategoryFromUrl !== 'all' ? 1 : 0) +
    (changedOnly ? 1 : 0);

  function clearAllFilters(): void {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('gender');
        next.delete('branch');
        next.delete('year');
        next.delete('school');
        next.delete('changed');
        next.set('page', '1');
        return next;
      },
      { replace: true },
    );
  }

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

  async function handleExport(scope: 'page' | 'all', format: 'csv' | 'xlsx'): Promise<void> {
    if (exporting) return;
    setExporting(true);
    const toastTimer = window.setTimeout(
      () => toast('جارٍ تجهيز الملف…', 'info'),
      150,
    );
    try {
      const dataset =
        scope === 'all'
          ? await gradesService.exportAll({
              search: qFromUrl,
              sort,
              gender: genderFromUrl,
              branch: branchFromUrl,
              graduationYear: yearFromUrl,
              schoolCategoryCode: schoolCategoryFromUrl,
              changedOnly,
            })
          : rows;
      const today = new Date().toISOString().slice(0, 10);
      const filename = `applicant-grades-2026-${today}.${format}`;
      const headers = [
        'الرقم القومي',
        'رقم الجلوس',
        'الاسم باللغة العربية',
        'نوع الشهادة',
        'النوع',
        'الشعبة',
        'سنة التخرج',
        'فئة المدرسة',
        'اسم المدرسة',
        'المحافظة',
        'الدور',
        'المجموع الكلي',
        'الدرجة العظمى',
      ];
      const csvRows = dataset.map((r) => [
        r.nid,
        r.seatingNumber ?? '',
        r.name,
        r.kind === 'azhar' ? 'ثانوية أزهرية' : 'ثانوية عامة',
        r.gender === 'female' ? 'أنثى' : 'ذكر',
        r.branch,
        r.graduationYear ?? '',
        r.schoolCategoryCode ? schoolCategoryLabel.get(r.schoolCategoryCode) ?? '' : '',
        r.school ?? '',
        r.region ?? '',
        r.examRound ?? '',
        r.total,
        r.overrideMax ?? r.importMax,
      ]);
      if (format === 'csv') {
        const csv = serializeCsv(headers, csvRows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        downloadBlob(blob, filename);
      } else {
        const XLSX = await import('xlsx');
        const aoa: unknown[][] = [headers, ...csvRows];
        const sheet = XLSX.utils.aoa_to_sheet(aoa);
        sheet['!freeze'] = { ySplit: 1 };
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, sheet, 'درجات المتقدمين');
        const bin = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
        const blob = new Blob([bin], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        downloadBlob(blob, filename);
      }
      window.clearTimeout(toastTimer);
      toast(`تم تنزيل ${dataset.length.toLocaleString('en')} صفًا.`, 'success');
    } catch {
      window.clearTimeout(toastTimer);
      toast('تعذّر تصدير الملف. حاول مرة أخرى.', 'danger');
    } finally {
      setExporting(false);
    }
  }

  async function handleReset(): Promise<void> {
    try {
      await clearMut.mutateAsync();
      setConfirmReset(false);
      setSearchInput('');
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('q');
          next.set('page', '1');
          return next;
        },
        { replace: true },
      );
      toast('تم تصفير البيانات.', 'success');
    } catch {
      toast('تعذّر تصفير البيانات. حاول مرة أخرى.', 'danger');
    }
  }

  const activeRow =
    overlay && 'seat' in overlay
      ? (allRows ?? []).find((r) => r.seat === overlay.seat)
      : null;
  const activeDerived = activeRow ? deriveRow(activeRow) : null;

  const columns: DataTableColumn<DerivedRow>[] = [
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
      key: 'total',
      label: 'المجموع الإجمالي',
      align: 'center',
      sortable: true,
      getSortValue: (r) => r.total,
      filter: { kind: 'number', getValue: (r) => r.total },
      className: 'min-w-[14ch] font-numeric tabular-nums whitespace-nowrap',
      render: (r) => (
        <>
          <span className="font-semibold text-ink-900">{Math.round(r.total)}</span>
          <span className="text-2xs text-ink-300"> / </span>
          <span className="text-2xs text-ink-400">{Math.round(r.max)}</span>
        </>
      ),
    },
    {
      key: 'pct',
      label: 'النسبة',
      align: 'center',
      sortable: true,
      getSortValue: (r) => r.pct,
      filter: { kind: 'number', getValue: (r) => r.pct },
      className: 'min-w-[8ch] font-numeric tabular-nums',
      render: (r) => (
        <>
          <span className="font-semibold text-ink-900">{r.pct.toFixed(2)}</span>
          <span className="text-2xs text-ink-400">٪</span>
        </>
      ),
    },
    {
      key: 'eff',
      label: 'المجموع بعد التعديل',
      align: 'center',
      sortable: true,
      getSortValue: (r) => r.eff,
      filter: { kind: 'number', getValue: (r) => r.eff },
      className: 'min-w-[18ch] font-numeric tabular-nums whitespace-nowrap',
      render: (r) => (
        <span className="flex items-center justify-center gap-2">
          <span
            className={`font-bold ${
              r.adj > 0 ? 'text-gold-700' : r.adj < 0 ? 'text-terra-700' : 'text-ink-900'
            }`}
          >
            {Math.round(r.eff)}
          </span>
          {r.adj !== 0 && (
            <Badge
              tone={r.adj > 0 ? 'warning' : 'danger'}
              icon={
                r.adj > 0 ? (
                  <ArrowUpRight size={9} strokeWidth={2.5} aria-hidden />
                ) : (
                  <ArrowDownRight size={9} strokeWidth={2.5} aria-hidden />
                )
              }
              className="!px-1.5 !py-0 !text-2xs"
            >
              <span className="font-numeric tabular-nums">{Math.abs(r.adj)}</span>
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: 'kind',
      label: 'النوع',
      align: 'center',
      sortable: true,
      getSortValue: (r) => r.kind,
      filter: {
        kind: 'enum',
        getValue: (r) => r.kind,
        options: [
          { value: 'general', label: 'عامة' },
          { value: 'azhar', label: 'أزهرية' },
        ],
      },
      className: 'min-w-[6ch]',
      render: (r) => (
        <Badge tone={r.kind === 'general' ? 'info' : 'warning'}>
          {r.kind === 'general' ? 'عامة' : 'أزهرية'}
        </Badge>
      ),
    },
    {
      key: 'branch',
      label: 'الشعبة',
      hideOn: 'md',
      sortable: true,
      getSortValue: (r) => r.branch ?? '',
      filter: { kind: 'text', getValue: (r) => r.branch ?? '' },
      className: 'min-w-[10ch]',
      render: (r) => <span className="text-xs">{r.branch}</span>,
    },
    {
      key: 'graduationYear',
      label: 'سنة التخرج',
      align: 'center',
      sortable: true,
      hideOn: 'md',
      getSortValue: (r) => r.graduationYear ?? 0,
      filter: { kind: 'number', getValue: (r) => r.graduationYear ?? null },
      className: 'min-w-[8ch] font-numeric tabular-nums whitespace-nowrap',
      render: (r) =>
        r.graduationYear != null ? (
          <span className="font-en text-xs text-ink-700">{r.graduationYear}</span>
        ) : (
          <span className="text-2xs text-ink-300">—</span>
        ),
    },
    {
      key: 'schoolCategoryCode',
      label: 'فئة المدرسة',
      hideOn: 'md',
      sortable: true,
      getSortValue: (r) => r.schoolCategoryCode ?? '',
      filter: {
        kind: 'enum',
        getValue: (r) => r.schoolCategoryCode ?? '',
        options: activeSchoolCategories.map((s) => ({ value: s.code, label: s.name })),
      },
      className: 'min-w-[10ch]',
      render: (r) =>
        r.schoolCategoryCode ? (
          <span className="text-xs text-ink-700">
            {schoolCategoryLabel.get(r.schoolCategoryCode) ?? r.schoolCategoryCode}
          </span>
        ) : (
          <span className="text-2xs text-ink-300">—</span>
        ),
    },
    {
      key: 'school',
      label: 'اسم المدرسة',
      sortable: true,
      getSortValue: (r) => r.school ?? '',
      filter: { kind: 'text', getValue: (r) => r.school ?? '' },
      className: 'min-w-[16ch] whitespace-normal',
      render: (r) =>
        r.school ? (
          <span className="text-xs text-ink-700">{r.school}</span>
        ) : (
          <span className="text-2xs text-ink-300">—</span>
        ),
    },
    {
      key: 'region',
      label: 'المحافظة',
      sortable: true,
      getSortValue: (r) => r.region ?? '',
      filter: { kind: 'text', getValue: (r) => r.region ?? '' },
      className: 'min-w-[10ch] whitespace-normal',
      render: (r) =>
        r.region ? (
          <span className="text-xs text-ink-700">{r.region}</span>
        ) : (
          <span className="text-2xs text-ink-300">—</span>
        ),
    },
    {
      key: 'examRound',
      label: 'الدور',
      align: 'center',
      sortable: true,
      getSortValue: (r) => r.examRound ?? '',
      filter: { kind: 'text', getValue: (r) => r.examRound ?? '' },
      className: 'min-w-[7ch]',
      render: (r) =>
        r.examRound ? (
          <span className="text-xs text-ink-700">{r.examRound}</span>
        ) : (
          <span className="text-2xs text-ink-300">—</span>
        ),
    },
    {
      key: 'actions',
      label: 'إجراءات',
      align: 'center',
      className: 'min-w-[8ch] whitespace-nowrap',
      render: (r) => <RowActions row={r} onSelect={setOverlay} />,
    },
  ];

  const isEmpty = totalsAll === 0;

  if (isLoading && !paginatedData) {
    return (
      <div>
        <PageHeader
          title="درجات الثانوية العامة والأزهرية"
          subtitle="استيراد درجات الطلاب من ملفات Excel وإدارة التعديلات"
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
        title="درجات الثانوية العامة والأزهرية"
        subtitle="استيراد درجات الطلاب من ملفات Excel وإدارة التعديلات"
        actions={
          <>
            <Button
              variant="ghost"
              leadingIcon={<FileText size={14} strokeWidth={1.75} />}
              onClick={() => void downloadTemplateWorkbook()}
            >
              تنزيل نموذج Excel
            </Button>
            <Button
              variant="ghost"
              leadingIcon={<ListChecks size={14} strokeWidth={1.75} />}
              onClick={() => navigate(ROUTES.admin.applicantGradesChanges)}
            >
              تعديلات الدرجات
            </Button>
            {!isEmpty && (
              <DropdownMenu>
                <DropdownMenu.Trigger asChild>
                  <Button
                    variant="secondary"
                    leadingIcon={<Download size={14} strokeWidth={1.75} />}
                    disabled={exporting}
                  >
                    تصدير
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content sideOffset={6}>
                  <DropdownMenu.Item
                    leadingIcon={<SheetIcon size={14} strokeWidth={1.75} aria-hidden />}
                    onSelect={() => void handleExport('all', 'csv')}
                  >
                    تصدير كل البيانات (CSV)
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    leadingIcon={<SheetIcon size={14} strokeWidth={1.75} aria-hidden />}
                    onSelect={() => void handleExport('all', 'xlsx')}
                  >
                    تصدير كل البيانات (XLSX)
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    leadingIcon={<FileText size={14} strokeWidth={1.75} aria-hidden />}
                    onSelect={() => void handleExport('page', 'csv')}
                  >
                    تصدير الصفحة الحالية (CSV)
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu>
            )}
            {!isEmpty && (
              <Button
                variant="ghost"
                leadingIcon={<Trash2 size={14} strokeWidth={1.75} />}
                onClick={() => setConfirmReset(true)}
                className="!text-terra-700 hover:!bg-terra-50"
              >
                تصفير البيانات
              </Button>
            )}
            <Button
              variant="primary"
              leadingIcon={<Upload size={14} strokeWidth={1.75} />}
              onClick={startNewImport}
            >
              استيراد ملف
            </Button>
          </>
        }
      />

      {isEmpty ? (
        <EmptyGradesCard onImport={startNewImport} />
      ) : (
        <>
          <div
            className="mb-6 grid gap-5"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
          >
            <StatCard
              label="إجمالي الطلاب"
              value={totalsAll}
              icon={<Layers size={16} strokeWidth={1.75} />}
            />
            <StatCard
              label="ثانوية عامة"
              value={generalCount}
              icon={<FileSpreadsheet size={16} strokeWidth={1.75} />}
              iconBg="var(--teal-50)"
              iconColor="var(--teal-700)"
            />
            <StatCard
              label="ثانوية أزهرية"
              value={azharCount}
              icon={<FileSpreadsheet size={16} strokeWidth={1.75} />}
              iconBg="var(--gold-50)"
              iconColor="var(--gold-700)"
            />
            <StatCard
              label="صفوف بها تعديلات"
              value={withAdjCount}
              icon={<History size={16} strokeWidth={1.75} />}
              iconBg="var(--gold-50)"
              iconColor="var(--gold-700)"
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
                <select
                  className="select"
                  value={genderFromUrl}
                  onChange={(e) => setFilter('gender', e.target.value)}
                  aria-label="تصفية حسب النوع"
                >
                  <option value="all">كل الأنواع</option>
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
                <select
                  className="select"
                  value={branchFromUrl}
                  onChange={(e) => setFilter('branch', e.target.value)}
                  aria-label="تصفية حسب الشعبة"
                >
                  <option value="all">كل الشعب</option>
                  {branchOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <select
                  className="select"
                  value={yearFromUrl === 'all' ? 'all' : String(yearFromUrl)}
                  onChange={(e) => setFilter('year', e.target.value)}
                  aria-label="تصفية حسب سنة التخرج"
                >
                  <option value="all">كل السنوات</option>
                  {yearOptions.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
                <select
                  className="select"
                  value={schoolCategoryFromUrl}
                  onChange={(e) => setFilter('school', e.target.value)}
                  aria-label="تصفية حسب فئة المدرسة"
                  style={{ flex: '0 0 auto', inlineSize: 380 }}
                >
                  <option value="all">كل فئات المدرسة</option>
                  {activeSchoolCategories.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  role="switch"
                  aria-checked={changedOnly}
                  onClick={() => setChangedOnly(!changedOnly)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-2xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  style={{
                    background: changedOnly ? 'var(--gold-500)' : 'var(--surface-card)',
                    color: changedOnly ? 'var(--text-inverse)' : 'var(--ink-700)',
                    borderColor: changedOnly ? 'var(--gold-500)' : 'var(--border-default)',
                  }}
                  title="تصفية الطلاب الذين تم تعديل درجاتهم"
                >
                  <ListChecks size={12} strokeWidth={1.75} aria-hidden />
                  درجات معدّلة فقط
                </button>
                {changedOnly && (
                  <a
                    href={ROUTES.admin.applicantGradesChanges}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(ROUTES.admin.applicantGradesChanges);
                    }}
                    className="text-2xs text-teal-700 underline-offset-2 hover:underline"
                  >
                    عرض صفحة تعديلات الدرجات
                  </a>
                )}
                {(activeFilterCount > 0 || qFromUrl) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (qFromUrl) setSearchInput('');
                      if (activeFilterCount > 0) clearAllFilters();
                    }}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-full border-0 bg-transparent px-2 py-0.5 text-2xs text-teal-700 hover:bg-teal-50"
                  >
                    <X size={11} strokeWidth={1.75} aria-hidden /> مسح التصفية
                  </button>
                )}
                <span className="ms-auto self-center text-2xs text-ink-500">
                  <span className="font-numeric font-medium tabular-nums text-ink-700">
                    {total}
                  </span>{' '}
                  نتيجة
                </span>
              </div>

              <DataTable<DerivedRow>
                data={derived}
                columns={columns}
                rowKey={(r) => r.seat}
                sort={sort as DataTableSort<DerivedRow> | null}
                onSortChange={(next) => setSort(next as DataTableSort<GradeRow> | null)}
                onRowClick={(r) => setOverlay({ kind: 'student', seat: r.seat })}
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
                <PageSizeSelector pageSize={pageSize} onChange={setSize} />

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

      <AlertDialog
        open={confirmReset}
        onOpenChange={(next) => {
          if (!clearMut.isPending) setConfirmReset(next);
        }}
        title="تصفير بيانات الدرجات"
        description={`سيتم حذف جميع الصفوف المستوردة وما عليها من تعديلات (${toEasternArabicNumerals(totalsAll)} صفًا). لا يمكن التراجع.`}
        actionLabel="تصفير البيانات"
        cancelLabel="إلغاء"
        tone="danger"
        isActionLoading={clearMut.isPending}
        onAction={() => void handleReset()}
      />

      {activeDerived && (
        <>
          <AddAdjustmentDialog
            open={overlay?.kind === 'add-adj'}
            onClose={() => setOverlay(null)}
            row={activeDerived}
          />
          <LogDrawer
            open={overlay?.kind === 'log'}
            onClose={() => setOverlay(null)}
            row={activeDerived}
            onAddAdjustment={() => setOverlay({ kind: 'add-adj', seat: activeDerived.seat })}
            onOpenDetails={() => setOverlay({ kind: 'student', seat: activeDerived.seat })}
          />
          <StudentDetailsDrawer
            open={overlay?.kind === 'student'}
            onClose={() => setOverlay(null)}
            row={activeDerived}
            onAddAdjustment={() => setOverlay({ kind: 'add-adj', seat: activeDerived.seat })}
          />
        </>
      )}
    </div>
  );
}

function RowActions({
  row,
  onSelect,
}: {
  row: DerivedRow;
  onSelect: (next: OverlayState) => void;
}): JSX.Element {
  const hasAdjustments = row.log.length > 0;
  return (
    <span
      className="relative inline-flex"
      onClick={(e) => e.stopPropagation()}
      title={hasAdjustments ? 'يوجد تعديلات' : undefined}
    >
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="إجراءات"
            leadingIcon={<MoreVertical size={18} strokeWidth={2} aria-hidden />}
            className="!h-8 !w-8 !text-ink-700 hover:!bg-ink-100 hover:!text-ink-900 focus-visible:!bg-ink-100"
          />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content sideOffset={6}>
          <DropdownMenu.Item
            leadingIcon={<Plus size={14} strokeWidth={1.75} className="text-teal-700" aria-hidden />}
            onSelect={() => onSelect({ kind: 'add-adj', seat: row.seat })}
          >
            إضافة تعديل
          </DropdownMenu.Item>
          <DropdownMenu.Item
            leadingIcon={<History size={14} strokeWidth={1.75} className="text-gold-700" aria-hidden />}
            onSelect={() => onSelect({ kind: 'log', seat: row.seat })}
          >
            عرض السجل
          </DropdownMenu.Item>
          <DropdownMenu.Item
            leadingIcon={<Eye size={14} strokeWidth={1.75} className="text-ink-600" aria-hidden />}
            onSelect={() => onSelect({ kind: 'student', seat: row.seat })}
          >
            تفاصيل الطالب
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
      {hasAdjustments && (
        <span
          aria-hidden
          className="pointer-events-none absolute -end-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-gold-500 ring-2 ring-white"
        />
      )}
    </span>
  );
}

function EmptyGradesCard({ onImport }: { onImport: () => void }): JSX.Element {
  return (
    <Card>
      <CardBody className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <svg width="120" height="96" viewBox="0 0 120 96" aria-hidden>
          <rect width="120" height="96" rx="8" fill="var(--ink-50)" />
          <rect
            x="22"
            y="18"
            width="76"
            height="60"
            rx="4"
            fill="var(--surface-card)"
            stroke="var(--gold-500)"
            strokeWidth="1.25"
          />
          <line x1="22" y1="32" x2="98" y2="32" stroke="var(--ink-200)" strokeWidth="0.75" />
          <line x1="22" y1="44" x2="98" y2="44" stroke="var(--ink-200)" strokeWidth="0.75" />
          <line x1="22" y1="56" x2="98" y2="56" stroke="var(--ink-200)" strokeWidth="0.75" />
          <circle cx="60" cy="48" r="14" fill="var(--teal-50)" stroke="var(--teal-500)" strokeWidth="1.25" />
          <path
            d="M60 54 L60 42 M55 47 L60 42 L65 47"
            fill="none"
            stroke="var(--teal-600)"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h2 className="mb-1.5 mt-5 font-ar-display text-lg font-bold text-ink-900">
          لا توجد درجات مستوردة بعد
        </h2>
        <p className="m-0 max-w-[420px] text-sm text-ink-500">
          ابدأ بـ«استيراد ملف» لرفع كشف درجات الثانوية العامة أو الأزهرية. يدعم الاستيراد صيغ{' '}
          <span dir="ltr" className="font-numeric tabular-nums">
            .xlsx · .xls · .csv · .mdb · .accdb
          </span>
          .
        </p>
        <div className="mt-6 flex gap-2.5">
          <Button variant="primary" leadingIcon={<Upload size={14} strokeWidth={1.75} />} onClick={onImport}>
            استيراد ملف
          </Button>
          <Button
            variant="ghost"
            leadingIcon={<FileText size={14} strokeWidth={1.75} />}
            onClick={() => void downloadTemplateWorkbook()}
          >
            تنزيل نموذج Excel
          </Button>
        </div>
        <div className="mt-8 flex w-full max-w-[600px] items-start gap-2 rounded-md border border-gold-200 bg-gold-50 px-4 py-3 text-2xs text-gold-700">
          <Info size={14} strokeWidth={1.75} aria-hidden className="shrink-0" />
          <span>
            نزّل النموذج لضمان تطابق أعمدة الملف مع المتوقّع في خطوة ربط الأعمدة — يصلح الإرسال
            مباشرة دون تعديل يدوي.
          </span>
        </div>
      </CardBody>
    </Card>
  );
}

/** Page-size selector — preset options plus a "custom" entry that
 *  reveals a numeric input for any positive integer ≤ MAX_PAGE_SIZE. */
function PageSizeSelector({
  pageSize,
  onChange,
}: {
  pageSize: number;
  onChange: (size: number) => void;
}): JSX.Element {
  const isPreset = (PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSize);
  const [customMode, setCustomMode] = useState(!isPreset);
  const [draft, setDraft] = useState<string>(isPreset ? '' : String(pageSize));

  const commitCustom = (): void => {
    const n = Number(draft);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return;
    onChange(Math.min(MAX_PAGE_SIZE, n));
  };

  return (
    <label className="inline-flex items-center gap-2">
      <span>لكل صفحة:</span>
      <select
        value={customMode ? 'custom' : pageSize}
        onChange={(e) => {
          if (e.target.value === 'custom') {
            setCustomMode(true);
            setDraft(String(pageSize));
            return;
          }
          setCustomMode(false);
          onChange(Number(e.target.value));
        }}
        className="rounded-md border border-border-default bg-surface-card px-2 py-1 text-sm focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none"
        aria-label="عدد الصفوف لكل صفحة"
      >
        {PAGE_SIZE_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
        <option value="custom">مخصّص…</option>
      </select>
      {customMode && (
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_PAGE_SIZE}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitCustom}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitCustom();
            }
          }}
          placeholder="أدخل عدداً…"
          aria-label="عدد مخصّص للصفوف لكل صفحة"
          className="h-7 w-20 rounded-md border border-border-default bg-surface-card px-2 text-sm font-numeric tnum focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none"
          dir="ltr"
        />
      )}
    </label>
  );
}
