import { useParams, Link } from 'react-router-dom';
import { ArrowRight, Printer } from 'lucide-react';
import { PageHeader, Card, CardHeader, CardBody, Avatar, Button, Skeleton, Badge } from '@/shared/components';
import { StatusBadge, PaymentBadge, ResultBadge, InvestigationBadge } from '@/shared/components/StatusBadge';
import { useApplicant, useApplicantTimeline } from '@/features/applicants/api/applicant.queries';
import { date as fmtDate, num, maskNationalId } from '@/shared/lib/format';
import { ROUTES } from '@/config/routes';

export function ApplicantDetailPage(): JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const { data: applicant, isLoading } = useApplicant(id);
  const { data: timeline } = useApplicantTimeline(id);

  if (isLoading) return <Skeleton height={300} />;
  if (!applicant) {
    return (
      <Card>
        <CardBody>
          <div className="empty">
            <div className="empty-title">لم يُعثر على المتقدم</div>
            <div className="empty-desc mb-4">الكود المطلوب غير موجود في قاعدة البيانات</div>
            <Link to={ROUTES.admin.applicants} className="btn btn-secondary">عودة للقائمة</Link>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar name={applicant.name} size="lg" />
            {applicant.name}
          </span>
        }
        subtitle={`كود التقدم: ${applicant.id} · مرحلة: ${applicant.stageLabel}`}
        breadcrumbs={[
          { label: 'الإدارة', href: '#' + ROUTES.admin.dashboard },
          { label: 'المتقدمون', href: '#' + ROUTES.admin.applicants },
          { label: applicant.id },
        ]}
        actions={
          <>
            <Link to={ROUTES.admin.applicants} className="btn btn-ghost"><ArrowRight size={16} /> الرجوع</Link>
            <Button variant="secondary" leadingIcon={<Printer size={16} />}>طباعة الملف</Button>
          </>
        }
      />

      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 'var(--sp-5)' }}>
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title="البيانات الشخصية" />
            <CardBody>
              <div className="grid grid-2">
                <DetailRow label="الاسم رباعي" value={applicant.name} />
                <DetailRow label="الرقم القومي" value={<span className="mono">{maskNationalId(applicant.nationalId)}</span>} />
                <DetailRow label="النوع" value={applicant.gender === 'male' ? 'ذكر' : 'أنثى'} />
                <DetailRow label="تاريخ الميلاد" value={fmtDate(applicant.birthDate, 'short')} />
                <DetailRow label="المحافظة" value={applicant.governorate} />
                <DetailRow label="المدينة" value={applicant.city} />
                <DetailRow label="حجم الأسرة" value={`${num(applicant.familySize)} أفراد`} />
                <DetailRow label="عدد الأقارب" value={`${num(applicant.relativesCount)} قريب`} />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="البيانات الأكاديمية" />
            <CardBody>
              <div className="grid grid-2">
                <DetailRow label="نوع الشهادة" value={applicant.certType} />
                <DetailRow label="الشعبة" value={applicant.certSection} />
                <DetailRow label="المجموع" value={<span className="mono font-bold">{num(applicant.certScore)} / 410</span>} />
                <DetailRow label="النسبة المئوية" value={<span className="mono">{applicant.certPercent}%</span>} />
                <DetailRow label="عام التخرج" value={<span className="mono">{applicant.certYear}</span>} />
                <DetailRow label="اللجنة" value={`اللجنة ${applicant.committee}`} />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="نتائج الاختبارات" />
            <CardBody>
              <div className="grid grid-4">
                <ResultRow label="الكشف الطبي" outcome={applicant.results.medical} />
                <ResultRow label="اللياقة البدنية" outcome={applicant.results.fitness} />
                <ResultRow label="المقابلة الشخصية" outcome={applicant.results.interview} />
                <ResultRow label="الاختبار النهائي" outcome={applicant.results.finalExam} />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="التحريات" />
            <CardBody>
              <div className="flex items-center gap-3">
                <InvestigationBadge status={applicant.investigation} />
                <span className="text-sm text-secondary">
                  {applicant.investigation === 'cleared' && 'تم الإفراج عن الملف من قطاع الأمن العام'}
                  {applicant.investigation === 'flagged' && 'يوجد ملاحظة بالملف — يُرجى مراجعة إدارة التحريات'}
                  {applicant.investigation === 'pending' && 'لا يزال ملف التحريات قيد المعالجة'}
                </span>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title="الحالة الحالية" />
            <CardBody>
              <div className="flex flex-col gap-3">
                <DetailRow label="الحالة" value={<StatusBadge status={applicant.status} />} />
                <DetailRow label="الدفع" value={<PaymentBadge status={applicant.paymentStatus} />} />
                <DetailRow label="الرسوم" value={<span className="mono">{num(applicant.paymentAmount)} ج.م</span>} />
                <DetailRow label="المستندات" value={applicant.hasDocuments ? <Badge tone="success">مكتملة</Badge> : <Badge tone="warning">ناقصة</Badge>} />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="السجل الزمني" subtitle="آخر التحديثات على الملف" />
            <CardBody style={{ padding: 8 }}>
              <div className="activity">
                {(timeline ?? []).map((e, i) => (
                  <div className="activity-item" key={i}>
                    <span className="activity-icon" style={{ fontSize: 14 }}>{e.icon}</span>
                    <div className="activity-body">
                      <div className="activity-title">{e.title}</div>
                      <div className="activity-meta">{e.detail} · {fmtDate(e.ts, 'rel')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }): JSX.Element {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}

function ResultRow({ label, outcome }: { label: string; outcome: 'pass' | 'fail' | null }): JSX.Element {
  return (
    <div className="flex flex-col gap-2 items-center text-center" style={{ padding: 12, background: 'var(--surface-muted)', borderRadius: 'var(--r-md)' }}>
      <span className="text-sm text-secondary">{label}</span>
      <ResultBadge outcome={outcome} />
    </div>
  );
}
