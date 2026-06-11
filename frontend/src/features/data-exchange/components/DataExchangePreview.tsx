/**
 * Dedicated import-preview surface for the Data-Exchange hub. Purpose-built —
 * NOT the list-actions `ImportPreviewTable`. Renders the 6-class change-detection
 * matrix (New / Changed / Skipped / Outdated / Conflict / Invalid), a class
 * filter, apply controls, a super-admin-gated force-update for Outdated rows,
 * and a validation-errors download.
 */

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Search, ShieldAlert } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, DataTable, Input, Select } from '@/shared/components';
import type { BadgeTone } from '@/shared/components/Badge';
import type { DataTableColumn } from '@/shared/components/DataTable';
import {
  type ImportApplyMode,
  type ImportPreview,
  type ImportRowClass,
  type ImportRowOutcome,
  CLASS_LABELS_AR,
  IMPORT_ROW_CLASSES,
} from '../types';
import { buildErrorsBlob, downloadBlob } from '../lib/workbook';

const CLASS_TONE: Record<ImportRowClass, BadgeTone> = {
  new: 'info',
  changed: 'warning',
  skipped: 'neutral',
  outdated: 'warning',
  conflict: 'danger',
  invalid: 'danger',
};

const PREVIEW_PAGE_SIZE_OPTIONS = [25, 50, 100, 250] as const;

interface DataExchangePreviewProps {
  preview: ImportPreview;
  isSuperAdmin: boolean;
  applying: boolean;
  onApply: (args: { mode: ImportApplyMode; skipConflicts: boolean; forceUpdate: boolean }) => void;
}

