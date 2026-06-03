/**
 * DataTable — typed, paginated, sortable, filterable table.
 * Source: Tasks/DESIGN_SYSTEM.md §4.4.
 *
 * The single most important component in the system. Used in 20+ screens.
 * Generic over row type (`<TRow>`); columns are typed and declarative.
 *
 * Features:
 *  - Typed columns (label, accessor or render fn, alignment, sortable, width).
 *  - First-column displayed sequence number, offset by pagination.
 *  - Pagination strip at bottom (page X of Y, total, page-size selector).
 *  - Single-column sort (server- or client-handled via `onSortChange`).
 *  - Multi-row selection (checkboxes) via `selectionMode`.
 *  - Density: compact / default / comfortable.
 *  - Sticky header.
 *  - Zebra stripes (optional).
 *  - Custom empty/loading/error states.
 *
 * Visual contract per §4.4:
 *  - Header bg --surface-sunken, 11px tracking-wide uppercase ink-500.
 *  - Rows alternating with --ink-50 if zebra; hover bg --teal-50 if interactive.
 *  - Selected row: 3px start-edge in accent + bg accent-50.
 *  - Numeric cells use font-numeric tnum, end-aligned.
 *  - Cell padding 12/16, 8/12 compact, 16/20 comfortable.
 *
 * Usage:
 *   const columns: DataTableColumn<Applicant>[] = [
 *     { key: 'name', label: 'الاسم', render: (a) => a.name },
 *     { key: 'score', label: 'النسبة', align: 'end', numeric: true,
 *       render: (a) => `${a.certPercent}%` },
 *   ];
 *   <DataTable
 *     columns={columns}
 *     data={data?.items ?? []}
 *     loading={isLoading}
 *     empty={<EmptyState variant="no-applicants-yet" />}
 *     pagination={{ page, pageSize, total, onPageChange, onPageSizeChange }}
 *     onRowClick={(row) => navigate(`./${row.id}`)}
 *   />
 */

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { LoadingState } from './LoadingState';
import { Select } from './Select';
import { ListActions } from './data-table/ListActions';
import type { ImportResult, ListActionsConfig } from './data-table/list-actions.types';
import {
  ColumnFilterTrigger,
  isFilterActive,
  rowPassesFilter,
} from './data-table/ColumnFilter';
import type {
  ColumnFilterConfig,
  ColumnFilterValue,
} from './data-table/ColumnFilter';

export type DataTableDensity = 'compact' | 'default' | 'comfortable';
export type DataTableSelectionMode = 'none' | 'single' | 'multi';

export interface DataTableSort<TRow> {
  key: keyof TRow & string;
  direction: 'asc' | 'desc';
}

export interface DataTableColumn<TRow> {
  key: string;
  label: ReactNode;
  /** Cell renderer. Receives the row and the row index. */
  render?: (row: TRow, index: number) => ReactNode;
  /** Accessor key when no render is provided. */
  accessor?: keyof TRow & string;
  align?: 'start' | 'center' | 'end';
  /** Numeric column → font-numeric tnum + end-align by default. */
  numeric?: boolean;
  sortable?: boolean;
  width?: string | number;
  className?: string;
  /** Hide on small screens. */
  hideOn?: 'sm' | 'md';
  /** Per-column filter — opt in by providing a kind + accessor.
   *  When set, the header surfaces a funnel trigger and DataTable applies
   *  the filter client-side. Pair with a string Arabic header label for
   *  the popover heading + aria-label. */
  filter?: ColumnFilterConfig<TRow>;
  /** Value used for client-side sorting when no `onSortChange` is provided.
   *  Defaults to `accessor` when set; otherwise sort is a no-op on that
   *  column even if `sortable: true`. */
  getSortValue?: (row: TRow) => string | number | Date | null | undefined;
}

export interface DataTablePagination {
  page: number;
  pageSize: number;
  total: number;
  pageSizeOptions?: readonly number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

interface DataTableProps<TRow> {
  data: readonly TRow[];
  columns: readonly DataTableColumn<TRow>[];
  rowKey?: (row: TRow, index: number) => string | number;
  loading?: boolean;
  error?: ReactNode;
  empty?: ReactNode;

  selectionMode?: DataTableSelectionMode;
  selectedRowKeys?: readonly (string | number)[];
  onSelectionChange?: (keys: (string | number)[]) => void;

  sort?: DataTableSort<TRow> | null;
  onSortChange?: (next: DataTableSort<TRow> | null) => void;
  /** Controlled per-column filter values keyed by column `key`. Omit for
   *  uncontrolled internal state. When omitted, DataTable applies the
   *  filters to `data` client-side. */
  columnFilters?: Readonly<Record<string, ColumnFilterValue>>;
  onColumnFiltersChange?: (next: Record<string, ColumnFilterValue>) => void;

