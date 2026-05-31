/**
 * مركز تبادل البيانات — centralized admin Data-Exchange hub at
 * `/admin/data-exchange`. Four sections: Export, Import, dedicated Preview,
 * and History. RTL. Composes existing shared primitives only.
 */

import { useState } from 'react';
import {
  ArrowDownUp,
  CalendarClock,
  Check,
  Clock3,
  Database,
  Download,
  FileCheck2,
  FileSpreadsheet,
  History,
  ListFilter,
  ShieldCheck,
  Upload,
} from 'lucide-react';
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

const LAYOUT_OPTIONS: Array<{ value: ExportLayout; label: string; description: string }> = [
  {
    value: 'single-workbook',
    label: 'مصنّف واحد',
    description: 'كل النطاقات داخل ملف Excel واحد بأسماء أوراق ثابتة.',
  },
  {
    value: 'file-per-type',
    label: 'ملف لكل نطاق',
    description: 'ملف منفصل لكل نطاق لتسليمات الجهات المختلفة.',
  },
];

const FILTER_OPTIONS: Array<{ value: FilterKind; label: string; description: string }> = [
  { value: 'all', label: 'الكل', description: 'تصدير نسخة كاملة من النطاقات المختارة.' },
  {
    value: 'modifiedSinceCreation',
    label: 'المُعدَّل بعد الإنشاء',
    description: 'الصفوف التي تغيّرت بعد إنشائها فقط.',
  },
  { value: 'sinceLastExport', label: 'منذ آخر تصدير', description: 'تجهيز دفعة متابعة قصيرة.' },
  { value: 'changedAfter', label: 'منذ تاريخ', description: 'تحديد نقطة زمنية يدوية للتبادل.' },
];

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
  const selectedDomains = EXCHANGE_DOMAINS.filter((domain) => selected.has(domain));
  const historyRows = historyQuery.data ?? [];
  const latestHistory = historyRows[0];
  const invalidCount = preview?.counts.invalid ?? 0;
  const conflictCount = preview?.counts.conflict ?? 0;
  const actionablePreviewCount = preview
    ? (preview.counts.new ?? 0) + (preview.counts.changed ?? 0)
    : 0;

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
        entityLabel: 'مركز تبادل البيانات',
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
        entityLabel: 'مركز تبادل البيانات',
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
        title="مركز تبادل البيانات"
        subtitle="نقطة تشغيل واحدة لتصدير واستيراد بيانات المنظومة عبر Excel مع كشف التغييرات وحماية مفاتيح السجلات."
        actions={<Badge tone="accent" icon={<ShieldCheck size={14} />}>مسار مُراقب</Badge>}
      />

      <section
        aria-label="ملخص مركز تبادل البيانات"
        className="rounded-lg border border-border-subtle bg-surface-card p-5 shadow-xs"
      >
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info" icon={<ArrowDownUp size={14} />}>تبادل Excel</Badge>
              <Badge tone="neutral" icon={<Database size={14} />}>
                {selectedDomains.length} من {EXCHANGE_DOMAINS.length} نطاقات مفعّلة
              </Badge>
              {preview && (
                <Badge tone={invalidCount > 0 || conflictCount > 0 ? 'warning' : 'success'} icon={<FileCheck2 size={14} />}>
                  {actionablePreviewCount} صف قابل للتطبيق
                </Badge>
              )}
            </div>
            <p className="max-w-3xl text-sm leading-7 text-ink-600">
              صُمم المركز ليجمع تبادل بيانات الإنترنت والشبكة الداخلية في مسار واضح: اختر النطاقات، صدّر
              النسخة المعتمدة، ثم عاين ملف الاستيراد قبل تطبيق أي تغيير على السجلات.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatusTile
              icon={<FileSpreadsheet size={18} />}
              label="صيغة التصدير"
              value={layout === 'single-workbook' ? 'مصنّف واحد' : 'ملف لكل نطاق'}
            />
            <StatusTile
              icon={<ListFilter size={18} />}
              label="فلتر البيانات"
              value={FILTER_OPTIONS.find((option) => option.value === filterKind)?.label ?? 'الكل'}
            />
            <StatusTile
              icon={<Clock3 size={18} />}
              label="آخر عملية"
              value={latestHistory ? latestHistory.details : 'لا توجد عمليات بعد'}
            />
            <StatusTile
              icon={<History size={18} />}
              label="السجل"
              value={`${historyRows.length} عملية محفوظة`}
            />
          </div>
        </div>
      </section>

      {/* ── Export ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Download size={18} /> تصدير البيانات
            </span>
          }
          subtitle="النطاقات المختارة تُحوّل إلى أوراق Excel مقفلة الأسماء ليقرأها الطرف المستقبِل دون تخمين."
          actions={<Badge tone="neutral">{selectedDomains.length} نطاق</Badge>}
        />
        <CardBody className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-2xs font-semibold text-ink-700">النطاقات</legend>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {EXCHANGE_DOMAINS.map((domain) => (
                <label
                  key={domain}
                  className={[
                    'group flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-sm transition-colors duration-fast ease-standard',
                    'focus-within:shadow-focus-teal',
                    selected.has(domain)
                      ? 'border-[var(--accent-500)] bg-[var(--accent-50)] text-ink-900'
                      : 'border-border-subtle bg-surface-card text-ink-600 hover:border-border-default hover:bg-ink-50',
                  ].join(' ')}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selected.has(domain)}
                    onChange={() => toggleDomain(domain)}
                  />
                  <span
                    aria-hidden
                    className={[
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                      selected.has(domain)
                        ? 'border-[var(--accent-500)] bg-[var(--accent-500)] text-white'
                        : 'border-border-default bg-surface-card text-transparent group-hover:border-[var(--accent-500)]',
                    ].join(' ')}
                  >
                    <Check size={13} strokeWidth={2.25} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{DOMAIN_TITLES_AR[domain]}</span>
                    <span dir="ltr" className="mt-1 block truncate font-mono text-[10px] text-ink-400">
                      {SHEET_NAMES[domain]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 xl:grid-cols-2">
            <fieldset className="space-y-2">
              <legend className="text-2xs font-semibold text-ink-700">تنسيق الخرج</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {LAYOUT_OPTIONS.map((option) => (
                  <ChoiceCard
                    key={option.value}
                    name="dx-layout"
                    checked={layout === option.value}
                    label={option.label}
                    description={option.description}
                    onChange={() => setLayout(option.value)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-2xs font-semibold text-ink-700">فلتر البيانات</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {FILTER_OPTIONS.map((option) => (
                  <ChoiceCard
                    key={option.value}
                    name="dx-filter"
                    checked={filterKind === option.value}
                    label={option.label}
                    description={option.description}
                    onChange={() => setFilterKind(option.value)}
                  />
                ))}
              </div>
              {filterKind === 'changedAfter' && (
                <label className="mt-3 flex max-w-xs flex-col gap-1 text-2xs font-semibold text-ink-700">
                  تاريخ بداية التبادل
                  <input
                    type="date"
                    value={changedAfter}
                    onChange={(e) => setChangedAfter(e.target.value)}
                    className="h-9 rounded-md border border-border-default bg-surface-card px-3 text-sm font-normal text-ink-900 transition-colors duration-fast ease-standard hover:border-border-strong focus:border-teal-500 focus:outline-none focus-visible:shadow-focus-teal"
                  />
                </label>
              )}
            </fieldset>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-ink-50 px-4 py-3">
            <p className="text-xs leading-6 text-ink-500">
              سيتم إنشاء ملف يتضمن حقول التتبع: الإصدار، آخر تعديل، مصدر النظام، وبصمة الصف.
            </p>
            <Button variant="primary" isLoading={exportMutation.isPending} onClick={() => void handleExport()}>
              <FileSpreadsheet size={16} className="me-1" />
              تصدير إلى Excel
            </Button>
          </div>
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
          subtitle="المعاينة إلزامية قبل التطبيق حتى تظهر الصفوف الجديدة والمعدّلة والتعارضات بوضوح."
          actions={
            parsedSheets.length > 0 ? (
              <Badge tone="info">{parsedSheets.length} أوراق مقروءة</Badge>
            ) : undefined
          }
        />
        <CardBody className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <FileUpload
              files={files}
              onFilesChange={(f) => void handleFiles(f)}
              accept=".xlsx,.xls"
              title="اسحب مصنّف Excel هنا أو انقر للاختيار"
              helper="يجب أن تطابق أسماء الأوراق سجل النظام الثابت."
            />
            {previewMutation.isPending && (
              <p className="mt-3 flex items-center gap-2 text-2xs text-ink-500">
                <CalendarClock size={14} />
                جارٍ تحليل الملف وكشف التغييرات...
              </p>
            )}
          </div>
          <div className="rounded-lg border border-border-subtle bg-ink-50 p-4">
            <p className="text-2xs font-semibold text-ink-700">قواعد الاستيراد</p>
            <ul className="mt-3 space-y-2 text-xs leading-6 text-ink-600">
              <li className="flex gap-2">
                <Check size={14} className="mt-1 shrink-0 text-teal-600" />
                أسماء الأوراق تبقى ASCII كما في سجل النظام.
              </li>
              <li className="flex gap-2">
                <Check size={14} className="mt-1 shrink-0 text-teal-600" />
                الصفوف المتعارضة لا تُطبّق إلا وفق خيار المراجعة.
              </li>
              <li className="flex gap-2">
                <Check size={14} className="mt-1 shrink-0 text-teal-600" />
                فرض تحديث الصفوف القديمة محصور بمدير النظام الرئيسي.
              </li>
            </ul>
          </div>
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
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <History size={18} /> سجل المركز
            </span>
          }
          subtitle="آخر عمليات التصدير والاستيراد المسجلة لأغراض المراجعة."
        />
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

function StatusTile({
  icon,
  label,
  value,
}: {
  icon: JSX.Element;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="min-w-0 rounded-lg border border-border-subtle bg-ink-50 px-3 py-3">
      <div className="mb-2 flex items-center gap-2 text-ink-500">
        {icon}
        <span className="text-2xs font-semibold">{label}</span>
      </div>
      <p className="truncate text-sm font-semibold text-ink-900">{value}</p>
    </div>
  );
}

function ChoiceCard({
  name,
  checked,
  label,
  description,
  onChange,
}: {
  name: string;
  checked: boolean;
  label: string;
  description: string;
  onChange: () => void;
}): JSX.Element {
  return (
    <label
      className={[
        'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition-colors duration-fast ease-standard',
        'focus-within:shadow-focus-teal',
        checked
          ? 'border-[var(--accent-500)] bg-[var(--accent-50)]'
          : 'border-border-subtle bg-surface-card hover:border-border-default hover:bg-ink-50',
      ].join(' ')}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span
        aria-hidden
        className={[
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
          checked ? 'border-[var(--accent-500)]' : 'border-border-default bg-surface-card',
        ].join(' ')}
      >
        {checked && <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-500)]" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink-900">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-ink-500">{description}</span>
      </span>
    </label>
  );
}
