import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, FileText, History, UploadCloud } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  PageHeader,
  StatCard,
  type DataTableColumn,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { date as fmtDate, num } from '@/shared/lib/format';
import { downloadBlob } from '@/shared/lib/download';
import {
  getApplicantGradesImportHistoryRecord,
  listApplicantGradesImportHistory,
  type ApplicantGradesImportHistoryRecord,
} from '../lib/importHistory';

export function ApplicantGradesImportHistoryPage(): JSX.Element {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const selectedId = params.get('record');
  const records = useMemo(() => listApplicantGradesImportHistory(), []);
  const selected = selectedId ? getApplicantGradesImportHistoryRecord(selectedId) : records[0] ?? null;

  const downloadAudit = (record: ApplicantGradesImportHistoryRecord): void => {
    downloadBlob(
      new Blob([record.auditCsv], { type: 'text/csv;charset=utf-8' }),
      `applicant-grades-audit-${record.id}.csv`,
    );
  };

  const columns: DataTableColumn<ApplicantGradesImportHistoryRecord>[] = [
    {
      key: 'createdAt',
      label: 'وقت الاستيراد',
      render: (record) => <span className="font-numeric tnum">{fmtDate(record.createdAt, 'short')}</span>,
    },
    {
      key: 'file',
      label: 'الملف',
      render: (record) => record.fileName ?? '—',
    },
    {
      key: 'rows',
      label: 'الإجمالي',
      numeric: true,
      render: (record) => num(record.totalRows),
    },
    {
      key: 'imported',
      label: 'مستورد',
      numeric: true,
      render: (record) => num(record.importedCount),
    },
    {
      key: 'skipped',
      label: 'متجاوز',
      numeric: true,
      render: (record) => num(record.skippedDuplicateCount + record.skippedInvalidCount + record.skippedExistingCount),
    },
    {
      key: 'ratio',
      label: 'نسبة التكرار',
      render: (record) => (
        <Badge tone={record.duplicateRatio > 0.01 ? 'danger' : record.duplicateRatio > 0 ? 'warning' : 'success'}>
          {(record.duplicateRatio * 100).toFixed(record.duplicateRatio < 0.1 ? 2 : 1)}٪
        </Badge>
      ),
    },
    {
      key: '_actions',
      label: <span className="sr-only">إجراءات</span>,
      align: 'end',
      render: (record) => (
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<Download size={12} strokeWidth={1.75} aria-hidden />}
          onClick={(event) => {
            event.stopPropagation();
            downloadAudit(record);
          }}
        >
          التقرير
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="سجل استيراد الدرجات"
        subtitle="ملخص كل عملية استيراد مع تقرير المراجعة الكامل القابل للتحميل"
        breadcrumbs={[
          { label: 'لوحة القبول', href: ROUTES.admin.dashboard },
          { label: 'درجات المتقدمين', href: ROUTES.admin.applicantGrades },
          { label: 'سجل الاستيراد' },
        ]}
        actions={
          <Button
            variant="primary"
            leadingIcon={<UploadCloud size={14} strokeWidth={1.75} aria-hidden />}
            onClick={() => navigate(ROUTES.admin.applicantGradesImport)}
          >
            استيراد جديد
          </Button>
        }
      />

      {selected && (
        <div className="mb-5 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <StatCard label="إجمالي الصفوف" value={selected.totalRows} icon={<FileText size={16} strokeWidth={1.75} />} />
          <StatCard label="مستورد" value={selected.importedCount} icon={<UploadCloud size={16} strokeWidth={1.75} />} iconBg="var(--success-bg)" iconColor="var(--success)" />
          <StatCard label="مكرر متجاوز" value={selected.skippedDuplicateCount} icon={<History size={16} strokeWidth={1.75} />} iconBg="var(--gold-50)" iconColor="var(--gold-700)" />
          <StatCard label="غير صالح" value={selected.skippedInvalidCount} icon={<FileText size={16} strokeWidth={1.75} />} iconBg="var(--terra-50)" iconColor="var(--terra-700)" />
        </div>
      )}

      <Card>
        <CardHeader
          title="عمليات الاستيراد"
          subtitle={`${num(records.length)} عملية محفوظة على هذا الجهاز`}
          actions={
            selected ? (
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<Download size={12} strokeWidth={1.75} aria-hidden />}
                onClick={() => downloadAudit(selected)}
              >
                تحميل التقرير الحالي
              </Button>
            ) : null
          }
        />
        <DataTable
          data={records}
          columns={columns}
          rowKey={(record) => record.id}
          onRowClick={(record) => navigate(`${ROUTES.admin.applicantGradesImportHistory}?record=${encodeURIComponent(record.id)}`)}
          empty={
            <EmptyState
              variant="generic"
              title="لا توجد عمليات استيراد محفوظة"
              description="بعد أول استيراد ناجح، سيظهر تقرير المراجعة هنا للتحميل."
              action={
                <Button variant="primary" onClick={() => navigate(ROUTES.admin.applicantGradesImport)}>
                  استيراد جديد
                </Button>
              }
            />
          }
          zebraStripes
          density="compact"
        />
      </Card>
    </div>
  );
}
