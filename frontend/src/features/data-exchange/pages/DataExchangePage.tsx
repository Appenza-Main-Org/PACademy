/**
 * استيراد وتصدير البيانات — centralized admin Data-Exchange hub at
 * `/admin/data-exchange`. Four sections: Export, Import, dedicated Preview,
 * and History. RTL. Composes existing shared primitives only.
 */

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronDown,
  Database,
  Download,
  FileSpreadsheet,
  History,
  Settings2,
  ShieldCheck,
  Upload,
  Users,
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
  Tabs,
  toast,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components/DataTable';
import type { UploadFile } from '@/shared/components/FileUpload';
import { useAuthStore } from '@/features/auth';
import { useLookup } from '@/features/lookups';
import { emitAudit } from '@/shared/lib/audit';
import {
  type ApplicantReconciliationPreview,
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
  useApplicantsReconciliationCommitMutation,
  useApplicantsReconciliationPreviewMutation,
  useApplyMutation,
  useBookedApplicantsRoster,
  useDataExchangeHistory,
  useExportMutation,
  usePreviewMutation,
} from '../api/queries';
import { buildPerTypeBlobs, buildWorkbookBlob, downloadBlob, parseWorkbook } from '../lib/workbook';
import {
  ApplicantReconciliationTable,
  type ReconciliationDecisionState,
} from '../components/ApplicantReconciliationTable';
import { ApplicantRosterPanel } from '../components/ApplicantRosterPanel';
import { DataExchangePreview } from '../components/DataExchangePreview';
import { SectionErrorBoundary } from '../components/SectionErrorBoundary';
import { ApplicationSettingsCycleExportCard } from '@/features/admin/admission-setup';

type FilterKind = 'all' | 'changedAfter' | 'modifiedSinceCreation' | 'sinceLastExport';
type ExchangeTab = 'export' | 'import' | 'history';
type ExportPreset = 'all' | 'applicants' | 'operations' | 'configuration';

/** Parse a `<input type="date">` value to an ISO timestamp, or null when it
 *  is empty / not a valid date. Guards against `new Date('').toISOString()`
 *  (which throws a RangeError) reaching the export call. */