  onRowClick?: (row: TRow, index: number) => void;
  density?: DataTableDensity;
  zebraStripes?: boolean;
  stickyHeader?: boolean;

  pagination?: DataTablePagination;

  caption?: string;
  className?: string;
  /** Optional ribbon rendered above the table (filters, bulk actions). */
  toolbar?: ReactNode;
  /**
   * Universal list-actions config — Export / Import / Duplicate.
   * Renders as a logical-start button group above the table. Permission
   * gating is automatic via `getListActionPermissions()` (registered by
   * the auth feature at app bootstrap).
   *
   * Pass `onImported` to refresh the host page's query after an import.
   * Per-row Duplicate uses the `DuplicateAction` primitive directly inside
   * the row's actions cell — it is *not* rendered by `DataTable`.
   */
  listActions?: ListActionsConfig<TRow>;
  onImported?: (result: ImportResult) => void;
}

export function DataTable<TRow>({
  data,
  columns,
  rowKey,
  loading,
  error,
  empty,
  selectionMode = 'none',
  selectedRowKeys = [],
  onSelectionChange,
  sort,
  onSortChange,
  columnFilters,
  onColumnFiltersChange,
  onRowClick,
  density = 'default',
  zebraStripes,
  stickyHeader,
  pagination,
  caption,
  className,
  toolbar,
  listActions,
  onImported,
}: DataTableProps<TRow>): JSX.Element {
  const [internalSort, setInternalSort] = useState<DataTableSort<TRow> | null>(sort ?? null);
  const activeSort = sort ?? internalSort;

  const [internalFilters, setInternalFilters] = useState<Record<string, ColumnFilterValue>>({});
  const activeFilters = columnFilters ?? internalFilters;

  /* Apply column filters client-side, then client sort when uncontrolled.
   * Controlled callers (`onSortChange` / `onColumnFiltersChange`) are
   * trusted to pre-process `data` themselves — typical for server-side
   * pagination. */
  const processed = useMemo(() => {
    const filterEntries = Object.entries(activeFilters);
    let rows = data;
    if (!columnFilters && filterEntries.length > 0) {
      rows = rows.filter((row) =>
        filterEntries.every(([colKey, value]) => {
          const col = columns.find((c) => c.key === colKey);
          if (!col?.filter) return true;
          return rowPassesFilter(row, col.filter, value);
        }),
      );
    }
    if (!onSortChange && activeSort) {
      const col = columns.find(
        (c) => (c.accessor ?? c.key) === activeSort.key || c.key === activeSort.key,
      );
      const getValue = col?.getSortValue
        ? col.getSortValue
        : col?.accessor
          ? (row: TRow): unknown => (row as Record<string, unknown>)[col.accessor as string]
          : null;
      if (getValue) {
        const direction = activeSort.direction === 'asc' ? 1 : -1;
        rows = [...rows].sort((a, b) => {
          const av = getValue(a);
          const bv = getValue(b);
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          if (typeof av === 'number' && typeof bv === 'number') {
            return (av - bv) * direction;
          }
          if (av instanceof Date && bv instanceof Date) {
            return (av.getTime() - bv.getTime()) * direction;
          }
          return String(av).localeCompare(String(bv), 'ar') * direction;
        });
      }
    }
    return rows;
  }, [data, columns, columnFilters, activeFilters, onSortChange, activeSort]);

  const cellPad =
    density === 'compact' ? 'px-3 py-2' : density === 'comfortable' ? 'px-5 py-4' : 'px-4 py-3';
  const headerPad =
    density === 'compact' ? 'px-3 py-2' : density === 'comfortable' ? 'px-5 py-4' : 'px-4 py-3';
  const visibleColumnCount =
    columns.length + 1 + (selectionMode !== 'none' ? 1 : 0) + (listActions?.rowActions ? 1 : 0);
  const sequenceBase = pagination
    ? Math.max(0, (pagination.page - 1) * pagination.pageSize)
    : 0;

  const selectedSet = useMemo(() => new Set(selectedRowKeys), [selectedRowKeys]);

  const allKeys = useMemo(
    () => processed.map((row, i) => rowKey?.(row, i) ?? i),
    [processed, rowKey],
  );
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selectedSet.has(k));
  const someSelected = allKeys.some((k) => selectedSet.has(k)) && !allSelected;

  const toggleRow = (key: string | number): void => {
    const next = new Set(selectedRowKeys);
    if (selectionMode === 'single') {
      next.clear();
      if (!selectedSet.has(key)) next.add(key);
    } else {
      if (next.has(key)) next.delete(key);
      else next.add(key);
    }
    onSelectionChange?.(Array.from(next));
  };