export function DataExchangePreview({
  preview,
  isSuperAdmin,
  applying,
  onApply,
}: DataExchangePreviewProps): JSX.Element {
  const [activeClass, setActiveClass] = useState<ImportRowClass | 'all'>('all');
  const [mode, setMode] = useState<ImportApplyMode>('new-and-changed');
  const [skipConflicts, setSkipConflicts] = useState(true);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [activeSheet, setActiveSheet] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setActiveClass('all');
    setActiveSheet('all');
    setQuery('');
    setPage(1);
  }, [preview]);

  const sheetOptions = useMemo(() => buildSheetOptions(preview.rows), [preview.rows]);

  const filteredRows = useMemo(() => {
    const needle = normalizeSearch(query);
    return preview.rows.filter((row) => {
      if (activeClass !== 'all' && row.class !== activeClass) return false;
      if (activeSheet !== 'all' && row.sheetName !== activeSheet) return false;
      return matchesPreviewQuery(row, needle);
    });
  }, [activeClass, activeSheet, preview.rows, query]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, pageSize, safePage]);

  const outdatedCount = preview.counts.outdated ?? 0;
  const hasInvalid = (preview.counts.invalid ?? 0) > 0 || preview.rows.some((r) => r.class === 'invalid');
  const conflictCount = preview.counts.conflict ?? 0;
  const actionableCount = (preview.counts.new ?? 0) + (preview.counts.changed ?? 0);

  const columns: DataTableColumn<ImportRowOutcome>[] = [
    { key: 'sheet', label: 'الجدول', accessor: 'sheetName', width: 160 },
    { key: 'row', label: 'الصف', numeric: true, render: (r) => r.rowIndex + 1, width: 70 },
    { key: 'businessKey', label: 'المفتاح', accessor: 'businessKey' },
    {
      key: 'class',
      label: 'التصنيف',
      width: 120,
      render: (r) => (
        <Badge tone={CLASS_TONE[r.class]}>{CLASS_LABELS_AR[r.class]}</Badge>
      ),
    },
    { key: 'errors', label: 'الملاحظات', render: (r) => (r.errors.length ? r.errors.join('، ') : '—') },
  ];

  async function downloadErrors(): Promise<void> {
    const rows = preview.rows
      .filter((r) => r.class === 'invalid' || r.errors.length > 0)
      .map((r) => ({ sheetName: r.sheetName, rowIndex: r.rowIndex, businessKey: r.businessKey, errors: r.errors }));
    if (rows.length === 0) return;
    const blob = await buildErrorsBlob(rows);
    downloadBlob(blob, `data-exchange-validation-errors-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function changeActiveClass(nextClass: ImportRowClass | 'all'): void {
    setActiveClass(nextClass);
    setPage(1);
  }

  function changeActiveSheet(nextSheet: string): void {
    setActiveSheet(nextSheet);
    setPage(1);
  }

  function changeQuery(nextQuery: string): void {
    setQuery(nextQuery);
    setPage(1);
  }

  function changePageSize(nextPageSize: number): void {
    setPageSize(nextPageSize);
    setPage(1);
  }

  return (
    <Card>
      <CardHeader
        title="معاينة الاستيراد"
        subtitle="راجع تصنيف الصفوف قبل تطبيق أي تغيير على قاعدة البيانات."
        actions={
          hasInvalid ? (
            <Button variant="ghost" size="sm" onClick={() => void downloadErrors()}>
              <Download size={16} className="me-1" />
              تنزيل أخطاء التحقق
            </Button>
          ) : undefined
        }
      />
      <CardBody className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <PreviewMetric
            icon={<Search size={17} />}
            label="إجمالي الصفوف"
            value={preview.rows.length}
            tone="neutral"
          />
          <PreviewMetric
            icon={<CheckCircle2 size={17} />}
            label="قابل للتطبيق"
            value={actionableCount}
            tone="success"
          />
          <PreviewMetric
            icon={<ShieldAlert size={17} />}
            label="تعارضات"
            value={conflictCount}
            tone={conflictCount > 0 ? 'danger' : 'neutral'}
          />
          <PreviewMetric
            icon={<AlertTriangle size={17} />}
            label="غير صالح"
            value={preview.counts.invalid ?? 0}
            tone={hasInvalid ? 'danger' : 'neutral'}
          />
        </div>

        <div className="rounded-lg border border-border-subtle bg-surface-card p-3 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(15rem,1fr)_14rem_auto] lg:items-end">
            <Input
              value={query}
              onChange={(event) => changeQuery(event.target.value)}
              label="بحث سريع"
              placeholder="الجدول، المفتاح، أو الملاحظات"
              leadingIcon={<Search size={15} />}
              density="compact"
            />
            <Select
              value={activeSheet}
              onChange={(event) => changeActiveSheet(event.target.value)}
              label="الجدول"
              options={sheetOptions}
            />
            <VisibleRowsSummary
              start={(safePage - 1) * pageSize + 1}
              end={(safePage - 1) * pageSize + pageRows.length}
              total={filteredRows.length}
              all={preview.rows.length}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2" role="toolbar" aria-label="تصفية تصنيفات الاستيراد">
            <ClassChip
              label="الكل"
              count={preview.rows.length}
              active={activeClass === 'all'}
              tone="neutral"
              onClick={() => changeActiveClass('all')}
            />
            {IMPORT_ROW_CLASSES.map((cls) => (
              <ClassChip
                key={cls}
                label={CLASS_LABELS_AR[cls]}
                count={preview.counts[cls] ?? 0}
                active={activeClass === cls}
                tone={CLASS_TONE[cls]}
                onClick={() => changeActiveClass(cls)}
              />
            ))}
          </div>
        </div>

        {preview.sheetIssues.length > 0 && (
          <div className="rounded-md border border-terra-300 bg-terra-50 p-3 text-2xs text-terra-700">
            <p className="mb-1 flex items-center gap-1 font-semibold">
              <AlertTriangle size={14} /> جداول مرفوضة (أسماء غير معروفة)
            </p>
            <ul className="list-disc space-y-0.5 ps-5">
              {preview.sheetIssues.map((issue) => (
                <li key={issue.sheetName}>{issue.message}</li>
              ))}
            </ul>
          </div>
        )}

        <DataTable<ImportRowOutcome>
          data={pageRows}
          columns={columns}
          rowKey={(r) => `${r.sheetName}-${r.rowIndex}`}
          density="compact"
          stickyHeader
          sequenceStart={(safePage - 1) * pageSize + 1}
          pagination={{
            page: safePage,
            pageSize,
            total: filteredRows.length,
            pageSizeOptions: PREVIEW_PAGE_SIZE_OPTIONS,
            onPageChange: setPage,
            onPageSizeChange: changePageSize,
          }}
          empty={
            <p className="text-center text-sm text-ink-500">
              لا توجد صفوف تطابق البحث أو التصفية الحالية.
            </p>
          }
        />

        {/* Apply controls */}
        <div className="rounded-lg border border-border-subtle bg-ink-50 p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="space-y-3">
              <fieldset className="space-y-2">
                <legend className="text-2xs font-semibold text-ink-700">وضع التطبيق</legend>
                <div className="flex flex-wrap gap-2">
                  <ModePill
                    name="dx-mode"
                    checked={mode === 'new-only'}
                    label="الجديد فقط"
                    onChange={() => setMode('new-only')}
                  />
                  <ModePill
                    name="dx-mode"
                    checked={mode === 'new-and-changed'}
                    label="الجديد والمُعدَّل"
                    onChange={() => setMode('new-and-changed')}
                  />
                </div>
              </fieldset>

              <div className="flex flex-wrap gap-2">
                <TogglePill
                  checked={skipConflicts}
                  label="تخطّي التعارضات"
                  onChange={(checked) => setSkipConflicts(checked)}
                />
                <TogglePill
                  checked={forceUpdate}
                  disabled={!isSuperAdmin || outdatedCount === 0}
                  label={`فرض تحديث الصفوف القديمة (${outdatedCount})`}
                  title={isSuperAdmin ? undefined : 'متاح لمدير النظام الرئيسي فقط'}
                  onChange={(checked) => setForceUpdate(checked)}
                />
              </div>
            </div>
            <Button
              variant="primary"
              isLoading={applying}
              disabled={preview.rows.length === 0}
              onClick={() => onApply({ mode, skipConflicts, forceUpdate })}
            >
              تطبيق الاستيراد
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function normalizeSearch(query: string): string {
  return query.trim().toLocaleLowerCase('ar-EG');
}

function matchesPreviewQuery(row: ImportRowOutcome, needle: string): boolean {
  if (!needle) return true;
  return [
    row.sheetName,
    row.domain,
    row.businessKey,
    CLASS_LABELS_AR[row.class],
    row.errors.join(' '),
    String(row.rowIndex + 1),
  ].some((part) => part.toLocaleLowerCase('ar-EG').includes(needle));
}

function buildSheetOptions(
  rows: readonly ImportRowOutcome[],
): ReadonlyArray<{ value: string; label: string }> {
  const sheetNames = Array.from(new Set(rows.map((row) => row.sheetName))).sort((a, b) =>
    a.localeCompare(b, 'en'),
  );
  return [
    { value: 'all', label: 'كل الجداول' },
    ...sheetNames.map((sheetName) => ({ value: sheetName, label: sheetName })),
  ];
}

function PreviewMetric({
  icon,
  label,
  value,
  tone,
}: {
  icon: JSX.Element;
  label: string;
  value: number;
  tone: BadgeTone;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-border-subtle bg-ink-50 px-3 py-3">
      <div className="mb-2 flex items-center gap-2 text-ink-500">
        {icon}
        <span className="text-2xs font-semibold">{label}</span>
      </div>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}

function VisibleRowsSummary({
  start,
  end,
  total,
  all,
}: {
  start: number;
  end: number;
  total: number;
  all: number;
}): JSX.Element {
  const safeStart = total === 0 ? 0 : start;
  return (
    <div className="rounded-md border border-border-subtle bg-ink-50 px-3 py-2 text-2xs text-ink-500">
      <p className="font-semibold text-ink-700">الصفوف المعروضة</p>
      <p className="mt-1 font-numeric tnum" dir="ltr">
        {safeStart.toLocaleString('en-US')} - {end.toLocaleString('en-US')} / {total.toLocaleString('en-US')}
      </p>
      {total !== all && (
        <p className="mt-1 text-ink-400">
          من أصل <span dir="ltr">{all.toLocaleString('en-US')}</span>
        </p>
      )}
    </div>
  );
}

function ClassChip({
  label,
  count,
  active,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  tone: BadgeTone;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center gap-1.5 rounded-full border px-3 py-1 text-2xs transition-colors duration-fast ease-standard',
        'focus-visible:shadow-focus-teal focus-visible:outline-none',
        active
          ? 'border-[var(--accent-500)] bg-[var(--accent-50)]'
          : 'border-border-subtle bg-surface-card hover:border-border-default hover:bg-ink-50',
      ].join(' ')}
      aria-pressed={active}
    >
      <Badge tone={tone}>{count}</Badge>
      <span className="text-ink-700">{label}</span>
    </button>
  );
}

function ModePill({
  name,
  checked,
  label,
  onChange,
}: {
  name: string;
  checked: boolean;
  label: string;
  onChange: () => void;
}): JSX.Element {
  return (
    <label
      className={[
        'inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors duration-fast ease-standard',
        'focus-within:shadow-focus-teal',
        checked
          ? 'border-[var(--accent-500)] bg-[var(--accent-50)] text-ink-900'
          : 'border-border-subtle bg-surface-card text-ink-600 hover:border-border-default hover:bg-ink-50',
      ].join(' ')}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span
        aria-hidden
        className={[
          'h-2.5 w-2.5 rounded-full',
          checked ? 'bg-[var(--accent-500)]' : 'bg-ink-200',
        ].join(' ')}
      />
      {label}
    </label>
  );
}

function TogglePill({
  checked,
  disabled,
  label,
  title,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  title?: string;
  onChange: (checked: boolean) => void;
}): JSX.Element {
  return (
    <label
      title={title}
      className={[
        'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors duration-fast ease-standard',
        disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer focus-within:shadow-focus-teal',
        checked
          ? 'border-[var(--accent-500)] bg-[var(--accent-50)] text-ink-900'
          : 'border-border-subtle bg-surface-card text-ink-600 hover:border-border-default hover:bg-ink-50',
      ].join(' ')}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden
        className={[
          'flex h-4 w-4 items-center justify-center rounded-md border',
          checked ? 'border-[var(--accent-500)] bg-[var(--accent-500)] text-white' : 'border-border-default',
        ].join(' ')}
      >
        {checked && <CheckCircle2 size={12} strokeWidth={2.25} />}
      </span>
      {label}
    </label>
  );
}