function toIsoOrNull(dateStr: string): string | null {
  if (!dateStr) return null;
  const ms = Date.parse(dateStr);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

const LAYOUT_OPTIONS: Array<{ value: ExportLayout; label: string }> = [
  {
    value: 'single-workbook',
    label: 'مصنّف واحد',
  },
  {
    value: 'file-per-type',
    label: 'ملف لكل نطاق',
  },
];

const FILTER_OPTIONS: Array<{ value: FilterKind; label: string }> = [
  {
    value: 'all',
    label: 'كل السجلات',
  },
  {
    value: 'modifiedSinceCreation',
    label: 'السجلات المُعدَّلة فقط',
  },
  {
    value: 'sinceLastExport',
    label: 'المُستجدّ منذ آخر تصدير',
  },
  {
    value: 'changedAfter',
    label: 'اعتبارًا من تاريخ مُحدَّد',
  },
];

const EXPORT_PRESETS: Array<{ value: ExportPreset; label: string; domains: ExchangeDomain[] }> = [
  {
    value: 'all',
    label: 'كل النطاقات',
    domains: [...EXCHANGE_DOMAINS],
  },
  {
    value: 'applicants',
    label: 'ملف المتقدمين',
    domains: ['Applicants', 'Relatives', 'AcquaintanceDocs'],
  },
  {
    value: 'operations',
    label: 'الاختبارات واللجان',
    domains: ['Exams', 'ExamSchedules', 'ExamResults', 'Committees'],
  },
  {
    value: 'configuration',
    label: 'الإعدادات والأكواد',
    domains: ['AdmissionConditions', 'SystemCodes'],
  },
];

const DOMAIN_GROUPS: Array<{ label: string; domains: ExchangeDomain[] }> = [
  {
    label: 'بيانات المتقدم',
    domains: ['Applicants', 'Relatives', 'AcquaintanceDocs'],
  },
  {
    label: 'التشغيل والاختبارات',
    domains: ['Exams', 'ExamSchedules', 'ExamResults', 'Committees'],
  },
  {
    label: 'الإعدادات المرجعية',
    domains: ['AdmissionConditions', 'SystemCodes'],
  },
];

export function DataExchangePage(): JSX.Element {
  const role = useAuthStore((s) => s.user?.role);
  const isSuperAdmin = role === 'super_admin';
  const [activeTab, setActiveTab] = useState<ExchangeTab>('export');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(25);

  /* ── Export state ──────────────────────────────────────────────────── */
  const [selected, setSelected] = useState<Set<ExchangeDomain>>(new Set(EXCHANGE_DOMAINS));
  const [layout, setLayout] = useState<ExportLayout>('single-workbook');
  const [filterKind, setFilterKind] = useState<FilterKind>('all');
  const [changedAfter, setChangedAfter] = useState('');
  const [selectedNationalIds, setSelectedNationalIds] = useState<string[]>([]);
  const exportMutation = useExportMutation();
  const rosterQuery = useBookedApplicantsRoster();
  const testsQuery = useLookup('tests');

  /* ── Import state ──────────────────────────────────────────────────── */
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [parsedSheets, setParsedSheets] = useState<ImportSheetInput[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [applicantsPreview, setApplicantsPreview] = useState<ApplicantReconciliationPreview | null>(null);
  const [reconcileDecisions, setReconcileDecisions] = useState<Map<string, ReconciliationDecisionState>>(new Map());
  const previewMutation = usePreviewMutation();
  const applyMutation = useApplyMutation();
  const reconcilePreviewMutation = useApplicantsReconciliationPreviewMutation();
  const reconcileCommitMutation = useApplicantsReconciliationCommitMutation();

  const historyQuery = useDataExchangeHistory();
  const selectedDomains = EXCHANGE_DOMAINS.filter((domain) => selected.has(domain));
  const historyRows = historyQuery.data ?? [];
  const testNameByCode = useMemo(
    () => new Map((testsQuery.data ?? []).map((test) => [test.code, test.name])),
    [testsQuery.data],
  );
  const latestHistory = historyRows[0];
  const historySummary = useMemo(() => {
    return historyRows.reduce(
      (acc, row) => {
        if (row.action === 'export') acc.exports += 1;
        else acc.imports += 1;
        acc.totalRows += row.total;
        acc.failedRows += row.failed;
        return acc;
      },
      { exports: 0, imports: 0, totalRows: 0, failedRows: 0 },
    );
  }, [historyRows]);
  const historyTotalPages = Math.max(1, Math.ceil(historyRows.length / historyPageSize));
  const safeHistoryPage = Math.min(historyPage, historyTotalPages);
  const historyPageRows = useMemo(() => {
    const start = (safeHistoryPage - 1) * historyPageSize;
    return historyRows.slice(start, start + historyPageSize);
  }, [historyPageSize, historyRows, safeHistoryPage]);
  const isApplicantsSelected = selected.has('Applicants');
  const roster = rosterQuery.data ?? [];
  const selectedPreset = useMemo(() => {
    const selectedKey = Array.from(selected).sort().join('|');
    return EXPORT_PRESETS.find((preset) => preset.domains.slice().sort().join('|') === selectedKey)?.value ?? null;
  }, [selected]);

  function applyPreset(preset: ExportPreset): void {
    const next = EXPORT_PRESETS.find((option) => option.value === preset);
    if (!next) return;
    setSelected(new Set(next.domains));
  }

  function setDomainGroup(domains: readonly ExchangeDomain[], shouldSelect: boolean): void {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const domain of domains) {
        if (shouldSelect) next.add(domain);
        else next.delete(domain);
      }
      return next;
    });
  }

  function toggleDomain(domain: ExchangeDomain): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  function resolveFilter(): ExportFilter {
    if (filterKind === 'changedAfter') {
      const iso = toIsoOrNull(changedAfter);
      return iso ? { changedAfter: iso } : 'all';
    }
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
    if (filterKind === 'changedAfter' && !toIsoOrNull(changedAfter)) {
      toast('حدّد تاريخًا صالحًا لفلتر «اعتبارًا من تاريخ مُحدَّد».', 'warning');
      return;
    }
    // Per-row admin selection (national-id allow-list) — Applicants only,
    // and only when the admin has narrowed the roster from its default
    // (all booked) state to a non-empty subset.
    const nationalIds =
      domains.includes('Applicants') &&
      selectedNationalIds.length > 0 &&
      selectedNationalIds.length < roster.length
        ? selectedNationalIds
        : undefined;
    if (domains.includes('Applicants') && roster.length > 0 && selectedNationalIds.length === 0) {
      toast('اختر متقدمًا واحدًا على الأقل لتصدير ورقة المتقدمين.', 'warning');
      return;
    }
    try {
      const result = await exportMutation.mutateAsync({ domains, layout, filter: resolveFilter(), nationalIds });
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
        entityLabel: 'استيراد وتصدير البيانات',
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
      setReconcileDecisions(new Map());
      if (unknownSheets.length > 0) {
        toast(`أوراق غير معروفة سيتم تجاهلها: ${unknownSheets.join('، ')}`, 'warning');
      }
      if (sheets.length === 0) {
        toast('لا توجد أوراق مطابقة لأسماء النظام في الملف.', 'danger');
        setPreview(null);
        setApplicantsPreview(null);
        return;
      }
      // Generic 6-class change-detection — runs for all sheets.
      const result = await previewMutation.mutateAsync(sheets);
      setPreview(result);
      // Applicants sheet additionally goes through the field-level diff
      // reconciliation preview so the admin can accept/reject corrections
      // and a per-round result + next-exam writeback per applicant.
      const applicantsSheet = sheets.find((s) => s.sheetName === SHEET_NAMES.Applicants);
      if (applicantsSheet) {
        const recon = await reconcilePreviewMutation.mutateAsync(applicantsSheet);
        setApplicantsPreview(recon);
      } else {
        setApplicantsPreview(null);
      }
    } catch {
      toast('تعذّرت قراءة الملف أو معاينته.', 'danger');
      setPreview(null);
      setApplicantsPreview(null);
    }
  }

  async function handleReconcileCommit(): Promise<void> {
    if (!applicantsPreview) return;
    const sheet = parsedSheets.find((s) => s.sheetName === SHEET_NAMES.Applicants);
    if (!sheet) return;
    const decisions = Array.from(reconcileDecisions.entries())
      .filter(([, d]) => d.acceptedFields.size > 0 || d.applyWriteback)
      .map(([nid, d]) => ({
        nationalId: nid,
        acceptedFields: Array.from(d.acceptedFields),
        applyWriteback: d.applyWriteback,
      }));
    if (decisions.length === 0) {
      toast('اختر تغييرًا واحدًا على الأقل للاعتماد.', 'warning');
      return;
    }
    try {
      const result = await reconcileCommitMutation.mutateAsync({ decisions, sheet });
      emitAudit({
        action: 'entity_imported',
        module: 'admin',
        entityType: 'data-exchange',
        entityLabel: 'اعتماد مراجعة المتقدمين',
        entityId: `reconcile-${Date.now()}`,
        details: `اعتماد · ${result.successCount} متقدم · ${result.fieldsWrittenCount} حقل · ${result.writebacksAppliedCount} نتيجة · ${result.failedCount} فشل`,
        after: result,
      });
      toast(
        `تم الاعتماد: ${result.successCount} متقدم · ${result.fieldsWrittenCount} حقل · ${result.writebacksAppliedCount} نتيجة.`,
        result.failedCount > 0 ? 'warning' : 'success',
      );
      // Re-preview against the now-updated store so the diff reflects reality.
      const refreshed = await reconcilePreviewMutation.mutateAsync(sheet);
      setApplicantsPreview(refreshed);
      setReconcileDecisions(new Map());
    } catch {
      toast('تعذّر اعتماد المراجعة.', 'danger');
    }
  }

  async function handleApply(args: { mode: ImportApplyMode; skipConflicts: boolean; forceUpdate: boolean }): Promise<void> {
    try {
      const result = await applyMutation.mutateAsync({ sheets: parsedSheets, ...args });
      emitAudit({
        action: 'entity_imported',
        module: 'admin',
        entityType: 'data-exchange',
        entityLabel: 'استيراد وتصدير البيانات',
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
        title="استيراد وتصدير البيانات"
        subtitle="تصدير واستيراد Excel مع معاينة ومراجعة قبل التطبيق."
        actions={<Badge tone="accent" icon={<ShieldCheck size={14} />}>مسار مُراقب</Badge>}
      />

      <Tabs value={activeTab} onValueChange={(next) => setActiveTab(next as ExchangeTab)} activationMode="manual">
        <Tabs.List
          aria-label="مهام استيراد وتصدير البيانات"
          className="grid gap-2 rounded-lg border border-border-default bg-surface-card p-2 shadow-xs sm:grid-cols-3"
        >
          <Tabs.Tab
            value="export"
            className="mb-0 justify-center rounded-md border border-transparent px-5 py-3 text-sm data-[state=active]:border-[var(--accent-500)] data-[state=active]:bg-[var(--accent-50)] data-[state=active]:shadow-xs"
            badge={selectedDomains.length}
          >
            <span className="inline-flex items-center gap-2">
              <Download size={16} /> تصدير
            </span>
          </Tabs.Tab>
          <Tabs.Tab
            value="import"
            className="mb-0 justify-center rounded-md border border-transparent px-5 py-3 text-sm data-[state=active]:border-[var(--accent-500)] data-[state=active]:bg-[var(--accent-50)] data-[state=active]:shadow-xs"
            badge={parsedSheets.length > 0 ? parsedSheets.length : undefined}
          >
            <span className="inline-flex items-center gap-2">
              <Upload size={16} /> استيراد
            </span>
          </Tabs.Tab>
          <Tabs.Tab
            value="history"
            className="mb-0 justify-center rounded-md border border-transparent px-5 py-3 text-sm data-[state=active]:border-[var(--accent-500)] data-[state=active]:bg-[var(--accent-50)] data-[state=active]:shadow-xs"
            badge={historyRows.length > 0 ? historyRows.length : undefined}
          >
            <span className="inline-flex items-center gap-2">
              <History size={16} /> السجل
            </span>
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="export" className="space-y-5">
          <SectionErrorBoundary title="تعذّر عرض قسم تصدير شروط التخصص">
            <ApplicationSettingsCycleExportCard />
          </SectionErrorBoundary>

          <SectionErrorBoundary title="تعذّر عرض قسم تصدير البيانات">
            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <Download size={18} /> تصدير البيانات
                  </span>
                }
                subtitle="اختر الحزمة ثم صدّر."
                actions={<Badge tone="neutral">{selectedDomains.length} نطاق</Badge>}
              />
              <CardBody className="space-y-5">
                <fieldset className="space-y-2">
                  <legend className="text-2xs font-semibold text-ink-700">حزمة التصدير</legend>
                  <div className="grid gap-2 lg:grid-cols-4">
                    {EXPORT_PRESETS.map((preset) => (
                      <ChoiceCard
                        key={preset.value}
                        name="dx-preset"
                        checked={selectedPreset === preset.value}
                        label={preset.label}
                        onChange={() => applyPreset(preset.value)}
                      />
                    ))}
                  </div>
                </fieldset>

                <details className="group rounded-lg border border-border-subtle bg-ink-50">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink-900 focus-visible:shadow-focus-teal focus-visible:outline-none">
                    <span className="inline-flex items-center gap-2">
                      <Settings2 size={16} />
                      تخصيص أوراق Excel
                    </span>
                    <ChevronDown size={16} className="transition-transform duration-fast ease-standard group-open:rotate-180" />
                  </summary>
                  <div className="space-y-4 border-t border-border-subtle bg-surface-card px-4 py-4">
                    {DOMAIN_GROUPS.map((group) => {
                      const groupSelected = group.domains.every((domain) => selected.has(domain));
                      return (
                        <section key={group.label} className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h3 className="text-sm font-semibold text-ink-900">{group.label}</h3>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDomainGroup(group.domains, !groupSelected)}
                            >
                              {groupSelected ? 'إلغاء المجموعة' : 'تحديد المجموعة'}
                            </Button>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {group.domains.map((domain) => (
                              <DomainCheckbox
                                key={domain}
                                domain={domain}
                                checked={selected.has(domain)}
                                onChange={() => toggleDomain(domain)}
                              />
                            ))}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </details>

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
                          onChange={() => setFilterKind(option.value)}
                        />
                      ))}
                    </div>
                    {filterKind === 'changedAfter' && (
                      <label className="mt-3 flex max-w-xs flex-col gap-1 text-2xs font-semibold text-ink-700">
                        التعديلات اعتبارًا من تاريخ
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

                {isApplicantsSelected && (
                  <div
                    role="note"
                    className="flex items-start gap-3 rounded-lg border border-gold-300 bg-gold-50 px-4 py-3 text-gold-700"
                  >
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <div className="space-y-1 text-xs leading-6">
                      <p className="font-semibold">
                        تصدير المتقدمين مقصور على من حجز موعد الاختبار الأول.
                      </p>
                    </div>
                  </div>
                )}

                {isApplicantsSelected && (
                  <SectionErrorBoundary title="تعذّر عرض قائمة المتقدمين المحجوزين">
                    <ApplicantRosterPanel
                      roster={roster}
                      loading={rosterQuery.isLoading}
                      selectedNationalIds={selectedNationalIds}
                      onSelectionChange={setSelectedNationalIds}
                    />
                  </SectionErrorBoundary>
                )}

                <div className="flex justify-end rounded-lg border border-border-subtle bg-ink-50 px-4 py-3">
                  <Button variant="primary" isLoading={exportMutation.isPending} onClick={() => void handleExport()}>
                    <FileSpreadsheet size={16} className="me-1" />
                    تصدير إلى Excel
                  </Button>
                </div>
              </CardBody>
            </Card>
          </SectionErrorBoundary>
        </Tabs.Panel>

        <Tabs.Panel value="import" className="space-y-5">
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Upload size={18} /> استيراد البيانات
                </span>
              }
              subtitle="ارفع الملف، راجع المعاينة، ثم طبّق."
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

          {preview && (
            <DataExchangePreview
              preview={preview}
              isSuperAdmin={isSuperAdmin}
              applying={applyMutation.isPending}
              onApply={(args) => void handleApply(args)}
            />
          )}

          {applicantsPreview && (
            <SectionErrorBoundary title="تعذّر عرض مراجعة بيانات المتقدمين">
              <ApplicantReconciliationTable
                preview={applicantsPreview}
                decisions={reconcileDecisions}
                testNameByCode={testNameByCode}
                onDecisionsChange={setReconcileDecisions}
                committing={reconcileCommitMutation.isPending}
                onCommit={() => void handleReconcileCommit()}
              />
            </SectionErrorBoundary>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="history" className="space-y-4">
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <History size={18} /> سجل الاستيراد والتصدير
                </span>
              }
              subtitle="آخر عمليات Excel."
              actions={latestHistory ? <Badge tone="neutral">آخر عملية: {latestHistory.actorName}</Badge> : undefined}
            />
            <CardBody className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <HistoryStat
                  icon={<Download size={17} />}
                  label="عمليات التصدير"
                  value={historySummary.exports}
                />
                <HistoryStat
                  icon={<Upload size={17} />}
                  label="عمليات الاستيراد"
                  value={historySummary.imports}
                />
                <HistoryStat
                  icon={<Database size={17} />}
                  label="إجمالي الصفوف"
                  value={historySummary.totalRows}
                />
                <HistoryStat
                  icon={<AlertTriangle size={17} />}
                  label="صفوف فشلت"
                  value={historySummary.failedRows}
                  tone={historySummary.failedRows > 0 ? 'warning' : 'neutral'}
                />
              </div>

              {latestHistory && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-ink-50 px-4 py-3">
                  <div className="space-y-1">
                    <p className="text-2xs font-semibold text-ink-500">آخر عملية مسجلة</p>
                    <p className="text-sm font-semibold text-ink-900">{latestHistory.details}</p>
                  </div>
                  <Badge tone={latestHistory.action === 'export' ? 'info' : 'success'}>
                    {latestHistory.action === 'export' ? 'تصدير' : 'استيراد'}
                  </Badge>
                </div>
              )}

              <DataTable<DataExchangeHistoryEntry>
                data={historyPageRows}
                columns={HISTORY_COLUMNS}
                rowKey={(r) => r.id}
                loading={historyQuery.isLoading}
                density="compact"
                sequenceStart={(safeHistoryPage - 1) * historyPageSize + 1}
                pagination={{
                  page: safeHistoryPage,
                  pageSize: historyPageSize,
                  total: historyRows.length,
                  pageSizeOptions: [10, 25, 50],
                  onPageChange: setHistoryPage,
                  onPageSizeChange: (nextSize) => {
                    setHistoryPageSize(nextSize);
                    setHistoryPage(1);
                  },
                }}
              />
            </CardBody>
          </Card>
        </Tabs.Panel>
      </Tabs>
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

function DomainCheckbox({
  domain,
  checked,
  onChange,
}: {
  domain: ExchangeDomain;
  checked: boolean;
  onChange: () => void;
}): JSX.Element {
  return (
    <label
      className={[
        'group relative flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-sm transition-colors duration-fast ease-standard',
        'focus-within:shadow-focus-teal',
        checked
          ? 'border-[var(--accent-500)] bg-[var(--accent-50)] text-ink-900'
          : 'border-border-subtle bg-surface-card text-ink-600 hover:border-border-default hover:bg-ink-50',
      ].join(' ')}
    >
      <input
        type="checkbox"
        className="absolute inset-0 cursor-pointer opacity-0"
        checked={checked}
        onChange={onChange}
      />
      <span
        aria-hidden
        className={[
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
          checked
            ? 'border-[var(--accent-500)] bg-[var(--accent-500)] text-white'
            : 'border-border-default bg-surface-card text-transparent group-hover:border-[var(--accent-500)]',
        ].join(' ')}
      >
        <Check size={13} strokeWidth={2.25} />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 font-semibold">
          {DOMAIN_TITLES_AR[domain]}
          {domain === 'Applicants' && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-gold-300 bg-gold-50 px-1.5 py-0.5 text-[10px] font-semibold text-gold-700"
              title="يقتصر التصدير على المتقدمين الذين حجزوا موعد الاختبار الأول"
            >
              <Users size={10} />
              محجوز فقط
            </span>
          )}
        </span>
        <span dir="ltr" className="mt-1 block truncate font-mono text-[10px] text-ink-400">
          {SHEET_NAMES[domain]}
        </span>
      </span>
    </label>
  );
}

function HistoryStat({
  icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: JSX.Element;
  label: string;
  value: number;
  tone?: 'neutral' | 'warning';
}): JSX.Element {
  return (
    <div
      className={[
        'rounded-lg border px-3 py-3',
        tone === 'warning'
          ? 'border-gold-300 bg-gold-50 text-gold-700'
          : 'border-border-subtle bg-ink-50 text-ink-700',
      ].join(' ')}
    >
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <span className="text-2xs font-semibold">{label}</span>
      </div>
      <p dir="ltr" className="font-numeric text-lg font-semibold text-ink-900 tnum">
        {value.toLocaleString('en-US')}
      </p>
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
  description?: string;
  onChange: () => void;
}): JSX.Element {
  return (
    <label
      className={[
        'group relative flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition-colors duration-fast ease-standard',
        'focus-within:shadow-focus-teal',
        checked
          ? 'border-[var(--accent-500)] bg-[var(--accent-50)] text-ink-900'
          : 'border-border-subtle bg-surface-card text-ink-600 hover:border-border-default hover:bg-ink-50',
      ].join(' ')}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
      <span
        aria-hidden
        className={[
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
          checked
            ? 'border-[var(--accent-500)] bg-[var(--accent-500)] text-white'
            : 'border-border-default bg-surface-card text-transparent group-hover:border-[var(--accent-500)]',
        ].join(' ')}
      >
        <Check size={13} strokeWidth={2.5} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink-900">{label}</span>
        {description ? <span className="mt-1 block text-xs leading-5 text-ink-500">{description}</span> : null}
      </span>
    </label>
  );
}
