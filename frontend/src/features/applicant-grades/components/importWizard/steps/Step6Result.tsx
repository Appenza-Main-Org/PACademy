/**
 * Step 6 — النتيجة.
 *
 * Renders the preflight report as a stack of Radix `Accordion` cards —
 * one per non-empty failure group. Each card has:
 *   • header with count + Arabic label + colored badge
 *   • DataTable<ImportFailureRow> of the offending rows
 *   • per-group action toolbar (skip / override / export / create-applicant)
 *
 * The "تأكيد الاستيراد" button at the bottom triggers the v2 commit
 * mutation; success bounces back to the list page with a success toast.
 * Carry counts in the toast message per the prompt.
 */

import { useMemo } from 'react';
import { Download, FileText, ShieldCheck, SkipForward, UserPlus } from 'lucide-react';
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
import { normaliseRows } from '../../../lib/normalise';
import { buildAuditCsv, buildDuplicateAudit, buildIntegrityAuditRows } from '../../../lib/duplicateAudit';
import type {
  ImportFailureRow,
  ImportGroupAction,
  ImportGroupCode,
  ImportReportGroup,
} from '../../../types';

const ACTION_LABELS: Record<ImportGroupAction, string> = {
  skip: 'تجاهل',
  override: 'استبدال',
  export: 'تصدير',
  'create-applicant': 'إنشاء متقدم',
};

const ACTION_ICONS: Record<ImportGroupAction, JSX.Element> = {
  skip: <SkipForward size={12} strokeWidth={1.75} />,
  override: <ShieldCheck size={12} strokeWidth={1.75} />,
  export: <Download size={12} strokeWidth={1.75} />,
  'create-applicant': <UserPlus size={12} strokeWidth={1.75} />,
};

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
  const perGroupActions = useImportWizardStore((s) => s.perGroupActions);
  const setPerGroupAction = useImportWizardStore((s) => s.setPerGroupAction);
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

  if (!importResult) {
    return (
      <div className="rounded-md border border-border-subtle bg-white p-6 text-center text-sm text-ink-500">
        تشغيل المراجعة في الخطوة السابقة لعرض النتيجة.
      </div>
    );
  }

  const groups = importResult.groups;

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

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 overflow-hidden rounded-md border border-border-subtle">
        <SummaryBlock label="مستلمة" value={importResult.totals.received} />
        <SummaryBlock label="مستوردة" value={importResult.totals.imported} tone="success" big />
        <SummaryBlock label="ملغاة" value={importResult.totals.skipped} />
        <SummaryBlock label="مرفوضة" value={importResult.totals.failed} tone="warning" />
      </div>

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
          كل الصفوف نظيفة. اضغط «تأكيد الاستيراد» للكتابة على قاعدة البيانات.
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
                <GroupBody
                  group={g}
                  action={perGroupActions[g.code]}
                  onAction={(a) => setPerGroupAction(g.code, a)}
                />
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
  action: 'skip' | 'override' | 'create-applicant' | undefined;
  onAction: (a: 'skip' | 'override' | 'create-applicant') => void;
}

function GroupBody({ group, action, onAction }: GroupBodyProps): JSX.Element {
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
        {group.availableActions.map((a) => {
          const active = a === action || (a === 'export' && action === undefined);
          if (a === 'export') {
            return (
              <Button
                key={a}
                size="sm"
                variant="secondary"
                leadingIcon={ACTION_ICONS[a]}
                onClick={handleExport}
              >
                تصدير CSV
              </Button>
            );
          }
          return (
            <Button
              key={a}
              size="sm"
              variant={active ? 'primary' : 'secondary'}
              leadingIcon={ACTION_ICONS[a]}
              onClick={() => onAction(a as 'skip' | 'override' | 'create-applicant')}
            >
              {ACTION_LABELS[a]}
            </Button>
          );
        })}
        {action && (
          <span className="text-2xs text-teal-700">
            <FileText size={11} className="me-1 inline-block" aria-hidden />
            التصرف المختار: <strong>{ACTION_LABELS[action]}</strong>
          </span>
        )}
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