  const toggleAll = (): void => {
    const visibleKeys = new Set(allKeys);
    if (allSelected) {
      onSelectionChange?.(selectedRowKeys.filter((key) => !visibleKeys.has(key)));
      return;
    }
    onSelectionChange?.(Array.from(new Set([...selectedRowKeys, ...allKeys])));
  };

  const sortBy = (col: DataTableColumn<TRow>): void => {
    if (!col.sortable) return;
    const key = col.accessor ?? (col.key as keyof TRow & string);
    let next: DataTableSort<TRow> | null = null;
    if (!activeSort || activeSort.key !== key) {
      next = { key: key as keyof TRow & string, direction: 'asc' };
    } else if (activeSort.direction === 'asc') {
      next = { key: activeSort.key, direction: 'desc' };
    } else {
      next = null;
    }
    if (onSortChange) onSortChange(next);
    else setInternalSort(next);
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {listActions && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ListActions rows={processed} config={listActions} onImported={onImported} />
        </div>
      )}
      {toolbar}

      <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-card">
        <div className="overflow-auto">
          <table className="w-full border-collapse">
            {caption && <caption className="sr-only">{caption}</caption>}
            <thead
              className={cn(
                'bg-surface-sunken text-2xs font-medium uppercase tracking-wide text-ink-500',
                stickyHeader && 'sticky top-0 z-raised',
              )}
            >
              <tr>
                <th
                  className={cn(headerPad, 'w-14 text-center font-numeric tnum')}
                  scope="col"
                  aria-label="مسلسل"
                >
                  م
                </th>
                {selectionMode !== 'none' && (
                  <th className={cn(headerPad, 'w-10 text-center')} scope="col">
                    {selectionMode === 'multi' && (
                      <input
                        type="checkbox"
                        aria-label="تحديد الكل"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelected;
                        }}
                        onChange={toggleAll}
                        className="h-4 w-4 cursor-pointer accent-teal-500"
                      />
                    )}
                  </th>
                )}
                {columns.map((col) => {
                  const sorted =
                    activeSort && activeSort.key === (col.accessor ?? col.key);
                  const dir = sorted ? activeSort?.direction : null;
                  const columnLabel = typeof col.label === 'string' ? col.label : col.key;
                  const filterValue = activeFilters[col.key];
                  const filterActive = isFilterActive(filterValue);
                  const setFilter = (next: ColumnFilterValue | undefined): void => {
                    const merged = { ...activeFilters };
                    if (next === undefined) delete merged[col.key];
                    else merged[col.key] = next;
                    if (onColumnFiltersChange) onColumnFiltersChange(merged);
                    else setInternalFilters(merged);
                  };
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      style={{ width: col.width }}
                      className={cn(
                        headerPad,
                        col.align === 'end' && 'text-end',
                        col.align === 'center' && 'text-center',
                        col.numeric && !col.align && 'text-end',
                        !col.align && !col.numeric && 'text-start',
                        col.hideOn === 'sm' && 'hidden md:table-cell',
                        col.hideOn === 'md' && 'hidden lg:table-cell',
                        filterActive &&
                          'bg-teal-50 text-teal-800 shadow-[inset_0_-2px_0_var(--teal-500)]',
                        col.className,
                      )}
                    >
                      <div
                        className={cn(
                          'inline-flex items-center gap-1.5',
                          (col.align === 'end' || (col.numeric && !col.align)) && 'flex-row-reverse',
                        )}
                      >
                        {col.sortable ? (
                          <button
                            type="button"
                            onClick={() => sortBy(col)}
                            className="inline-flex items-center gap-1 font-medium uppercase tracking-wide hover:text-ink-700 focus-visible:shadow-focus-teal focus-visible:outline-none"
                          >
                            <span>{col.label}</span>
                            {dir === 'asc' && <ChevronUp size={12} aria-hidden />}
                            {dir === 'desc' && <ChevronDown size={12} aria-hidden />}
                            {!dir && <ChevronUp size={12} aria-hidden className="opacity-30" />}
                          </button>
                        ) : (
                          <span>{col.label}</span>
                        )}
                        {col.filter && (
                          <ColumnFilterTrigger
                            columnLabel={columnLabel}
                            filter={col.filter}
                            value={filterValue}
                            onChange={setFilter}
                          />
                        )}
                      </div>
                    </th>
                  );
                })}
                {listActions?.rowActions && (
                  <th
                    scope="col"
                    style={{ width: listActions.rowActions.width ?? 72 }}
                    className={cn(headerPad, 'text-center')}
                  >
                    {listActions.rowActions.labelAr ?? 'إجراءات'}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={visibleColumnCount}
                    className="px-4 py-9"
                  >
                    <LoadingState variant="list" rows={6} />
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td
                    colSpan={visibleColumnCount}
                    className="px-4 py-9"
                  >
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && processed.length === 0 && (
                <tr>
                  <td
                    colSpan={visibleColumnCount}
                    className="px-4 py-9"
                  >
                    {empty ?? (
                      <p className="text-center text-sm text-ink-500">لا توجد بيانات لعرضها</p>
                    )}
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                processed.length > 0 &&
                processed.map((row, i) => {
                  const key = rowKey?.(row, i) ?? i;
                  const isSelected = selectedSet.has(key);
                  const interactive = Boolean(onRowClick) || selectionMode !== 'none';
                  const isDeletedRow = Boolean(listActions?.deleted?.isDeleted(row));
                  return (
                    <tr
                      key={key}
                      onClick={onRowClick ? () => onRowClick(row, i) : undefined}
                      aria-selected={isSelected || undefined}
                      className={cn(
                        'border-b border-border-subtle last:border-b-0 transition-colors duration-fast ease-standard',
                        interactive && 'cursor-pointer',
                        zebraStripes && i % 2 === 1 && 'bg-ink-50',
                        interactive && 'hover:bg-teal-50',
                        isDeletedRow && 'bg-warning-bg/70 text-ink-600 hover:bg-warning-bg',
                        isSelected && 'bg-accent-50 hover:bg-accent-50',
                      )}
                      style={
                        isSelected
                          ? {
                              boxShadow: 'inset 3px 0 0 var(--accent-500)',
                            }
                          : undefined
                      }
                    >
                      <th
                        scope="row"
                        className={cn(
                          cellPad,
                          'w-14 text-center align-middle font-numeric text-sm font-medium text-ink-500 tnum',
                        )}
                        aria-label={`مسلسل ${sequenceBase + i + 1}`}
                      >
                        <span dir="ltr">{(sequenceBase + i + 1).toLocaleString('en-US')}</span>
                      </th>
                      {selectionMode !== 'none' && (
                        <td
                          className={cn(cellPad, 'w-10 text-center')}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type={selectionMode === 'multi' ? 'checkbox' : 'radio'}
                            aria-label="تحديد الصف"
                            checked={isSelected}
                            onChange={() => toggleRow(key)}
                            className="h-4 w-4 cursor-pointer accent-teal-500"
                          />
                        </td>
                      )}
                      {columns.map((col) => {
                        const value =
                          col.render?.(row, i) ??
                          (col.accessor ? String((row as Record<string, unknown>)[col.accessor] ?? '') : '');
                        return (
                          <td
                            key={col.key}
                            className={cn(
                              cellPad,
                              'text-sm text-ink-900 align-middle',
                              col.align === 'end' && 'text-end',
                              col.align === 'center' && 'text-center',
                              col.numeric && !col.align && 'text-end font-numeric tnum',
                              col.hideOn === 'sm' && 'hidden md:table-cell',
                              col.hideOn === 'md' && 'hidden lg:table-cell',
                              col.className,
                            )}
                          >
                            {value}
                          </td>
                        );
                      })}
                      {listActions?.rowActions && (
                        <td
                          className={cn(cellPad, 'text-center align-middle')}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {listActions.rowActions.render(row)}
                        </td>
                      )}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {pagination && data.length > 0 && (
          <Pagination pagination={pagination} />
        )}
      </div>
    </div>
  );
}

function Pagination({ pagination }: { pagination: DataTablePagination }): JSX.Element {
  const { page, pageSize, total, pageSizeOptions = [10, 25, 50], onPageChange, onPageSizeChange } =
    pagination;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border-subtle bg-surface-card px-4 py-2 text-sm text-ink-500">
      <span className="font-numeric tnum">
        إجمالي: <span dir="ltr">{total.toLocaleString('en-US')}</span>
      </span>
      {onPageSizeChange && (
        <div className="inline-flex items-center gap-2">
          <span>لكل صفحة:</span>
          <Select
            aria-label="عدد الصفوف لكل صفحة"
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            options={pageSizeOptions.map((s) => ({ value: String(s), label: String(s) }))}
            containerClassName="w-20"
          />
        </div>
      )}
      <span className="font-numeric tnum" dir="ltr">
        {page} / {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="الصفحة السابقة"
          className="rounded-md border border-border-default bg-surface-card p-1 text-ink-500 disabled:opacity-40 hover:enabled:border-border-strong focus-visible:shadow-focus-teal focus-visible:outline-none"
        >
          <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label="الصفحة التالية"
          className="rounded-md border border-border-default bg-surface-card p-1 text-ink-500 disabled:opacity-40 hover:enabled:border-border-strong focus-visible:shadow-focus-teal focus-visible:outline-none"
        >
          <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </div>
  );
}
