/**
 * /admin/applicants/:id — restructured admin Applicant detail page.
 *
 * Layout:
 *   • Header card: photo + name + code + current status badge + current stage
 *     chip + 3 primary actions (تعديل · تحديث الحالة · طباعة).
 *   • Two-column body (desktop) / single column (mobile):
 *      - Left: 7 mirrored read-only sections (identity / address / contact /
 *        department / education / family / relatives) each rendered as a <dl>
 *        grid. Section headers anchor the same as the form.
 *      - Right: ApplicantWorkflowPanel (StageStepper + tests + transition
 *        dialog + workflow timeline) + AuditTimeline + legacy timeline card.
 *   • Each query renders its own per-section ErrorState — failures don't
 *     black out the whole page.
 */

import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Pencil, Printer } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  LoadingState,
  PageHeader,
} from '@/shared/components';
import {
  InvestigationBadge,
  PaymentBadge,
  ResultBadge,
  StatusBadge,
} from '@/shared/components/StatusBadge';
import {
  useApplicant,
  useApplicantTimeline,
  useApplicantWorkflow,
  useApplicantProgress,
} from '@/features/applicants';
import { useAuthStore } from '@/features/auth';
import { hasPermission } from '@/features/auth/rbac';
import { date as fmtDate, num, maskNationalId } from '@/shared/lib/format';
import { ROUTES } from '@/config/routes';
import {
  DEPARTMENT_LABELS,
  type Applicant,
  type ApplicantEducation,
  type ApplicantFamilyMember,
} from '@/shared/types/domain';
import { ApplicantWorkflowPanel } from '@/features/admin/components/workflow/ApplicantWorkflowPanel';
import { AuditTimeline } from '@/features/admin/components/applicants/AuditTimeline';
import { SECTION_LABELS } from '@/features/applicants/schemas';

