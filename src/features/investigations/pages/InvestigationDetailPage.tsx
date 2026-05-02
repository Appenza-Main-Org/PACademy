/**
 * InvestigationDetailPage — full case file with conclusion + decision.
 * Source: KARASA §5.2.B.
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, FileText, ShieldAlert, XCircle } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  FileUpload,
  LoadingState,
  PageHeader,
  PrintLayout,
  Select,
  Textarea,
  toast,
} from '@/shared/components';
import { investigationsService } from '../api/investigations.service';
import { ROUTES } from '@/config/routes';
import { date as fmtDate, maskNationalId, shortName } from '@/shared/lib/format';
import type { CaseStatus, InvestigationCase } from '@/shared/types/domain';

export function InvestigationDetailPage(): JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const { data: c, isLoading, error, refetch } = useQuery({
    queryKey: ['investigations', 'case', id],
    queryFn: () => investigationsService.getById(id),
    enabled: Boolean(id),
  });
  const [conclusion, setConclusion] = useState('');
  const [nextStatus, setNextStatus] = useState<CaseStatus>('in-review');

  if (isLoading) return <LoadingState variant="page" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!c) return <EmptyState variant="generic" title="القضية غير موجودة" />;

  return (
    <>
      <PageHeader
        title={`قضية ${c.id}`}
        subtitle={`المتقدم: ${c.applicantName} · الرقم: ${c.applicantId}`}
        breadcrumbs={[
          { label: 'إدارة التحريات', href: ROUTES.investigations.overview },
          { label: c.id },
        ]}
        actions={
          <Button
            variant="primary"
            leadingIcon={<FileText size={14} strokeWidth={1.75} />}
            onClick={() => window.print()}
          >
            طباعة الملف
          </Button>
        }
      />

      <PrintLayout
        title="ملف تحريات سرّي"
        subtitle={`القضية ${c.id}`}
        reportId={c.id}
        generatedAt={fmtDate(Date.now())}
        restricted
      >
        <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader title="ملخّص المتقدم" subtitle="بيانات للقراءة فقط من ملف التقدم" />
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Field label="الرقم التعريفي" value={c.applicantId} mono />
              <Field label="الرقم القومي" value={maskNationalId('29812345678901')} mono />
              <Field label="نوع القضية" value={CASE_TYPE_LABEL[c.caseType]} />
              <Field label="الأولوية" value={PRIORITY_LABEL[c.priority]} />
              <Field label="تاريخ الفتح" value={fmtDate(c.openedAt, 'short')} />
              <Field label="تاريخ الاستحقاق" value={fmtDate(c.dueDate, 'short')} />
            </dl>
          </Card>

          <Card>
            <CardHeader title="الحالة الحالية" />
            <div className="space-y-3 text-sm">
              <CaseStatusBadge status={c.status} />
              <p className="text-2xs text-ink-500">المحقّق المسؤول: {shortName(c.assignedTo, 3)}</p>
            </div>
          </Card>
        </div>

        <Card className="mt-5">
          <CardHeader title="الفحوصات الخارجية" subtitle="السجلات الجنائية، أمن الدولة، رقابة محتوى التواصل الاجتماعي" />
          <ul className="grid gap-2 text-sm">
            <ChecklistItem label="السجل الجنائي — لا توجد بلاغات سابقة" pass />
            <ChecklistItem label="رصد أمن الدولة — لا أعلام" pass />
            <ChecklistItem label="حسابات التواصل الاجتماعي — مراجعة بشرية تمت" pass />
            <ChecklistItem label="رقم هاتف الجار/الأقارب — تم التحقق" pending />
          </ul>
        </Card>

        <Card className="mt-5 no-print">
          <CardHeader title="رفع وثائق إضافية" subtitle="تقارير، نسخ بطاقات، صور، ملفات صوتية" />
          <FileUpload accept=".pdf,.jpg,.png" multiple />
        </Card>

        <Card className="mt-5 no-print">
          <CardHeader title="الخلاصة والقرار" />
          <div className="grid gap-3">
            <Textarea label="خلاصة المحقّق" value={conclusion} onChange={(e) => setConclusion(e.target.value)} />
            <Select
              label="القرار النهائي"
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value as CaseStatus)}
              options={[
                { value: 'in-review', label: 'تحت المراجعة' },
                { value: 'pass', label: 'إفراج' },
                { value: 'fail', label: 'إيقاف' },
                { value: 'defer-conditional', label: 'تأجيل بشرط' },
              ]}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="primary"
                leadingIcon={nextStatus === 'pass' ? <CheckCircle2 size={14} strokeWidth={1.75} /> : <XCircle size={14} strokeWidth={1.75} />}
                onClick={async () => {
                  await investigationsService.update(c.id, { status: nextStatus, conclusion });
                  toast('تم حفظ القرار وإسناد الحالة الجديدة للقضية', 'success');
                }}
              >
                حفظ القرار
              </Button>
            </div>
          </div>
        </Card>
      </PrintLayout>
    </>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }): JSX.Element {
  return (
    <div className="grid grid-cols-[140px_1fr] items-baseline gap-2 border-b border-border-subtle pb-2">
      <dt className="text-ink-500">{label}</dt>
      <dd className={mono ? 'font-mono text-ink-900' : 'text-ink-900'} {...(mono ? { dir: 'ltr' } : {})}>{value}</dd>
    </div>
  );
}

function ChecklistItem({ label, pass, pending }: { label: string; pass?: boolean; pending?: boolean }): JSX.Element {
  return (
    <li className="flex items-center justify-between gap-2 border-b border-border-subtle py-1.5 last:border-b-0">
      <span>{label}</span>
      {pass && <Badge tone="success" icon={<CheckCircle2 size={11} strokeWidth={1.75} />}>تم</Badge>}
      {pending && <Badge tone="warning" dot>قيد التنفيذ</Badge>}
      {!pass && !pending && <Badge tone="danger" icon={<ShieldAlert size={11} strokeWidth={1.75} />}>ملاحظات</Badge>}
    </li>
  );
}

function CaseStatusBadge({ status }: { status: CaseStatus }): JSX.Element {
  if (status === 'open') return <Badge tone="warning">قضية مفتوحة</Badge>;
  if (status === 'in-review') return <Badge tone="info">قيد المراجعة</Badge>;
  if (status === 'pass') return <Badge tone="success">إفراج</Badge>;
  if (status === 'fail') return <Badge tone="danger">إيقاف</Badge>;
  return <Badge tone="warning">تأجيل بشرط</Badge>;
}

const CASE_TYPE_LABEL: Record<InvestigationCase['caseType'], string> = {
  'committee-A': 'لجنة (أ)',
  'committee-C': 'لجنة (ج)',
  'data-review': 'مراجعة بيانات',
};
const PRIORITY_LABEL: Record<InvestigationCase['priority'], string> = {
  low: 'منخفضة',
  medium: 'متوسطة',
  high: 'مرتفعة',
  critical: 'حرجة',
};
