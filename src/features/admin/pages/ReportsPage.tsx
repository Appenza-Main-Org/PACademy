/**
 * ReportsPage — 9 templated reports with PDF (print) / CSV / RTF exports.
 * Source: Tasks/KARASA_GAPS.md §1.2.F.
 *
 * Heavy xlsx/docx libs deferred to Sprint 10 hardening; until then we ship:
 *  - PDF via PrintLayout + window.print()
 *  - Excel via UTF-8 BOM CSV (Excel opens directly with Arabic intact)
 *  - Word via RTF (Word opens RTF cleanly)
 */

import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  ErrorState,
  LoadingState,
  PageHeader,
  PrintLayout,
  Select,
  toast,
} from '@/shared/components';
import { BarChart, DonutChart, LineChart } from '@/shared/components/charts';
import type { DataTableColumn } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { downloadBlob } from '@/shared/lib/download';
import { date as fmtDate, num } from '@/shared/lib/format';
import { useApplicantDistribution } from '@/features/applicants/api/applicant.queries';
import { MOCK } from '@/shared/mock-data';
import { useCycles } from '../api/cycles.queries';
import {
  useExportCsv,
  useExportPdf,
  useExportRtf,
  useReportDocument,
} from '../api/reports.queries';
import { REPORT_TEMPLATE_LABELS } from '../api/reports.service';
import type { ReportRow, ReportTemplateKey } from '@/shared/types/domain';

const TEMPLATE_KEYS = Object.keys(REPORT_TEMPLATE_LABELS) as ReportTemplateKey[];

export function ReportsPage(): JSX.Element {
  const [template, setTemplate] = useState<ReportTemplateKey>('cycle-summary');
  const [cycleId, setCycleId] = useState<string | null>(null);

  const { data: cycles } = useCycles();
  const { data: doc, isLoading, error, refetch } = useReportDocument(template, cycleId);
  const csvMut = useExportCsv();
  const rtfMut = useExportRtf();
  const pdfMut = useExportPdf();

  const { data: govDist } = useApplicantDistribution('governorate');
  const { data: certDist } = useApplicantDistribution('certType');
  const { data: statusDist } = useApplicantDistribution('status');

  const columns: DataTableColumn<ReportRow>[] = [
    { key: 'label', label: 'البند', render: (r) => r.label },
    { key: 'value', label: 'القيمة', numeric: true, render: (r) => num(typeof r.value === 'number' ? r.value : Number(r.value) || 0) || String(r.value) },
    { key: 'secondary', label: 'النسبة', render: (r) => r.secondary ?? '—' },
  ];

  return (
    <CenteredShell>
      <PageHeader
        title="التقارير الإحصائية"
        subtitle="تسعة قوالب تقارير قابلة للتصدير بصيغ PDF و Excel و Word"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              leadingIcon={<FileSpreadsheet size={14} strokeWidth={1.75} />}
              isLoading={csvMut.isPending}
              onClick={() => {
                csvMut.mutate(
                  { key: template, cycleId },
                  {
                    onSuccess: (blob) => {
                      downloadBlob(blob, `${template}.csv`);
                      toast('تم تصدير ملف Excel-CSV', 'success');
                    },
                  },
                );
              }}
            >
              Excel
            </Button>
            <Button
              variant="secondary"
              leadingIcon={<FileText size={14} strokeWidth={1.75} />}
              isLoading={rtfMut.isPending}
              onClick={() => {
                rtfMut.mutate(
                  { key: template, cycleId },
                  {
                    onSuccess: (blob) => {
                      downloadBlob(blob, `${template}.rtf`);
                      toast('تم تصدير ملف Word-RTF', 'success');
                    },
                  },
                );
              }}
            >
              Word
            </Button>
            <Button
              variant="primary"
              leadingIcon={<Printer size={14} strokeWidth={1.75} />}
              isLoading={pdfMut.isPending}
              onClick={() => pdfMut.mutate()}
            >
              PDF (طباعة)
            </Button>
          </div>
        }
      />

      <Card>
        <div className="grid gap-3 md:grid-cols-2">
          <Select
            label="قالب التقرير"
            value={template}
            onChange={(e) => setTemplate(e.target.value as ReportTemplateKey)}
            options={TEMPLATE_KEYS.map((k) => ({ value: k, label: REPORT_TEMPLATE_LABELS[k] }))}
          />
          <Select
            label="الدورة"
            value={cycleId ?? ''}
            onChange={(e) => setCycleId(e.target.value || null)}
            options={[
              { value: '', label: 'كل الدورات' },
              ...((cycles ?? []).map((c) => ({ value: c.id, label: c.nameAr }))),
            ]}
          />
        </div>
      </Card>

      <div className="my-6 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div data-print-card>
          <PrintLayout
            title={doc?.title ?? REPORT_TEMPLATE_LABELS[template]}
            subtitle={cycleId ? `الدورة: ${cycles?.find((c) => c.id === cycleId)?.nameAr ?? cycleId}` : undefined}
            reportId={`RPT-${new Date().toISOString().slice(0, 10)}-${template.toUpperCase()}`}
            generatedAt={doc ? fmtDate(doc.generatedAt) : ''}
          >
            {error ? (
              <ErrorState error={error} onRetry={() => refetch()} />
            ) : isLoading || !doc ? (
              <LoadingState variant="table" rows={6} />
            ) : (
              <DataTable
                data={doc.rows}
                columns={columns}
                rowKey={(_r, i) => i}
                empty={null}
                density="compact"
              />
            )}
          </PrintLayout>
        </div>

        <div className="flex flex-col gap-4 no-print">
          <Card>
            <CardHeader title="ملخّص الحالات" />
            <CardBody>
              <DonutChart
                data={(statusDist ?? []).map((d) => ({ label: d.label, value: d.value }))}
                centerLabel="حالة"
                size={180}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="السداد · 14 يوم" />
            <CardBody>
              <LineChart
                height={140}
                data={MOCK.last14Days.map((d) => ({ label: d.label, value: d.payments }))}
                color="var(--success)"
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="نوع الشهادة" />
            <CardBody>
              <DonutChart
                data={(certDist ?? []).map((d) => ({ label: d.label, value: d.value }))}
                centerLabel="متقدم"
                size={180}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="المحافظات الأعلى" actions={<Badge tone="info">12</Badge>} />
            <CardBody>
              <BarChart
                height={160}
                data={(govDist ?? []).slice(0, 12).map((d) => ({ label: d.label, value: d.value }))}
                color="var(--accent-500)"
              />
            </CardBody>
          </Card>
        </div>
      </div>

      <p className="text-2xs text-ink-500">
        <Download size={11} strokeWidth={1.75} className="me-1 inline-block" />
        التصدير الكامل لـ PDF متعدد الصفحات و Excel xlsx الأصلي مدرج في صلب Sprint 10 (Hardening).
      </p>
    </CenteredShell>
  );
}