export function ApplicantDetailPage(): JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const { data: applicant, isLoading, error, refetch } = useApplicant(id);
  const user = useAuthStore((s) => s.user);

  if (isLoading) return <LoadingState variant="detail" />;
  if (error) return <ErrorState error={error as Error} onRetry={() => refetch()} />;
  if (!applicant) {
    return (
      <Card>
        <CardBody>
          <div className="empty">
            <div className="empty-title">لم يُعثر على المتقدم</div>
            <div className="empty-desc mb-4">
              الكود "{id}" غير موجود في قاعدة البيانات.
            </div>
            <Link to={ROUTES.admin.applicants} className="btn btn-secondary">
              عودة للقائمة
            </Link>
          </div>
        </CardBody>
      </Card>
    );
  }

  const canEdit = Boolean(user) && user!.role !== 'records_clerk';
  const canTransition = canEdit && hasPermission(user!.permissions, 'applicants:edit');

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar name={applicant.name} size="lg" />
            <span className="flex flex-col">
              <span>{applicant.name}</span>
              <span className="text-2xs font-normal text-ink-500">
                <span className="font-mono">{applicant.id}</span>
                {' · '}
                {applicant.department
                  ? DEPARTMENT_LABELS[applicant.department]
                  : applicant.certType}
                {' · '}
                <Badge tone="info">{applicant.stageLabel}</Badge>
              </span>
              {applicant.lastModifiedAt && (
                <span
                  className="mt-0.5 text-2xs font-normal text-ink-500"
                  data-testid="last-modified-indicator"
                >
                  آخر تعديل
                  {applicant.lastModifiedBy ? ` بواسطة ${applicant.lastModifiedBy}` : ''}
                  {' · '}
                  {fmtDate(applicant.lastModifiedAt, 'full')}
                </span>
              )}
            </span>
          </span>
        }
        breadcrumbs={[
          { label: 'الإدارة', href: '#' + ROUTES.admin.dashboard },
          { label: 'المتقدمون', href: '#' + ROUTES.admin.applicants },
          { label: applicant.id },
        ]}
        actions={
          <>
            {canEdit && (
              <Link
                to={`${ROUTES.admin.applicantDetail(id)}/edit`}
                className="btn btn-secondary"
              >
                <Pencil size={14} strokeWidth={1.75} className="me-1.5" />
                تعديل
              </Link>
            )}
            <Button variant="secondary" leadingIcon={<Printer size={16} />}>
              طباعة الملف
            </Button>
            <Link to={ROUTES.admin.applicants} className="btn btn-ghost">
              <ArrowRight size={16} className="rtl:rotate-180" /> الرجوع
            </Link>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        {/* ── Left rail: mirrored read-only sections ─────────────────── */}
        <div className="flex min-w-0 flex-col gap-5">
          {/* §1 Identity */}
          <SectionCard id="section-identity" title={SECTION_LABELS.identity}>
            <DefRow label="الاسم رباعي" value={applicant.name} />
            <DefRow
              label="الرقم القومي"
              value={
                <span className="font-mono" dir="ltr">
                  {maskNationalId(applicant.nationalId)}
                </span>
              }
            />
            <DefRow label="النوع" value={applicant.gender === 'male' ? 'ذكر' : 'أنثى'} />
            <DefRow label="تاريخ الميلاد" value={fmtDate(applicant.birthDate, 'short')} />
            <DefRow label="الديانة" value={applicant.religion ?? '—'} />
            <DefRow label="الحالة الاجتماعية" value={applicant.maritalStatus ?? '—'} />
          </SectionCard>

          {/* §2 Address */}
          <SectionCard id="section-address" title={SECTION_LABELS.address}>
            <DefRow label="المحافظة" value={applicant.governorate} />
            <DefRow label="المدينة / القرية" value={applicant.city} />
            <DefRow
              label="العنوان التفصيلي"
              value={applicant.currentAddress?.detail ?? '—'}
              wide
            />
            <DefRow label="الشارع" value={applicant.currentAddress?.street ?? '—'} />
          </SectionCard>

          {/* §3 Contact */}
          <SectionCard id="section-contact" title={SECTION_LABELS.contact}>
            <DefRow label="هاتف ثابت" value={applicant.contact?.homePhone ?? '—'} />
            <DefRow
              label="محمول رئيسي"
              value={
                applicant.contact?.mobilePhone ? (
                  <span className="font-mono" dir="ltr">
                    {applicant.contact.mobilePhone}
                  </span>
                ) : (
                  '—'
                )
              }
            />
            <DefRow
              label="البريد الإلكتروني"
              value={applicant.contact?.email ?? '—'}
              wide
            />
            <DefRow label="فيسبوك" value={applicant.contact?.socialFacebook ?? '—'} />
            <DefRow label="إنستجرام" value={applicant.contact?.socialInstagram ?? '—'} />
            <DefRow label="X" value={applicant.contact?.socialX ?? '—'} />
            <DefRow label="رابط آخر" value={applicant.contact?.socialOther ?? '—'} />
          </SectionCard>

          {/* §4 Department */}
          <SectionCard id="section-department" title={SECTION_LABELS.department}>
            <DefRow
              label="فئة التقدم"
              value={
                applicant.department ? DEPARTMENT_LABELS[applicant.department] : '—'
              }
            />
            <DefRow label="رقم الدورة" value={applicant.cycleId ?? '—'} />
          </SectionCard>

          {/* §5 Education */}
          <SectionCard id="section-education" title={SECTION_LABELS.education}>
            <EducationView education={applicant.education} fallback={applicant} />
          </SectionCard>

          {/* §6 Family */}
          <SectionCard id="section-family" title={SECTION_LABELS.family}>
            <FamilyView family={applicant.family} fallbackSize={applicant.familySize} />
          </SectionCard>

          {/* §7 Relatives */}
          <SectionCard id="section-relatives" title={SECTION_LABELS.relatives}>
            <RelativesView family={applicant.family} fallbackCount={applicant.relativesCount} />
          </SectionCard>

          {/* Status & Investigation snapshot */}
          <Card>
            <CardHeader title="الحالة الحالية" />
            <CardBody>
              <div className="grid gap-3 md:grid-cols-2">
                <DefRow label="الحالة" value={<StatusBadge status={applicant.status} />} />
                <DefRow label="الدفع" value={<PaymentBadge status={applicant.paymentStatus} />} />
                <DefRow
                  label="الرسوم"
                  value={<span className="font-mono">{num(applicant.paymentAmount)} ج.م</span>}
                />
                <DefRow
                  label="المستندات"
                  value={
                    applicant.hasDocuments ? (
                      <Badge tone="success">مكتملة</Badge>
                    ) : (
                      <Badge tone="warning">ناقصة</Badge>
                    )
                  }
                />
              </div>
            </CardBody>
          </Card>

          {/* Test Results snapshot */}
          <Card>
            <CardHeader
              title="نتائج الاختبارات"
              subtitle="آخر النتائج المسجّلة في الملف"
            />
            <CardBody>
              <div className="grid gap-3 md:grid-cols-4">
                <ResultRow label="الكشف الطبي" outcome={applicant.results.medical} />
                <ResultRow label="اللياقة البدنية" outcome={applicant.results.fitness} />
                <ResultRow label="المقابلة" outcome={applicant.results.interview} />
                <ResultRow label="الاختبار النهائي" outcome={applicant.results.finalExam} />
              </div>
            </CardBody>
          </Card>

          {/* Investigation */}
          <Card>
            <CardHeader title="التحريات" />
            <CardBody>
              <div className="flex items-center gap-3">
                <InvestigationBadge status={applicant.investigation} />
                <span className="text-sm text-ink-500">
                  {applicant.investigation === 'cleared' &&
                    'تم الإفراج عن السجل من قطاع الأمن العام'}
                  {applicant.investigation === 'flagged' &&
                    'يوجد ملاحظة بالملف — راجع إدارة التحريات'}
                  {applicant.investigation === 'pending' &&
                    'لا يزال ملف التحريات قيد المعالجة'}
                </span>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* ── Right rail: workflow + audit ────────────────────────────── */}
        <div className="flex flex-col gap-5">
          <WorkflowPanelOrFallback applicantId={id} canTransition={canTransition} />
          <AuditTimeline applicantId={id} />
          <LegacyTimelineCard applicantId={id} />
        </div>
      </div>
    </>
  );
}

