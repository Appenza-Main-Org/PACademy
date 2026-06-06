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

import { useEffect, useMemo, useRef, useState } from 'react';
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
  Loader2,
  Lock,
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
  ErrorState,
  LoadingState,
  PageHeader,
  Select,
  StatCard,
  toast,
} from '@/shared/components';
import type { DataTableColumn, DataTableSort } from '@/shared/components';
import { isFilterActive, type ColumnFilterValue } from '@/shared/components/data-table';
import { ROUTES } from '@/config/routes';
import { toEasternArabicNumerals } from '@/shared/lib/arabic';
import { serializeCsv } from '@/shared/lib/csv';
import { downloadBlob } from '@/shared/lib/download';
import { useLookup } from '@/features/lookups';
import {
  useApplicantGradesList,
  useClearGrades,
  useDeleteGrades,
} from '../api/grades.queries';
import {
  gradesService,
  type ApplicantGradesColumnFilters,
  type PaginatedGradesResult,
} from '../api/grades.service';
import { downloadTemplateWorkbook } from '../lib/buildTemplateWorkbook';
import { useImportWizardStore } from '../store/importWizard.store';
import { AddAdjustmentDialog } from '../components/AddAdjustmentDialog';
import { LogDrawer } from '../components/LogDrawer';
import { StudentDetailsDrawer } from '../components/StudentDetailsDrawer';
import { deriveRow, SUBMISSION_LOCK_TOOLTIP, type DerivedRow } from '../lib/derive';
import type { ApplicantGender } from '../types';

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

const DEBOUNCE_MS = 400;
const COLUMN_FILTER_DEBOUNCE_MS = 450;
const ACTIVE_FILTER_CONTROL_CLASS =
  '!border-teal-500 !bg-teal-50 !text-teal-800 shadow-[inset_0_0_0_1px_var(--teal-500)]';

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function useDeleteProgress(isActive: boolean): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setProgress(0);
      return undefined;
    }

    setProgress(8);
    const t = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 92) return current;
        const nextStep = Math.max(1, Math.round((92 - current) * 0.18));
        return Math.min(92, current + nextStep);
      });
    }, 450);

    return () => window.clearInterval(t);
  }, [isActive]);

  return progress;
}

function textColumnFilter(value: ColumnFilterValue | undefined): string | undefined {
  if (!value || value.kind !== 'text') return undefined;
  const text = value.contains.trim();
  return text === '' ? undefined : text;
}

function numberColumnFilter(
  value: ColumnFilterValue | undefined,
): { min: number | null; max: number | null } | null {
  if (!value || value.kind !== 'number') return null;
  if (value.min === null && value.max === null) return null;
  return { min: value.min, max: value.max };
}

