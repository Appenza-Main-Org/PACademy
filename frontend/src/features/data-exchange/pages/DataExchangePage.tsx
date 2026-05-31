/**
 * آليات تبادل البيانات — centralized admin Data-Exchange hub at
 * `/admin/data-exchange`. Four sections: Export, Import, dedicated Preview,
 * and History. RTL. Composes existing shared primitives only.
 */

import { useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  FileUpload,
  PageHeader,
  toast,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components/DataTable';
import type { UploadFile } from '@/shared/components/FileUpload';
import { useAuthStore } from '@/features/auth';
import { emitAudit } from '@/shared/lib/audit';
import {
  type DataExchangeHistoryEntry,
  type ExchangeDomain,
  type ExportFilter,
  type ExportLayout,
  type ImportApplyMode,
  type ImportPreview,
  type ImportSheetInput,
  DOMAIN_TITLES_AR,
  EXCHANGE_DOMAINS,
  SHEET_NAMES,
} from '../types';
import {
  useApplyMutation,
  useDataExchangeHistory,
  useExportMutation,
  usePreviewMutation,
} from '../api/queries';
import { buildPerTypeBlobs, buildWorkbookBlob, downloadBlob, parseWorkbook } from '../lib/workbook';
import { DataExchangePreview } from '../components/DataExchangePreview';

type FilterKind = 'all' | 'changedAfter' | 'modifiedSinceCreation' | 'sinceLastExport';

export function DataExchangePage(): JSX.Element {
  const role = useAuthStore((s) => s.user?.role);
  const isSuperAdmin = role === 'super_admin';

  /* ── Export state ──────────────────────────────────────────────────── */
  const [selected, setSelected] = useState<Set<ExchangeDomain>>(new Set(EXCHANGE_DOMAINS));
  const [layout, setLayout] = useState<ExportLayout>('single-workbook');
  const [filterKind, setFilterKind] = useState<FilterKind>('all');
  const [changedAfter, setChangedAfter] = useState('');
  const exportMutation = useExportMutation();

  /* ── Import state ──────────────────────────────────────────────────── */
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [parsedSheets, setParsedSheets] = useState<ImportSheetInput[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const previewMutation = usePreviewMutation();
  const applyMutation = useApplyMutation();

  const historyQuery = useDataExchangeHistory();

  function toggleDomain(domain: ExchangeDomain): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  function resolveFilter(): ExportFilter {
    if (filterKind === 'changedAfter') return { changedAfter: new Date(changedAfter).toISOString() };
    if (filterKind === 'modifiedSinceCreation') return 'modifiedSinceCreation';
    if (filterKind === 'sinceLastExport') return 'sinceLastExport';
    return 'all';
  }

  async function handleExport(): Promise<void> {
    const domains = EXCHANGE_DOMAINS.filter((d) => selected.has(d));
    if (domains.length === 0) {
      toast('اختر نطاقًا واحدًا على الأقل للتصدير.', 'warning');
      return;
    }
    if (filterKind === 'changedAfter' && !changedAfter) {
      toast('حدّد التاريخ لفلتر «منذ تاريخ».', 'warning');
      return;
    }
    try {
      const result = await exportMutation.mutateAsync({ domains, layout, filter: resolveFilter() });
      const stamp = new Date().toISOString().slice(0, 10);
      if (layout === 'file-per-type') {
        const blobs = await buildPerTypeBlobs(result.sheets);
        for (const { sheetName, blob } of blobs) downloadBlob(blob, `data-exchange-${sheetName}-${stamp}.xlsx`);
      } else {
        const blob = await buildWorkbookBlob(result.sheets);
        downloadBlob(blob, `data-exchange-${stamp}.xlsx`);
      }
      emitAudit({
        action: 'entity_exported',
        module: 'admin',
        entityType: 'data-exchange',
        entityLabel: 'تبادل البيانات',
        entityId: `export-${stamp}`,
        details: `تصدير ${result.sheets.length} ورقة · ${result.totalRows} صف`,
      });
      toast(`تم تصدير ${result.totalRows} صف.`, 'success');
    } catch {
      toast('تعذّر التصدير.', 'danger');
    }
  }

  async function handleFiles(next: UploadFile[]): Promise<void> {
    setFiles(next);
    const target = next[0];
    if (!target) {
      setPreview(null);
      setParsedSheets([]);
      return;
    }
    try {
      const { sheets, unknownSheets } = await parseWorkbook(target.file);
      setParsedSheets(sheets);
      if (unknownSheets.length > 0) {
        toast(`أوراق غير معروفة سيتم تجاهلها: ${unknownSheets.join('، ')}`, 'warning');
      }
      if (sheets.length === 0) {
        toast('لا توجد أوراق مطابقة لأسماء النظام في الملف.', 'danger');
        setPreview(null);
        return;
      }
      const result = await previewMutation.mutateAsync(sheets);
      setPreview(result);
    } catch {
      toast('تعذّرت قراءة الملف أو معاينته.', 'danger');
      setPreview(null);
    }
  }

  async function handleApply(args: { mode: ImportApplyMode; skipConflicts: boolean; forceUpdate: boolean }): Promise<void> {
    try {
      const result = await applyMutation.mutateAsync({ sheets: parsedSheets, ...args });
      emitAudit({
        action: 'entity_imported',
        module: 'admin',
        entityType: 'data-exchange',
        entityLabel: 'تبادل البيانات',
        entityId: `import-${Date.now()}`,
        details: `استيراد · ${result.insertedCount} إضافة · ${result.updatedCount} تحديث · ${result.failedCount} فشل`,
        after: result,
      });
      toast(`تم الاستيراد: ${result.insertedCount} إضافة، ${result.updatedCount} تحديث.`, 'success');
      // Re-preview against the now-updated store so the matrix reflects reality.
      const refreshed = await previewMutation.mutateAsync(parsedSheets);
      setPreview(refreshed);
    } catch {
      toast('تعذّر تطبيق الاستيراد.', 'danger');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="آليات تبادل البيانات"
        subtitle="تصدير واستيراد بيانات المنظومة عبر Excel مع كشف التغييرات ومنع تكرار المفاتيح."
      />

      {/* ── Export ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Download size={18} /> تصدير البيانات
            </span>
          }
        />
        <CardBody className="space-y-4">
          <div>
            <p className="mb-2 text-2xs font-semibold text-ink-700">النطاقات</p>
            <div className="flex flex-wrap gap-2">
              {EXCHANGE_DOMAINS.map((domain) => (
                <label
                  key={domain}
                  className={[
                    'flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-2xs transition-colors',
                    selected.has(domain)
                      ? 'border-[var(--accent-500)] bg-[var(--accent-50)] text-ink-900'
                      : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50',
                  ].join(' ')}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selected.has(domain)}
                    onChange={() => toggleDomain(domain)}
                  />
                  {DOMAIN_TITLES_AR[domain]}
                  <span className="font-mono text-[10px] text-ink-400">{SHEET_NAMES[domain]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <span className="text-2xs font-semibold text-ink-700">التنسيق:</span>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="dx-layout"
                checked={layout === 'single-workbook'}
                onChange={() => setLayout('single-workbook')}
              />
              مصنّف واحد (أسماء أوراق ثابتة)
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="dx-layout"
                checked={layout === 'file-per-type'}
                onChange={() => setLayout('file-per-type')}
              />
              ملف لكل نطاق
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <span className="text-2xs font-semibold text-ink-700">الفلتر:</span>
            {([
              ['all', 'الكل'],
              ['modifiedSinceCreation', 'المُعدَّل بعد الإنشاء'],
              ['sinceLastExport', 'منذ آخر تصدير'],
              ['changedAfter', 'منذ تاريخ'],
            ] as Array<[FilterKind, string]>).map(([kind, label]) => (
              <label key={kind} className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="dx-filter"
                  checked={filterKind === kind}
                  onChange={() => setFilterKind(kind)}
                />
                {label}
              </label>
            ))}
            {filterKind === 'changedAfter' && (
              <input
                type="date"
                value={changedAfter}
                onChange={(e) => setChangedAfter(e.target.value)}
                className="rounded-md border border-ink-200 px-2 py-1 text-sm"
              />
            )}
          </div>

          <Button variant="primary" isLoading={exportMutation.isPending} onClick={() => void handleExport()}>
            <FileSpreadsheet size={16} className="me-1" />
            تصدير إلى Excel
          </Button>
        </CardBody>
      </Card>

      {/* ── Import ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Upload size={18} /> استيراد البيانات
            </span>
          }
        />
        <CardBody>
          <FileUpload
            files={files}
            onFilesChange={(f) => void handleFiles(f)}
            accept=".xlsx,.xls"
            title="اسحب مصنّف Excel هنا أو انقر للاختيار"
            helper="يجب أن تطابق أسماء الأوراق سجل النظام الثابت."
          />
          {previewMutation.isPending && <p className="mt-3 text-2xs text-ink-500">جارٍ تحليل الملف…</p>}
        </CardBody>
      </Card>

      {/* ── Preview ─────────────────────────────────────────────────── */}
      {preview && (
        <DataExchangePreview
          preview={preview}
          isSuperAdmin={isSuperAdmin}
          applying={applyMutation.isPending}
          onApply={(args) => void handleApply(args)}
        />
      )}

      {/* ── History ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader title="سجل التبادل" />
        <CardBody>
          <DataTable<DataExchangeHistoryEntry>
            data={historyQuery.data ?? []}
            columns={HISTORY_COLUMNS}
            rowKey={(r) => r.id}
            loading={historyQuery.isLoading}
            density="compact"
          />
        </CardBody>
      </Card>
    </div>
  );
}

const HISTORY_COLUMNS: DataTableColumn<DataExchangeHistoryEntry>[] = [
  {
    key: 'action',
    label: 'العملية',
    width: 110,
    render: (r) => (
      <Badge tone={r.action === 'export' ? 'info' : 'success'}>
        {r.action === 'export' ? 'تصدير' : 'استيراد'}
      </Badge>
    ),
  },
  { key: 'details', label: 'التفاصيل', accessor: 'details' },
  { key: 'total', label: 'الإجمالي', numeric: true, accessor: 'total', width: 90 },
  { key: 'inserted', label: 'إضافة', numeric: true, accessor: 'inserted', width: 80 },
  { key: 'updated', label: 'تحديث', numeric: true, accessor: 'updated', width: 80 },
  { key: 'failed', label: 'فشل', numeric: true, accessor: 'failed', width: 80 },
  { key: 'actor', label: 'المستخدم', accessor: 'actorName', width: 140, hideOn: 'sm' },
  {
    key: 'timestamp',
    label: 'التاريخ',
    width: 170,
    hideOn: 'md',
    render: (r) => new Date(r.timestamp).toLocaleString('ar-EG'),
  },
];
