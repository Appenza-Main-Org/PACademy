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
  summarizeIntegrityDecisions,
} from '../../../lib/duplicateAudit';
import type {
  ImportFailureRow,
  ImportGroupCode,
  ImportReportGroup,
} from '../../../types';

const GROUP_TONE: Record<ImportGroupCode, 'warning' | 'danger' | 'info'> = {
  DUPLICATE_NID: 'warning',
  INVALID_NID: 'danger',
  MISSING_REQUIRED: 'danger',
  NID_NOT_FOUND: 'info',
  GRADE_OUT_OF_RANGE: 'warning',
  UNREADABLE_VALUE: 'danger',
};

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
      }),
    [normalised, selectedSchoolCategories, maxGradeByCategory],
  );
  const alreadyImported = useMemo(
    () => buildAlreadyImported(normalised, allRows ?? []),
    [normalised, allRows],
  );

  const integrityGroups = useMemo<ImportReportGroup[]>(() => {
    const labels: Record<ImportGroupCode, string> = {
      DUPLICATE_NID: 'مطابقات سابقة بالرقم القومي',
      INVALID_NID: 'أرقام قومية غير صالحة',
      MISSING_REQUIRED: 'حقول مطلوبة ناقصة',
      NID_NOT_FOUND: 'رقم قومي غير موجود',
      GRADE_OUT_OF_RANGE: 'درجات تتجاوز الدرجة العظمى',
      UNREADABLE_VALUE: 'قيم غير قابلة للقراءة',
    };
    const grouped = new Map<ImportGroupCode, ImportFailureRow[]>();
    for (const row of integrityRows) {
      const bucket = grouped.get(row.code) ?? [];
      bucket.push({
        nationalId: row.nationalId,
        seatingNumber: null,
        nameAr: row.nameAr,
        totalGrade: row.totalGrade,
        sourceRowIndex: row.sourceRowIndex,
        detail: row.detail,
      });
      grouped.set(row.code, bucket);
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
    for (const group of importResult?.groups ?? []) byCode.set(group.code, group);
    for (const group of integrityGroups) byCode.set(group.code, group);
    return Array.from(byCode.values());
  }, [importResult?.groups, integrityGroups]);
  const skippedExistingCount = alreadyImported.length;
  const decisionSummary = summarizeIntegrityDecisions(
    integrityRows,
    outOfRangeDecisions,
  );
  const rejectedCount = Math.max(
    importResult?.totals.failed ?? 0,
    decisionSummary.rejectedSourceRows.size,
  );
  const pendingDecisionCount = decisionSummary.pendingOutOfRangeCount;
  const skippedCount = (importResult?.totals.skipped ?? 0) + skippedExistingCount;
  const importableCount = Math.max(
    0,
    (importResult?.totals.received ?? normalised.length) -
      skippedCount -
      rejectedCount -
      pendingDecisionCount,
  );

  function handleDownloadAudit(): void {
    const csv = buildAuditCsv({
      audit,
      report: importResult,
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

  if (!importResult) {
    return (
      <div className="rounded-md border border-border-subtle bg-white p-6 text-center text-sm text-ink-500">
        تشغيل المراجعة في الخطوة السابقة لعرض النتيجة.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 overflow-hidden rounded-md border border-border-subtle md:grid-cols-5">
        <SummaryBlock label="مستلمة" value={importResult.totals.received} />
        <SummaryBlock label="مستوردة" value={importableCount} tone="success" big />
        <SummaryBlock label="ملغاة" value={skippedCount} />
        <SummaryBlock label="تحتاج قرار" value={pendingDecisionCount} tone="warning" />
        <SummaryBlock label="مرفوضة" value={rejectedCount} tone="warning" />
      </div>

      {pendingDecisionCount > 0 && (
        <div className="rounded-md border border-gold-300 bg-gold-50 px-3.5 py-2.5 text-xs text-gold-700">
          توجد{' '}
          <span className="font-en font-bold text-ink-900">
            {pendingDecisionCount.toLocaleString('en')}
          </span>{' '}
          صفًا تتجاوز الدرجة العظمى. اختر «قبول» لتضمينها أو «رفض / تجاهل» لاستبعادها قبل تأكيد
          الاستيراد.
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
      </div>

      {groups.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-success bg-success-bg px-3.5 py-3 text-xs text-success">
          <ShieldCheck size={14} aria-hidden />
          {skippedExistingCount > 0
            ? `سيتم استيراد ${importableCount.toLocaleString('en')} صفًا، وتجاهل ${skippedExistingCount.toLocaleString('en')} صفًا موجودًا مسبقًا بنفس الرقم القومي وسنة التخرج.`
            : 'كل الصفوف نظيفة. اضغط «تأكيد الاستيراد» للكتابة على قاعدة البيانات.'}
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
        <span className="text-2xs text-ink-500">
          القرارات تتم من شاشة «مراجعة التغييرات» السابقة.
        </span>
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