function enumColumnFilter(value: ColumnFilterValue | undefined): readonly string[] | undefined {
  if (!value || value.kind !== 'enum' || value.values.length === 0) return undefined;
  return value.values;
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
  const examRoundsQuery = useLookup('exam-rounds');
  const examRoundLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of examRoundsQuery.data ?? []) {
      map.set(r.code, r.name);
      map.set(r.name, r.name);
    }
    return map;
  }, [examRoundsQuery.data]);

  /* Local search input that debounces into the URL state. The URL
   * value is the source of truth for the query; the input only
   * mirrors it so a refresh restores both. */
  const [searchInput, setSearchInput] = useState(qFromUrl);
  const debouncedSearch = useDebouncedValue(searchInput, DEBOUNCE_MS);

  useEffect(() => {
    if (debouncedSearch !== searchInput) return;
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
  }, [debouncedSearch, qFromUrl, searchInput, setSearchParams]);

  const [overlay, setOverlay] = useState<OverlayState>(null);
  const [sort, setSort] = useState<DataTableSort<DerivedRow> | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterValue>>({});
  const debouncedColumnFilters = useDebouncedValue(columnFilters, COLUMN_FILTER_DEBOUNCE_MS);
  const [exporting, setExporting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<(string | number)[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const clearMut = useClearGrades();
  const deleteMut = useDeleteGrades();
  const clearProgress = useDeleteProgress(clearMut.isPending);
  const selectedDeleteProgress = useDeleteProgress(deleteMut.isPending);

  useEffect(() => {
    setSelectedRowKeys([]);
    setConfirmBulkDelete(false);
  }, [
    qFromUrl,
    genderFromUrl,
    branchFromUrl,
    yearFromUrl,
    schoolCategoryFromUrl,
    changedOnly,
    debouncedColumnFilters,
  ]);

  const gradeColumnFilters = useMemo<ApplicantGradesColumnFilters>(() => {
    const totalRange = numberColumnFilter(debouncedColumnFilters.total);
    const pctRange = numberColumnFilter(debouncedColumnFilters.pct);
    const effRange = numberColumnFilter(debouncedColumnFilters.eff);
    const graduationYearRange = numberColumnFilter(debouncedColumnFilters.graduationYear);
    return {
      nid: textColumnFilter(debouncedColumnFilters.nid),
      seatingNumber: textColumnFilter(debouncedColumnFilters.seatingNumber),
      name: textColumnFilter(debouncedColumnFilters.name),
      totalMin: totalRange?.min,
      totalMax: totalRange?.max,
      pctMin: pctRange?.min,
      pctMax: pctRange?.max,
      effMin: effRange?.min,
      effMax: effRange?.max,
      schoolCategoryCodes: enumColumnFilter(debouncedColumnFilters.schoolCategoryCode),
      school: textColumnFilter(debouncedColumnFilters.school),
      graduationYearMin: graduationYearRange?.min,
      graduationYearMax: graduationYearRange?.max,
    };
  }, [debouncedColumnFilters]);

  const activeColumnFilterCount = useMemo(
    () => Object.values(columnFilters).filter(isFilterActive).length,
    [columnFilters],
  );

  const {
    data: paginatedData,
    error: gradesLoadError,
    isError: isGradesLoadError,
    isFetching,
    isLoading,
    refetch: refetchGrades,
  } = useApplicantGradesList({
    page,
    pageSize,
    search: qFromUrl,
    sort,
    gender: genderFromUrl,
    branch: branchFromUrl,
    graduationYear: yearFromUrl,
    schoolCategoryCode: schoolCategoryFromUrl,
    columnFilters: gradeColumnFilters,
    changedOnly,
  });
  const lastPaginatedDataRef = useRef<PaginatedGradesResult | null>(null);
  useEffect(() => {
    if (paginatedData) lastPaginatedDataRef.current = paginatedData;
  }, [paginatedData]);
  const displayedPaginatedData = paginatedData ?? (isFetching ? lastPaginatedDataRef.current : null);
  const rows = displayedPaginatedData?.rows ?? [];
  const total = displayedPaginatedData?.total ?? 0;
  const derived = useMemo<DerivedRow[]>(() => rows.map(deriveRow), [rows]);
  const summary = displayedPaginatedData?.summary;
  const totalsAll = summary?.total ?? total;
  const generalCount = summary?.general ?? 0;
  const azharCount = summary?.azhar ?? 0;
  const withAdjCount = summary?.withAdjustments ?? 0;
  const generalSchoolCategoryLabel = schoolCategoryLabel.get('SCH-01') ?? 'الثانوية العامة';
  const azharSchoolCategoryLabel = schoolCategoryLabel.get('SCH-03') ?? 'الثانوية الأزهرية';

  /* Branch + year filter options are derived from rows actually present
   * in the dataset. The year filter is back-padded with the last 10
   * years so newly-uploaded datasets always have a usable range even
   * before any row carries a real graduationYear. */
  const branchOptions = useMemo<string[]>(() => {
    const fromBackend = displayedPaginatedData?.facets?.branches;
    if (fromBackend && fromBackend.length > 0) return fromBackend;
    const set = new Set<string>();
    for (const r of rows) if (r.branch) set.add(r.branch);
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [displayedPaginatedData?.facets?.branches, rows]);

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
      for (const r of rows) {
        if (typeof r.graduationYear === 'number') set.add(r.graduationYear);
      }
      set.add(new Date().getFullYear());
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [rows, graduationYearsQuery.data]);

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
  const activeSearchCount = qFromUrl.trim() !== '' ? 1 : 0;
  const activeTotalFilterCount = activeFilterCount + activeSearchCount + activeColumnFilterCount;
  const hasActiveFilters = activeTotalFilterCount > 0;
  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; value: string; tone: 'info' | 'warning' }[] = [];
    if (qFromUrl.trim() !== '') {
      chips.push({ key: 'q', label: 'بحث', value: qFromUrl.trim(), tone: 'info' });
    }
    if (genderFromUrl !== 'all') {
      chips.push({
        key: 'gender',
        label: 'النوع',
        value: genderFromUrl === 'female' ? 'أنثى' : 'ذكر',
        tone: 'info',
      });
    }
    if (branchFromUrl !== 'all') {
      chips.push({ key: 'branch', label: 'الشعبة', value: branchFromUrl, tone: 'info' });
    }
    if (yearFromUrl !== 'all') {
      chips.push({ key: 'year', label: 'سنة التخرج', value: String(yearFromUrl), tone: 'info' });
    }
    if (schoolCategoryFromUrl !== 'all') {
      chips.push({
        key: 'school',
        label: 'فئة المدرسة',
        value: schoolCategoryLabel.get(schoolCategoryFromUrl) ?? schoolCategoryFromUrl,
        tone: 'info',
      });
    }
    if (changedOnly) {
      chips.push({ key: 'changed', label: 'النطاق', value: 'درجات معدّلة فقط', tone: 'warning' });
    }
    if (activeColumnFilterCount > 0) {
      chips.push({
        key: 'columns',
        label: 'أعمدة',
        value: `${activeColumnFilterCount.toLocaleString('en')} تصفية`,
        tone: 'info',
      });
    }
    return chips;
  }, [
    activeColumnFilterCount,
    branchFromUrl,
    changedOnly,
    genderFromUrl,
    qFromUrl,
    schoolCategoryFromUrl,
    schoolCategoryLabel,
    yearFromUrl,
  ]);

  function clearAllFilters(): void {
    setSearchInput('');
    setColumnFilters({});
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('q');
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

  function handleColumnFiltersChange(nextFilters: Record<string, ColumnFilterValue>): void {
    setColumnFilters(nextFilters);
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
              columnFilters: gradeColumnFilters,
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
        r.examRound ? examRoundLabel.get(r.examRound) ?? r.examRound : '',
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
      const result = await clearMut.mutateAsync();
      await refetchGrades();
      setConfirmReset(false);
      setSearchInput('');
      setColumnFilters({});
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('q');
          next.set('page', '1');
          return next;
        },
        { replace: true },
      );
      if (result.deleted > 0) {
        toast(`تم تصفير ${result.deleted.toLocaleString('en')} صفًا من البيانات.`, 'success');
      } else {
        toast('لا توجد صفوف غير محذوفة لتصفيرها.', 'warning');
      }
    } catch {
      toast('تعذّر تصفير البيانات. حاول مرة أخرى.', 'danger');
    }
  }

  async function handleBulkDelete(): Promise<void> {
    if (total === 0) {
      setConfirmBulkDelete(false);
      setSelectedRowKeys([]);
      toast('لا توجد صفوف مطابقة للتصفية الحالية للحذف.', 'warning');
      return;
    }
    const seats = selectedRowKeys
      .map((key) => (typeof key === 'number' ? key : Number(key)))
      .filter((seat) => Number.isFinite(seat) && !lockedSeatSet.has(seat));
    if (seats.length === 0) {
      setConfirmBulkDelete(false);
      toast(
        'كل الصفوف المحددة مرتبطة بطلبات تقديم مُرسَلة ولا يمكن حذفها.',
        'warning',
      );
      return;
    }
    try {
      const result = await deleteMut.mutateAsync(seats);
      setConfirmBulkDelete(false);
      setSelectedRowKeys([]);
      if (lockedSelectedCount > 0) {
        toast(
          `تم حذف ${result.deleted.toLocaleString('en')} صفًا. تم تجاوز ${lockedSelectedCount.toLocaleString('en')} صفًا مرتبطًا بطلبات تقديم مُرسَلة.`,
          'success',
        );
      } else {
        toast(
          `تم حذف ${result.deleted.toLocaleString('en')} صفًا من بيانات الدرجات.`,
          'success',
        );
      }
    } catch {
      toast('تعذّر حذف الصفوف المحددة. حاول مرة أخرى.', 'danger');
    }
  }

  function openBulkDeleteDialog(): void {
    if (selectedRowKeys.length === 0) return;
    if (total === 0) {
      setSelectedRowKeys([]);
      toast('لا توجد صفوف مطابقة للتصفية الحالية للحذف.', 'warning');
      return;
    }
    setConfirmBulkDelete(true);
  }

  const activeRow =
    overlay && 'seat' in overlay
      ? rows.find((r) => r.seat === overlay.seat)
      : null;
  const activeDerived = activeRow ? deriveRow(activeRow) : null;

  const lockedSeatSet = useMemo(() => {
    const set = new Set<number>();
    for (const r of rows) {
      if (r.hasSubmittedApplication) set.add(r.seat);
    }
    return set;
  }, [rows]);
  const lockedSelectedCount = useMemo(
    () =>
      selectedRowKeys.reduce<number>((acc, key) => {
        const seat = typeof key === 'number' ? key : Number(key);
        return acc + (Number.isFinite(seat) && lockedSeatSet.has(seat) ? 1 : 0);
      }, 0),
    [lockedSeatSet, selectedRowKeys],
  );
  const deletableSelectedCount = selectedRowKeys.length - lockedSelectedCount;

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
      key: 'schoolCategoryCode',
      label: 'فئة المدرسة',
      align: 'center',
      sortable: true,
      getSortValue: (r) => r.schoolCategoryCode ?? '',
      filter: {
        kind: 'enum',
        getValue: (r) => r.schoolCategoryCode ?? '',
        options: activeSchoolCategories.map((c) => ({ value: c.code, label: c.name })),
      },
      className: 'min-w-[13ch] max-w-[18ch]',
      render: (r) =>
        r.schoolCategoryCode ? (
          <Badge tone={r.schoolCategoryCode === 'SCH-03' ? 'warning' : 'info'}>
            <span className="max-w-[16ch] truncate">
              {schoolCategoryLabel.get(r.schoolCategoryCode) ?? r.schoolCategoryCode}
            </span>
          </Badge>
        ) : (
          <span className="text-2xs text-ink-300">—</span>
        ),
    },
    {
      key: 'school',
      label: 'اسم المدرسة',
      sortable: true,
      getSortValue: (r) => r.school,
      filter: { kind: 'text', getValue: (r) => r.school },
      className: 'min-w-[16ch] max-w-[24ch]',
      render: (r) =>
        r.school.trim() !== '' ? (
          <span className="block max-w-[22ch] truncate text-xs text-ink-700" title={r.school}>
            {r.school}
          </span>
        ) : (
          <span className="text-2xs text-ink-300">—</span>
        ),
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
      key: 'actions',
      label: 'إجراءات',
      align: 'center',
      className: 'min-w-[8ch] whitespace-nowrap',
      render: (r) => <RowActions row={r} onSelect={setOverlay} />,
    },
  ];

  const isEmpty = totalsAll === 0;
  const showFirstImportEmpty = isEmpty && !hasActiveFilters;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    const hasDebouncedColumnFilters = Object.values(debouncedColumnFilters).some(isFilterActive);
    if (hasDebouncedColumnFilters && page !== 1) setPage(1);
  }, [debouncedColumnFilters, page]);

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

  if (isGradesLoadError && !paginatedData) {
    return (
      <div>
        <PageHeader
          title="درجات الثانوية العامة والأزهرية"
          subtitle="استيراد درجات الطلاب من ملفات Excel وإدارة التعديلات"
        />
        <Card>
          <CardBody>
            <ErrorState
              error={gradesLoadError}
              title="تعذر تحميل درجات الطلاب"
              description="حدث خطأ أثناء تحميل بيانات الدرجات. لم يتم حذف البيانات، ويمكن إعادة المحاولة بعد لحظات."
              onRetry={() => void refetchGrades()}
            />
          </CardBody>
        </Card>
      </div>
    );
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div>
      <PageHeader
        title="درجات الثانوية العامة والأزهرية"
        subtitle="استيراد درجات الطلاب من ملفات Excel وإدارة التعديلات"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="primary"
              leadingIcon={<Upload size={14} strokeWidth={1.75} />}
              onClick={startNewImport}
            >
              استيراد ملف
            </Button>
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-card/80 p-1">
              {!isEmpty && (
                <DropdownMenu>
                  <DropdownMenu.Trigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
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
                      كل البيانات (CSV)
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      leadingIcon={<SheetIcon size={14} strokeWidth={1.75} aria-hidden />}
                      onSelect={() => void handleExport('all', 'xlsx')}
                    >
                      كل البيانات (XLSX)
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      leadingIcon={<FileText size={14} strokeWidth={1.75} aria-hidden />}
                      onSelect={() => void handleExport('page', 'csv')}
                    >
                      الصفحة الحالية (CSV)
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu>
              )}
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<FileText size={14} strokeWidth={1.75} />}
                onClick={() => void downloadTemplateWorkbook()}
              >
                النموذج
              </Button>
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<ListChecks size={14} strokeWidth={1.75} />}
                onClick={() => navigate(ROUTES.admin.applicantGradesChanges)}
              >
                التعديلات
              </Button>
              {!isEmpty && (
                <Button
                  variant="ghost"
                  size="sm"
                  leadingIcon={<Trash2 size={14} strokeWidth={1.75} />}
                  onClick={() => setConfirmReset(true)}
                  className="!text-terra-700 hover:!bg-terra-50 focus-visible:!shadow-focus-terra"
                >
                  تصفير
                </Button>
              )}
            </div>
          </div>
        }
      />

      {showFirstImportEmpty ? (
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
              label={generalSchoolCategoryLabel}
              value={generalCount}
              icon={<FileSpreadsheet size={16} strokeWidth={1.75} />}
              iconBg="var(--teal-50)"
              iconColor="var(--teal-700)"
            />
            <StatCard
              label={azharSchoolCategoryLabel}
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
            <CardBody className="space-y-4 p-4 md:p-5">
              <div className="grid gap-3 xl:grid-cols-[minmax(280px,1fr)_repeat(3,minmax(130px,170px))]">
                <label className="search m-0 min-w-0">
                  <span className="sr-only">بحث بالاسم أو الرقم القومي أو رقم الجلوس</span>
                  <input
                    className="input"
                    type="search"
                    placeholder="بحث بالاسم / الرقم القومي / رقم الجلوس"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    aria-label="بحث بالاسم أو الرقم القومي أو رقم الجلوس"
                  />
                  <Search size={18} />
                </label>
                <Select
                  aria-label="تصفية حسب النوع"
                  value={genderFromUrl}
                  onChange={(e) => setFilter('gender', e.target.value)}
                  className={genderFromUrl !== 'all' ? ACTIVE_FILTER_CONTROL_CLASS : undefined}
                  options={[
                    { value: 'all', label: 'كل الأنواع' },
                    { value: 'male', label: 'ذكر' },
                    { value: 'female', label: 'أنثى' },
                  ]}
                  containerClassName="min-w-0"
                />
                <Select
                  aria-label="تصفية حسب الشعبة"
                  value={branchFromUrl}
                  onChange={(e) => setFilter('branch', e.target.value)}
                  className={branchFromUrl !== 'all' ? ACTIVE_FILTER_CONTROL_CLASS : undefined}
                  options={[
                    { value: 'all', label: 'كل الشعب' },
                    ...branchOptions.map((b) => ({ value: b, label: b })),
                  ]}
                  containerClassName="min-w-0"
                />
                <Select
                  aria-label="تصفية حسب سنة التخرج"
                  value={yearFromUrl === 'all' ? 'all' : String(yearFromUrl)}
                  onChange={(e) => setFilter('year', e.target.value)}
                  className={yearFromUrl !== 'all' ? ACTIVE_FILTER_CONTROL_CLASS : undefined}
                  options={[
                    { value: 'all', label: 'كل السنوات' },
                    ...yearOptions.map((y) => ({ value: String(y), label: String(y) })),
                  ]}
                  containerClassName="min-w-0"
                />
              </div>

              <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_auto] xl:items-center">
                <Select
                  aria-label="تصفية حسب فئة المدرسة"
                  value={schoolCategoryFromUrl}
                  onChange={(e) => setFilter('school', e.target.value)}
                  className={
                    schoolCategoryFromUrl !== 'all' ? ACTIVE_FILTER_CONTROL_CLASS : undefined
                  }
                  options={[
                    { value: 'all', label: 'كل فئات المدرسة' },
                    ...activeSchoolCategories.map((c) => ({ value: c.code, label: c.name })),
                  ]}
                  containerClassName="min-w-0"
                />
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={changedOnly}
                    onClick={() => setChangedOnly(!changedOnly)}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border-default bg-surface-card px-3 text-xs font-medium text-ink-700 transition-colors hover:border-gold-500 hover:bg-gold-50 focus-visible:outline-none focus-visible:shadow-focus-teal data-[active=true]:border-gold-500 data-[active=true]:bg-gold-500 data-[active=true]:text-white"
                    data-active={changedOnly}
                    title="تصفية الطلاب الذين تم تعديل درجاتهم"
                  >
                    <ListChecks size={13} strokeWidth={1.75} aria-hidden />
                    درجات معدّلة فقط
                  </button>
                  {changedOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      leadingIcon={<ListChecks size={13} strokeWidth={1.75} aria-hidden />}
                      onClick={() => navigate(ROUTES.admin.applicantGradesChanges)}
                    >
                      صفحة التعديلات
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-ink-50 px-3 py-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-700">
                    <Info size={13} strokeWidth={1.75} aria-hidden />
                    <span>عرض</span>
                    <span className="font-numeric tabular-nums text-ink-900">
                      {total.toLocaleString('en')}
                    </span>
                    <span>من</span>
                    <span className="font-numeric tabular-nums text-ink-900">
                      {totalsAll.toLocaleString('en')}
                    </span>
                    <span>صف</span>
                  </span>
                  {activeFilterChips.map((chip) => (
                    <Badge key={chip.key} tone={chip.tone}>
                      <span className="text-ink-500">{chip.label}</span>
                      <span className="ms-1 me-1 text-ink-300">/</span>
                      <span className="max-w-[22ch] truncate">{chip.value}</span>
                    </Badge>
                  ))}
                  {hasActiveFilters && activeFilterChips.length === 0 && (
                    <Badge tone="info">
                      <span className="font-numeric tabular-nums">
                        {activeTotalFilterCount.toLocaleString('en')}
                      </span>{' '}
                      تصفية مفعلة
                    </Badge>
                  )}
                  {isFetching && displayedPaginatedData && (
                    <Badge tone="warning">
                      <Loader2 size={11} strokeWidth={1.75} className="me-1 animate-spin" aria-hidden />
                      تحديث النتائج
                    </Badge>
                  )}
                </div>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    leadingIcon={<X size={12} strokeWidth={1.75} aria-hidden />}
                    onClick={clearAllFilters}
                    className="shrink-0"
                  >
                    مسح التصفية
                  </Button>
                )}
              </div>

              {selectedRowKeys.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-default bg-ink-50 px-3.5 py-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-ink-700">
                    <Badge tone="info">
                      <span className="font-numeric tabular-nums">
                        {selectedRowKeys.length.toLocaleString('en')}
                      </span>{' '}
                      محدد
                    </Badge>
                    {lockedSelectedCount > 0 && (
                      <Badge tone="danger">
                        <Lock size={10} strokeWidth={2} className="me-1" aria-hidden />
                        <span className="font-numeric tabular-nums">
                          {lockedSelectedCount.toLocaleString('en')}
                        </span>{' '}
                        مُقفل لطلب تقديم
                      </Badge>
                    )}
                    <span className="text-2xs text-ink-500">
                      {lockedSelectedCount > 0
                        ? 'سيتم تجاوز الصفوف المُقفلة المرتبطة بطلبات تقديم مُرسَلة.'
                        : 'تنطبق الإجراءات على الصفوف المحددة عبر صفحات الجدول.'}
                    </span>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    leadingIcon={<Trash2 size={13} strokeWidth={1.75} aria-hidden />}
                    onClick={openBulkDeleteDialog}
                    disabled={deletableSelectedCount === 0}
                  >
                    حذف المحدد
                  </Button>
                </div>
              )}

              <DataTable<DerivedRow>
                data={derived}
                columns={columns}
                rowKey={(r) => r.seat}
                selectionMode="multi"
                selectedRowKeys={selectedRowKeys}
                onSelectionChange={setSelectedRowKeys}
                sort={sort}
                onSortChange={setSort}
                columnFilters={columnFilters}
                onColumnFiltersChange={handleColumnFiltersChange}
                sequenceStart={from}
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
                      hasActiveFilters ? (
                        <Button variant="ghost" onClick={clearAllFilters}>
                          مسح التصفية
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
                    variant="secondary"
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    aria-label="الصفحة السابقة"
                  >
                    السابق
                  </Button>
                  <span className="px-2 font-en">
                    {page} / {totalPages}
                  </span>
                  <PageJump currentPage={page} totalPages={totalPages} onChange={setPage} />
                  <Button
                    size="sm"
                    variant="secondary"
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
        actionLoadingLabel="جارٍ تصفير البيانات…"
        cancelLabel="إلغاء"
        tone="danger"
        isActionLoading={clearMut.isPending}
        onAction={() => void handleReset()}
      >
        {clearMut.isPending && (
          <DeleteProgressPanel
            progress={clearProgress}
            totalRows={totalsAll}
            title="جارٍ حذف بيانات الدرجات"
            description="يبقى هذا التأكيد مفتوحًا حتى ينتهي الخادم من حذف الصفوف والتعديلات المرتبطة بها."
          />
        )}
      </AlertDialog>

      <AlertDialog
        open={confirmBulkDelete}
        onOpenChange={(next) => {
          if (!deleteMut.isPending) setConfirmBulkDelete(next);
        }}
        title="حذف الصفوف المحددة"
        description={
          lockedSelectedCount > 0
            ? `سيتم حذف ${toEasternArabicNumerals(deletableSelectedCount)} صفًا. سيُتجاوز ${toEasternArabicNumerals(lockedSelectedCount)} صفًا مرتبطًا بطلبات تقديم مُرسَلة. لا يمكن التراجع.`
            : `سيتم حذف ${toEasternArabicNumerals(selectedRowKeys.length)} صفًا من النتائج الحالية. لا يمكن التراجع.`
        }
        actionLabel="حذف المحدد"
        actionLoadingLabel="جارٍ حذف المحدد…"
        cancelLabel="إلغاء"
        tone="danger"
        isActionLoading={deleteMut.isPending}
        isActionDisabled={deletableSelectedCount === 0 || total === 0}
        onAction={() => void handleBulkDelete()}
      >
        {deleteMut.isPending && (
          <DeleteProgressPanel
            progress={selectedDeleteProgress}
            totalRows={selectedRowKeys.length}
            title="جارٍ حذف الصفوف المحددة"
            description="سيتم تحديث الجدول تلقائيًا بعد اكتمال الحذف."
          />
        )}
      </AlertDialog>

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

function DeleteProgressPanel({
  progress,
  totalRows,
  title,
  description,
}: {
  progress: number;
  totalRows: number;
  title: string;
  description: string;
}): JSX.Element {
  const boundedProgress = Math.min(99, Math.max(0, progress));

  return (
    <div
      className="rounded-lg border border-terra-100 bg-terra-50/70 p-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-card text-terra-700">
          <Trash2 size={14} strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink-900">{title}</p>
            <span className="font-en text-xs tabular-nums text-terra-700" dir="ltr">
              {boundedProgress}%
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-ink-600">{description}</p>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-surface-card"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={boundedProgress}
          >
            <div
              className="h-full rounded-full bg-terra-500 transition-[width] duration-slow ease-standard"
              style={{ width: `${boundedProgress}%` }}
            />
          </div>
          <p className="mt-2 text-2xs text-ink-500">
            نطاق العملية:{' '}
            <span className="font-numeric font-medium tabular-nums text-ink-800">
              {toEasternArabicNumerals(totalRows)}
            </span>{' '}
            صف.
          </p>
        </div>
      </div>
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
  const locked = row.isLockedBySubmission;
  const triggerTitle = locked
    ? SUBMISSION_LOCK_TOOLTIP
    : hasAdjustments
      ? 'يوجد تعديلات'
      : undefined;
  return (
    <span
      className="relative inline-flex"
      onClick={(e) => e.stopPropagation()}
      title={triggerTitle}
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
            leadingIcon={
              locked ? (
                <Lock size={14} strokeWidth={1.75} className="text-ink-400" aria-hidden />
              ) : (
                <Plus size={14} strokeWidth={1.75} className="text-teal-700" aria-hidden />
              )
            }
            disabled={locked}
            onSelect={() => {
              if (locked) return;
              onSelect({ kind: 'add-adj', seat: row.seat });
            }}
          >
            <span className="flex flex-col">
              <span>إضافة تعديل</span>
              {locked && (
                <span className="text-2xs text-ink-500">{SUBMISSION_LOCK_TOOLTIP}</span>
              )}
            </span>
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
      {locked ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -end-0.5 -top-0.5 grid h-3 w-3 place-items-center rounded-full bg-terra-500 ring-2 ring-white"
          title={SUBMISSION_LOCK_TOOLTIP}
        >
          <Lock size={7} strokeWidth={2.5} className="text-white" aria-hidden />
        </span>
      ) : hasAdjustments ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -end-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-gold-500 ring-2 ring-white"
        />
      ) : null}
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
    <div className="inline-flex items-center gap-2">
      <span>لكل صفحة:</span>
      <Select
        aria-label="عدد الصفوف لكل صفحة"
        value={customMode ? 'custom' : String(pageSize)}
        onChange={(e) => {
          if (e.target.value === 'custom') {
            setCustomMode(true);
            setDraft(String(pageSize));
            return;
          }
          setCustomMode(false);
          onChange(Number(e.target.value));
        }}
        options={[
          ...PAGE_SIZE_OPTIONS.map((s) => ({ value: String(s), label: String(s) })),
          { value: 'custom', label: 'مخصّص…' },
        ]}
        containerClassName="w-24"
      />
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
    </div>
  );
}

