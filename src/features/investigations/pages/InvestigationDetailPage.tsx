/**
 * InvestigationDetailPage — full case file with conclusion + decision.
 * Source: KARASA §5.2.B.
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Eye, FileText, ShieldAlert, ShieldCheck, Users, XCircle } from 'lucide-react';
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
        {/* Restricted classification banner */}
        <div className="mb-5 overflow-hidden rounded-md border border-terra-500 bg-terra-50">
          <div className="flex items-center justify-between gap-3 border-b border-terra-500/40 bg-terra-500 px-3 py-1 font-mono text-2xs font-bold uppercase tracking-[0.18em] text-white" dir="ltr">
            <span>RESTRICTED · CLASSIFIED</span>
            <span>{c.id}</span>
          </div>
          <div className="flex items-center justify-between gap-3 p-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-terra-500 text-white" aria-hidden>
                <ShieldAlert size={18} strokeWidth={1.75} />
              </span>
              <div>
                <p className="font-ar-display text-md font-bold text-terra-700">سرّي للغاية · الوصول مقيّد</p>
                <p className="text-2xs text-terra-700/85">يُسمح بالاطلاع لأعضاء قطاع الأمن العام المخوّلين فقط · أيّ تسريب يستوجب الملاحقة</p>
              </div>
            </div>
            <Badge tone="danger" icon={<Eye size={11} strokeWidth={1.75} />}>وُصول مُسجَّل</Badge>
          </div>
        </div>

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
              <div className="border-t border-border-subtle pt-2 text-2xs">
                <p className="text-ink-500 mb-1">آخر اطّلاع على الملف</p>
                <ul className="space-y-1">
                  <li className="flex items-center justify-between gap-2"><span className="font-mono" dir="ltr">CPL-2031</span><span className="text-ink-700">قبل ساعتين</span></li>
                  <li className="flex items-center justify-between gap-2"><span className="font-mono" dir="ltr">MAJ-1847</span><span className="text-ink-700">أمس 14:32</span></li>
                </ul>
              </div>
            </div>
          </Card>
        </div>

        {/* Family tree visualization (KARASA §6.5 — investigations extend to 4th degree) */}
        <Card className="mt-5">
          <CardHeader
            title="شجرة الأسرة قيد التحرّي"
            subtitle="تمتدّ التحريات حتى الدرجة الرابعة من القرابة وفقاً لكرّاسة §6.5"
            actions={<Badge tone="info" icon={<Users size={11} strokeWidth={1.75} />}>4 درجات</Badge>}
          />
          <div className="rounded-md border border-border-subtle bg-ink-50 p-5">
            {/* Generation 3 — Grandparents */}
            <div className="mb-4 grid grid-cols-4 gap-2 text-2xs">
              <FamilyNode label="جد لأب" name="محمد إبراهيم الخطيب" status="clear" />
              <FamilyNode label="جدة لأب" name="فاطمة عبد الله" status="clear" />
              <FamilyNode label="جد لأم" name="حسن أحمد محمود" status="clear" />
              <FamilyNode label="جدة لأم" name="عائشة كمال السيد" status="deceased" />
            </div>
            <div aria-hidden className="mx-auto mb-4 h-3 w-px bg-border-default" />
            {/* Generation 2 — Parents */}
            <div className="mb-4 grid grid-cols-2 gap-2 text-2xs">
              <FamilyNode label="الأب" name="أحمد محمد إبراهيم الخطيب" status="clear" emphasized />
              <FamilyNode label="الأم" name="مريم حسن أحمد محمود" status="clear" emphasized />
            </div>
            <div aria-hidden className="mx-auto mb-4 h-3 w-px bg-border-default" />
            {/* Generation 1 — Applicant */}
            <div className="mx-auto max-w-xs">
              <FamilyNode label="المتقدم" name={c.applicantName} status="under-review" emphasized />
            </div>
          </div>
        </Card>

        <Card className="mt-5">
          <CardHeader
            title="الفحوصات الخارجية"
            subtitle="عبر إدارات قطاع الأمن العام"
          />
          <ul className="grid gap-2 text-sm">
            <ChecklistItem label="إدارة المعلومات الجنائية — السجل الجنائي" detail="لا توجد بلاغات سابقة" pass />
            <ChecklistItem label="مباحث الأمن الوطني — رصد أمني" detail="لا توجد إشارات" pass />
            <ChecklistItem label="إدارة مكافحة المخدرات — تحرّ شامل" detail="نظيف" pass />
            <ChecklistItem label="إدارة الجوازات — السفر والتأشيرات" detail="3 رحلات سياحية للسعودية والإمارات" pass />
            <ChecklistItem label="مراقبة وسائل التواصل الاجتماعي" detail="مراجعة بشرية تمت — لا محتوى مُريب" pass />
            <ChecklistItem label="مقابلة شخصية مع الجيران/الأقارب" detail="جارية — في انتظار محضر الميدان" pending />
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

function ChecklistItem({ label, detail, pass, pending }: { label: string; detail?: string; pass?: boolean; pending?: boolean }): JSX.Element {
  return (
    <li className="flex items-start justify-between gap-2 border-b border-border-subtle py-2 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm text-ink-900">{label}</p>
        {detail && <p className="mt-0.5 text-2xs text-ink-500">{detail}</p>}
      </div>
      {pass && <Badge tone="success" icon={<CheckCircle2 size={11} strokeWidth={1.75} />}>تم</Badge>}
      {pending && <Badge tone="warning" dot>قيد التنفيذ</Badge>}
      {!pass && !pending && <Badge tone="danger" icon={<ShieldAlert size={11} strokeWidth={1.75} />}>ملاحظات</Badge>}
    </li>
  );
}

function FamilyNode({
  label,
  name,
  status,
  emphasized,
}: {
  label: string;
  name: string;
  status: 'clear' | 'under-review' | 'flagged' | 'deceased';
  emphasized?: boolean;
}): JSX.Element {
  const tone =
    status === 'clear' ? { border: 'border-success', bg: 'bg-success-bg/30', text: 'text-success', icon: <ShieldCheck size={10} strokeWidth={1.75} />, label: 'نظيف' }
    : status === 'flagged' ? { border: 'border-terra-500', bg: 'bg-terra-50', text: 'text-terra-700', icon: <ShieldAlert size={10} strokeWidth={1.75} />, label: 'تنبيه' }
    : status === 'deceased' ? { border: 'border-ink-300', bg: 'bg-ink-50', text: 'text-ink-500', icon: <Users size={10} strokeWidth={1.75} />, label: 'متوفّى' }
    : { border: 'border-gold-500', bg: 'bg-gold-50', text: 'text-gold-700', icon: <Eye size={10} strokeWidth={1.75} />, label: 'قيد التحرّي' };
  return (
    <div className={`rounded-md border ${tone.border} ${tone.bg} p-2 text-center ${emphasized ? 'shadow-sm' : ''}`}>
      <p className="text-2xs uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-0.5 truncate text-2xs font-medium text-ink-900">{name}</p>
      <span className={`mt-1 inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10px] ${tone.text}`}>
        {tone.icon}
        {tone.label}
      </span>
    </div>
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
