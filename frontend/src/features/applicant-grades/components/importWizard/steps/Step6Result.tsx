/**
 * Step 6 — النتيجة.
 *
 * Renders the read-only preflight report as a stack of Radix
 * `Accordion` cards — one per non-empty failure group. Each card has:
 *   • header with count + Arabic label + colored badge
 *   • DataTable<ImportFailureRow> of the offending rows
 *   • export action only; all accept/reject decisions happen on Step 6
 *     (`Step6ChangesReview`) before the admin can reach this step
 *
 * The "تأكيد الاستيراد" button at the bottom triggers the v2 commit
 * mutation; success bounces back to the list page with a success toast.
 * Carry counts in the toast message per the prompt.
 */

import { useMemo } from 'react';
import { Download, ShieldCheck } from 'lucide-react';
import {
  Accordion,
  Badge,
  Button,
  DataTable,
  type DataTableColumn,
} from '@/shared/components';
import { serializeCsv } from '@/shared/lib/csv';
import { downloadBlob } from '@/shared/lib/download';
import { useImportWizardStore } from '../../../store/importWizard.store';
import { useGrades } from '../../../api/grades.queries';
import { normaliseRows } from '../../../lib/normalise';
import { buildAlreadyImported } from '../../../lib/buildDiff';
import {
  buildAuditCsv,
  buildDuplicateAudit,
  buildIntegrityAuditRows,
  isInformationalAuditCode,
  summarizeIntegrityDecisions,
} from '../../../lib/duplicateAudit';
import { useImportValidationRules } from '../../../lib/useImportValidationRules';
import { normalizeImportReport } from '../../../lib/importReport';
import type {
  ImportFailureRow,
  ImportGroupCode,
  ImportReportGroup,
} from '../../../types';

const GROUP_TONE: Record<ImportGroupCode, 'warning' | 'danger' | 'info'> = {
  DUPLICATE_NID: 'warning',
  INVALID_NID: 'danger',
  GENDER_MISMATCH: 'danger',
  AGE_OUT_OF_RANGE: 'danger',
  MISSING_REQUIRED: 'danger',
  NID_NOT_FOUND: 'info',
  GRADE_OUT_OF_RANGE: 'warning',
  UNREADABLE_VALUE: 'danger',
};

interface RejectedExportRow {
  code: ImportGroupCode;
  labelAr: string;
  row: ImportFailureRow;
}