function WorkflowPanelOrFallback({
  applicantId,
  canTransition,
}: {
  applicantId: string;
  canTransition: boolean;
}): JSX.Element {
  const wf = useApplicantWorkflow(applicantId);
  const progress = useApplicantProgress(applicantId);
  if (wf.error || progress.error) {
    return (
      <Card>
        <CardHeader title="سير العمل" />
        <ErrorState
          error={(wf.error ?? progress.error) as Error}
          onRetry={() => {
            wf.refetch();
            progress.refetch();
          }}
        />
      </Card>
    );
  }
  return <ApplicantWorkflowPanel applicantId={applicantId} canTransition={canTransition} />;
}

function LegacyTimelineCard({ applicantId }: { applicantId: string }): JSX.Element {
  const { data: timeline, isLoading, error } = useApplicantTimeline(applicantId);
  if (isLoading) return <LoadingState variant="list" />;
  if (error) {
    return (
      <Card>
        <CardHeader title="السجل الزمني للملف" />
        <ErrorState error={error as Error} />
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader title="السجل الزمني للملف" subtitle="أحداث ضمن دورة المتقدم" />
      <CardBody style={{ padding: 8 }}>
        <div className="activity">
          {(timeline ?? []).map((e, i) => (
            <div className="activity-item" key={i}>
              <span className="activity-icon" style={{ fontSize: 14 }}>
                {e.icon}
              </span>
              <div className="activity-body">
                <div className="activity-title">{e.title}</div>
                <div className="activity-meta">
                  {e.detail} · {fmtDate(e.ts, 'rel')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function SectionCard({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section id={id} className="scroll-mt-20">
      <Card>
        <CardHeader title={title} />
        <CardBody>
          <dl className="grid gap-3 md:grid-cols-2">{children}</dl>
        </CardBody>
      </Card>
    </section>
  );
}

function DefRow({
  label,
  value,
  wide,
}: {
  label: string;
  value: React.ReactNode;
  wide?: boolean;
}): JSX.Element {
  return (
    <div className={`flex flex-col gap-0.5 ${wide ? 'md:col-span-2' : ''}`}>
      <dt className="text-2xs font-medium uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="text-sm text-ink-900">{value}</dd>
    </div>
  );
}

function ResultRow({
  label,
  outcome,
}: {
  label: string;
  outcome: 'pass' | 'fail' | null;
}): JSX.Element {
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-md text-center"
      style={{ padding: 12, background: 'var(--surface-muted)' }}
    >
      <span className="text-sm text-ink-500">{label}</span>
      <ResultBadge outcome={outcome} />
    </div>
  );
}

function EducationView({
  education,
  fallback,
}: {
  education: ApplicantEducation | undefined;
  fallback: Applicant;
}): JSX.Element {
  if (!education) {
    return (
      <>
        <DefRow label="نوع الشهادة" value={fallback.certType} />
        <DefRow label="الشعبة" value={fallback.certSection} />
        <DefRow
          label="المجموع"
          value={<span className="font-mono font-bold">{num(fallback.certScore)} / 410</span>}
        />
        <DefRow
          label="النسبة المئوية"
          value={<span className="font-mono">{fallback.certPercent}%</span>}
        />
        <DefRow label="عام التخرج" value={<span className="font-mono">{fallback.certYear}</span>} />
      </>
    );
  }
  if (education.kind === 'general') {
    return (
      <>
        <DefRow label="اسم الشهادة" value={education.certificateName} />
        <DefRow label="اسم المدرسة" value={education.schoolName} />
        <DefRow
          label="المجموع"
          value={<span className="font-mono">{num(education.totalScore)} / 410</span>}
        />
        <DefRow label="نوع الجلوس" value={education.seatType ?? '—'} />
        <DefRow label="الشعبة" value={education.branch} />
        <DefRow label="فئة المدرسة" value={education.schoolCategory ?? '—'} />
        <DefRow
          label="سنة التخرج"
          value={<span className="font-mono">{education.graduationYear}</span>}
        />
        <DefRow
          label="النسبة المئوية"
          value={education.percentage ? `${education.percentage}%` : '—'}
        />
      </>
    );
  }
  if (education.kind === 'overseas') {
    return (
      <>
        <DefRow label="اسم الشهادة" value={education.certificateName} />
        <DefRow label="اسم المدرسة" value={education.schoolName} />
        <DefRow label="المجموع" value={<span className="font-mono">{num(education.totalScore)}</span>} />
        <DefRow label="نوع الجلوس" value={education.seatType ?? '—'} />
        <DefRow label="فئة المدرسة" value={education.schoolCategory ?? '—'} />
        <DefRow label="دولة الدراسة" value={education.country} />
        <DefRow
          label="سنة التخرج"
          value={<span className="font-mono">{education.graduationYear}</span>}
        />
      </>
    );
  }
  return (
    <>
      <DefRow label="التخصص" value={education.specialization} />
      <DefRow label="الجامعة" value={education.university} />
      <DefRow label="الكلية" value={education.faculty} />
      <DefRow label="المجموع" value={<span className="font-mono">{num(education.totalScore)}</span>} />
      <DefRow label="التقدير" value={education.grade ?? '—'} />
      <DefRow label="تخصص أعلى" value={education.higherSpecialization ?? '—'} />
      <DefRow
        label="سنة التخرج"
        value={<span className="font-mono">{education.graduationYear}</span>}
      />
      <DefRow label="ثانوية: الشهادة" value={education.secondary.certificateName} />
      <DefRow
        label="ثانوية: المجموع"
        value={<span className="font-mono">{num(education.secondary.totalScore)}</span>}
      />
    </>
  );
}

function FamilyView({
  family,
  fallbackSize,
}: {
  family: Applicant['family'];
  fallbackSize: number;
}): JSX.Element {
  if (!family || !family.father) {
    return (
      <DefRow
        label="حجم الأسرة"
        value={`${num(fallbackSize)} أفراد (لم تُسجَّل بيانات تفصيلية بعد)`}
        wide
      />
    );
  }
  const fixed: { label: string; member: ApplicantFamilyMember | undefined }[] = [
    { label: 'الأب', member: family.father },
    { label: 'الأم', member: family.mother },
    { label: 'الجد لأب', member: family.paternalGrandfather },
    { label: 'الجدة لأب', member: family.paternalGrandmother },
    { label: 'الجد لأم', member: family.maternalGrandfather },
    { label: 'الجدة لأم', member: family.maternalGrandmother },
  ];
  return (
    <>
      {fixed.map(({ label, member }) =>
        member?.fullName ? (
          <DefRow
            key={label}
            label={label}
            value={
              <div className="flex flex-col gap-0.5">
                <span>{member.fullName}</span>
                <span className="text-2xs text-ink-500">
                  {member.occupation ?? ''} {member.alive ? '' : '· (متوفى)'}
                </span>
              </div>
            }
          />
        ) : null,
      )}
      {family.siblings && family.siblings.length > 0 && (
        <DefRow
          label="الإخوة والأخوات"
          value={
            <ul className="flex flex-col gap-0.5">
              {family.siblings.map((s, i) => (
                <li key={i} className="text-sm">
                  {s.fullName} {s.occupation ? `· ${s.occupation}` : ''}
                </li>
              ))}
            </ul>
          }
          wide
        />
      )}
    </>
  );
}

function RelativesView({
  family,
  fallbackCount,
}: {
  family: Applicant['family'];
  fallbackCount: number;
}): JSX.Element {
  const relatives = family?.relatives ?? [];
  if (relatives.length === 0) {
    return (
      <DefRow
        label="عدد الأقارب"
        value={`${num(fallbackCount)} قريب (لم تُسجَّل بيانات تفصيلية بعد)`}
        wide
      />
    );
  }
  return (
    <>
      <DefRow
        label="إجمالي الأقارب"
        value={<span className="font-mono">{num(relatives.length)}</span>}
      />
      <DefRow
        label="القائمة"
        value={
          <ul className="flex flex-col gap-1">
            {relatives.map((r, i) => (
              <li key={i} className="text-sm">
                {r.fullName}
                {r.relationshipId && (
                  <span className="ms-1 text-2xs text-ink-500">· {r.relationshipId}</span>
                )}
              </li>
            ))}
          </ul>
        }
        wide
      />
    </>
  );
}