/** Direct page navigation for large imported-grade datasets. Keeps the
 *  previous/next buttons fast while letting staff jump to a known page. */
function PageJump({
  currentPage,
  totalPages,
  onChange,
}: {
  currentPage: number;
  totalPages: number;
  onChange: (page: number) => void;
}): JSX.Element {
  const [draft, setDraft] = useState(String(currentPage));

  useEffect(() => {
    setDraft(String(currentPage));
  }, [currentPage]);

  const commit = (): void => {
    const next = Number(draft);
    if (!Number.isFinite(next) || !Number.isInteger(next)) {
      setDraft(String(currentPage));
      return;
    }
    const clamped = Math.min(totalPages, Math.max(1, next));
    setDraft(String(clamped));
    if (clamped !== currentPage) onChange(clamped);
  };

  return (
    <div className="mx-1 inline-flex items-center gap-1 rounded-md border border-border-default bg-ink-50 px-1.5 py-1">
      <label htmlFor="applicant-grades-page-jump" className="text-2xs text-ink-500">
        صفحة
      </label>
      <input
        id="applicant-grades-page-jump"
        type="number"
        inputMode="numeric"
        min={1}
        max={totalPages}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
        }}
        aria-label="الانتقال إلى رقم صفحة"
        className="h-7 w-16 rounded-sm border border-border-default bg-surface-card px-2 text-center text-sm font-en tabular-nums text-ink-900 focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none"
        dir="ltr"
      />
      <button
        type="button"
        onClick={commit}
        disabled={totalPages <= 1}
        className="h-7 rounded-sm px-2 text-2xs font-medium text-teal-700 transition-colors hover:bg-teal-50 disabled:cursor-not-allowed disabled:text-ink-300 focus-visible:outline-none focus-visible:shadow-focus-teal"
      >
        انتقال
      </button>
    </div>
  );
}