export function Step6Result(): JSX.Element {
  const importResult = useImportWizardStore((s) => s.importResult);
  const outOfRangeDecisions = useImportWizardStore((s) => s.outOfRangeDecisions);
  const parsed = useImportWizardStore((s) => s.parsed);
  const selectedTableName = useImportWizardStore((s) => s.selectedTableName);
  const mapping = useImportWizardStore((s) => s.mapping);
  const filters = useImportWizardStore((s) => s.filters);
  const lookupValueMappings = useImportWizardStore((s) => s.lookupValueMappings);
  const graduationYear = useImportWizardStore((s) => s.graduationYear);
  const selectedSchoolCategories = useImportWizardStore(
    (s) => s.selectedSchoolCategories,
  );
  const maxGradeByCategory = useImportWizardStore((s) => s.maxGradeByCategory);
  const fileMeta = useImportWizardStore((s) => s.fileMeta);
  const { data: allRows } = useGrades();
  const validationRules = useImportValidationRules();
  const normalizedImportResult = useMemo(
    () => (importResult ? normalizeImportReport(importResult) : null),
    [importResult],
  );

  const normalised = useMemo(() => {
    const table = parsed?.tables.find((t) => t.name === selectedTableName) ?? null;
    if (!table || graduationYear == null) return [];
    return normaliseRows(
      table,
      mapping,
      filters,
      graduationYear,
      lookupValueMappings,
      selectedSchoolCategories,
    );
  }, [
    parsed,
    selectedTableName,
    mapping,
    filters,
    graduationYear,
    lookupValueMappings,
    selectedSchoolCategories,
  ]);
  const audit = useMemo(() => buildDuplicateAudit(normalised), [normalised]);
  const integrityRows = useMemo(
    () =>
      buildIntegrityAuditRows({
        rows: normalised,
        selectedSchoolCategories,
        maxGradeByCategory,
        validationRules,
      }),
    [normalised, selectedSchoolCategories, maxGradeByCategory, validationRules],
  );
  const alreadyImported = useMemo(
    () => buildAlreadyImported(normalised, allRows ?? []),
    [normalised, allRows],
  );

  const integrityGroups = useMemo<ImportReportGroup[]>(() => {
    const labels: Record<ImportGroupCode, string> = {
      DUPLICATE_NID: 'مطابقات سابقة بالرقم القومي',
      INVALID_NID: 'أرقام قومية غير صالحة',
      GENDER_MISMATCH: 'نوع لا يطابق الرقم القومي',
      AGE_OUT_OF_RANGE: 'سن خارج الإعدادات',
      MISSING_REQUIRED: 'حقول مطلوبة ناقصة',
      NID_NOT_FOUND: 'رقم قومي غير موجود',
      GRADE_OUT_OF_RANGE: 'درجات تتجاوز الدرجة العظمى',
      UNREADABLE_VALUE: 'قيم غير قابلة للقراءة',
    };
    const grouped = new Map<ImportGroupCode, ImportFailureRow[]>();
    for (const row of integrityRows) {
      /* Informational-only audit codes (intra-file + system-wide NID
       * duplicates) are surfaced inline on the review step and don't
       * map to an `ImportGroupCode` — skip them here so the commit
       * summary stays scoped to the actual preflight rejection groups. */
      if (isInformationalAuditCode(row.code)) continue;
      const code = row.code as ImportGroupCode;
      const bucket = grouped.get(code) ?? [];
      bucket.push({
        nationalId: row.nationalId,
        seatingNumber: null,
        nameAr: row.nameAr,
        totalGrade: row.totalGrade,
        sourceRowIndex: row.sourceRowIndex,
        detail: row.detail,
      });
      grouped.set(code, bucket);
    }
    return Array.from(grouped.entries()).map(([code, rows]) => ({
      code,
      labelAr: labels[code],
      rows,
      availableActions:
        code === 'GRADE_OUT_OF_RANGE'
          ? (['skip', 'override', 'export'] as const)
          : (['skip', 'export'] as const),
    }));
  }, [integrityRows]);

  const groups = useMemo<ImportReportGroup[]>(() => {
    const byCode = new Map<ImportGroupCode, ImportReportGroup>();
    const appendGroup = (group: ImportReportGroup): void => {
      const existing = byCode.get(group.code);
      if (!existing) {
        byCode.set(group.code, { ...group, rows: [...group.rows] });
        return;
      }
      const seenRows = new Set(existing.rows.map((row) => row.sourceRowIndex));
      const rows = [...existing.rows];
      for (const row of group.rows) {
        if (seenRows.has(row.sourceRowIndex)) continue;
        rows.push(row);
      }
      byCode.set(group.code, {
        ...existing,
        rows,
        availableActions: Array.from(
          new Set([...existing.availableActions, ...group.availableActions]),
        ),
      });
    };
    for (const group of normalizedImportResult?.groups ?? []) appendGroup(group);
    for (const group of integrityGroups) appendGroup(group);
    return Array.from(byCode.values());
  }, [normalizedImportResult?.groups, integrityGroups]);
  const skippedExistingCount = alreadyImported.length;
  const decisionSummary = summarizeIntegrityDecisions(
    integrityRows,
    outOfRangeDecisions,
  );
  const rejectedCount = Math.max(
    normalizedImportResult?.totals.failed ?? 0,
    decisionSummary.rejectedSourceRows.size,
  );
  const pendingDecisionCount = decisionSummary.pendingOutOfRangeCount;
  const skippedCount = (normalizedImportResult?.totals.skipped ?? 0) + skippedExistingCount;
  const importableCount = Math.max(
    0,
    (normalizedImportResult?.totals.received ?? normalised.length) -
      skippedCount -
      rejectedCount -
      pendingDecisionCount,
  );
  const rejectedRowsForExport = useMemo<RejectedExportRow[]>(() => {
    const out: RejectedExportRow[] = [];
    const seen = new Set<string>();
    const push = (code: ImportGroupCode, labelAr: string, row: ImportFailureRow): void => {
      const key = `${code}:${row.sourceRowIndex}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ code, labelAr, row });
    };

    for (const group of groups) {
      if (group.code === 'DUPLICATE_NID') continue;
      for (const row of group.rows) {
        if (
          group.code === 'GRADE_OUT_OF_RANGE' &&
          outOfRangeDecisions[row.sourceRowIndex] !== 'reject'
        ) {
          continue;
        }
        push(group.code, group.labelAr, row);
      }
    }
    return out.sort((a, b) => a.row.sourceRowIndex - b.row.sourceRowIndex);
  }, [groups, outOfRangeDecisions]);

  function handleDownloadAudit(): void {
    const csv = buildAuditCsv({
      audit,
      report: normalizedImportResult,
      rows: normalised,
      integrityRows,
      graduationYear,
      fileName: fileMeta?.name ?? null,
    });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadBlob(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      `applicant-grades-audit-${stamp}.csv`,
    );
  }

  async function handleExportRejectedExcel(): Promise<void> {
    const XLSX = await import('xlsx');
    const rows = rejectedRowsForExport.map(({ code, labelAr, row }) => ({
      'كود الرفض': code,
      'سبب الرفض': labelAr,
      'صف المصدر': row.sourceRowIndex,
      'الرقم القومي': row.nationalId ?? '',
      'رقم الجلوس': row.seatingNumber ?? '',
      'الاسم': row.nameAr ?? '',
      'المجموع': row.totalGrade ?? '',
      'الملاحظة': row.detail ?? '',
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet['!cols'] = [
      { wch: 22 },
      { wch: 26 },
      { wch: 12 },
      { wch: 18 },
      { wch: 14 },
      { wch: 34 },
      { wch: 12 },
      { wch: 60 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'الصفوف المرفوضة');
    const bin = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    downloadBlob(
      new Blob([bin], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      `applicant-grades-rejected-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  if (!normalizedImportResult) {
    return (
      <div className="rounded-md border border-border-subtle bg-white p-6 text-center text-sm text-ink-500">
        تشغيل المراجعة في الخطوة السابقة لعرض النتيجة.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 overflow-hidden rounded-md border border-border-subtle md:grid-cols-5">
        <SummaryBlock label="مستلمة" value={normalizedImportResult.totals.received} />
        <SummaryBlock label="مستوردة" value={importableCount} tone="success" big />
        <SummaryBlock label="ملغاة" value={skippedCount} />
        <SummaryBlock label="تحتاج قرار" value={pendingDecisionCount} tone="warning" />
        <SummaryBlock label="مرفوضة" value={rejectedCount} tone="warning" />
      </div>

      {pendingDecisionCount > 0 && (
        <div className="rounded-md border border-gold-300 bg-gold-50 px-3.5 py-2.5 text-xs text-gold-700">
          <span className="font-en font-bold text-ink-900">
            {pendingDecisionCount.toLocaleString('en')}
          </span>{' '}
          صف يحتاج قرارًا قبل الحفظ.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-subtle bg-white px-3.5 py-2.5">
        <div className="flex flex-wrap items-center gap-3 text-2xs text-ink-600">
          <span>
            <span className="font-en font-bold text-ink-900">
              {audit.uniqueNidCount.toLocaleString('en')}
            </span>{' '}
            رقم قومي فريد
          </span>
          <span>·</span>
          <span>
            <span className="font-en font-bold text-ink-900">
              {audit.duplicateRowCount.toLocaleString('en')}
            </span>{' '}
            صف مكرر داخل الملف سيُتجاوز
          </span>
          {skippedExistingCount > 0 && (
            <>
              <span>·</span>
              <span className="text-gold-700">
                <span className="font-en font-bold text-ink-900">
                  {skippedExistingCount.toLocaleString('en')}
                </span>{' '}
                صف موجود مسبقًا لن يُستورد
              </span>
            </>
          )}
        </div>
        <Button
          size="sm"
          variant="secondary"
          leadingIcon={<Download size={12} strokeWidth={1.75} aria-hidden />}
          onClick={handleDownloadAudit}
        >
          تحميل تقرير المراجعة
        </Button>
        {rejectedRowsForExport.length > 0 && (
          <Button
            size="sm"
            variant="secondary"
            leadingIcon={<Download size={12} strokeWidth={1.75} aria-hidden />}
            onClick={() => {
              void handleExportRejectedExcel();
            }}
          >
            تصدير المرفوضة Excel
          </Button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-success bg-success-bg px-3.5 py-3 text-xs text-success">
          <ShieldCheck size={14} aria-hidden />
          {skippedExistingCount > 0
            ? `${importableCount.toLocaleString('en')} صف جاهز، ${skippedExistingCount.toLocaleString('en')} موجود مسبقًا.`
            : 'جاهز للحفظ.'}
        </div>
      ) : (
        <Accordion type="multiple">
          {groups.map((g) => (
            <Accordion.Item key={g.code} value={g.code}>
              <Accordion.Trigger>
                <span className="flex items-center gap-2">
                  <Badge tone={GROUP_TONE[g.code]}>
                    <span className="font-en">{g.rows.length.toLocaleString('en')}</span> صف
                  </Badge>
                  <span className="text-sm font-semibold text-ink-900">{g.labelAr}</span>
                  <code className="font-mono text-2xs text-ink-500">{g.code}</code>
                </span>
              </Accordion.Trigger>
              <Accordion.Content>
                <GroupBody group={g} />
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion>
      )}
    </div>
  );
}

interface GroupBodyProps {
  group: ImportReportGroup;
}

function GroupBody({ group }: GroupBodyProps): JSX.Element {
  const columns: DataTableColumn<ImportFailureRow>[] = [
    {
      key: 'sourceRowIndex',
      label: 'الصف',
      align: 'center',
      className: 'min-w-[6ch] font-numeric tabular-nums',
      render: (r) => <span className="font-en text-2xs text-ink-500">#{r.sourceRowIndex}</span>,
    },
    {
      key: 'nationalId',
      label: 'الرقم القومي',
      className: 'min-w-[14ch]',
      render: (r) =>
        r.nationalId ? (
          <span className="font-mono text-2xs text-ink-600" dir="ltr">
            {r.nationalId}
          </span>
        ) : (
          <span className="text-2xs text-ink-300">—</span>
        ),
    },
    {
      key: 'nameAr',
      label: 'الاسم',
      className: 'min-w-[18ch] whitespace-normal',
      render: (r) =>
        r.nameAr ? (
          <span className="text-xs text-ink-900">{r.nameAr}</span>
        ) : (
          <span className="text-2xs text-ink-300">—</span>
        ),
    },
    {
      key: 'totalGrade',
      label: 'المجموع',
      align: 'center',
      className: 'min-w-[8ch] font-numeric tabular-nums',
      render: (r) =>
        r.totalGrade != null ? (
          <span className="font-en text-xs">{r.totalGrade}</span>
        ) : (
          <span className="text-2xs text-ink-300">—</span>
        ),
    },
    {
      key: 'detail',
      label: 'الملاحظة',
      className: 'min-w-[18ch] whitespace-normal',
      render: (r) => <span className="text-xs text-ink-600">{r.detail ?? '—'}</span>,
    },
  ];

  function handleExport(): void {
    const headers = ['الصف', 'الرقم القومي', 'الاسم', 'المجموع', 'الملاحظة'];
    const rows = group.rows.map((r) => [
      r.sourceRowIndex,
      r.nationalId ?? '',
      r.nameAr ?? '',
      r.totalGrade ?? '',
      r.detail ?? '',
    ]);
    const csv = serializeCsv(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, `applicant-grades-${group.code.toLowerCase()}.csv`);
  }

  return (
    <div className="flex flex-col gap-2.5 pt-1">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          leadingIcon={<Download size={12} strokeWidth={1.75} aria-hidden />}
          onClick={handleExport}
        >
          تصدير CSV
        </Button>
      </div>
      <DataTable<ImportFailureRow>
        data={group.rows}
        columns={columns}
        rowKey={(r) => r.sourceRowIndex}
        density="compact"
        stickyHeader
      />
    </div>
  );
}

function SummaryBlock({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: number;
  tone?: 'success' | 'warning';
  big?: boolean;
}): JSX.Element {
  const cls =
    tone === 'success'
      ? 'bg-success-bg text-success'
      : tone === 'warning'
        ? 'bg-gold-50 text-gold-700'
        : 'bg-white text-ink-700';
  return (
    <div
      className={`flex flex-col gap-0.5 border-s border-border-subtle px-4 py-3 first:border-s-0 ${cls}`}
    >
      <span className={`font-en font-bold leading-tight ${big ? 'text-2xl' : 'text-xl'}`}>
        {value.toLocaleString('en')}
      </span>
      <span className="text-2xs opacity-85">{label}</span>
    </div>
  );
}
