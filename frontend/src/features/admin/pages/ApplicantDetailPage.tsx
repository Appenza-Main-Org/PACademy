/**
 * /admin/applicants/:id — restructured admin Applicant detail page.
 *
 * Layout:
 *   • Header card: photo + name + code + current status badge + current stage
 *     chip + primary actions (تعديل · طباعة).
 *   • Two-column body (desktop) / single column (mobile):
 *      - Left: 7 mirrored read-only sections (identity / address / contact /
 *        department / education / family / relatives) each rendered as a <dl>
 *        grid. Section headers anchor the same as the form.
 *      - Right: AuditTimeline + legacy timeline card.
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
  buttonClassName,
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
} from '@/features/applicants';
import { useCycle } from '@/features/admin/api/cycles.queries';
import { useAuthStore } from '@/features/auth';
import { date as fmtDate, num } from '@/shared/lib/format';
import { ROUTES } from '@/config/routes';
import {
  APPLICANT_CATEGORY_KEYS,
  DEPARTMENT_LABELS,
  type Applicant,
  type ApplicantCategoryKey,
  type ApplicantEducation,
  type ApplicantFamilyMember,
} from '@/shared/types/domain';
import { ApplicantPortalExamsCard } from '@/features/admin/components/applicants/ApplicantPortalExamsCard';
import { SECTION_LABELS } from '@/features/applicants/schemas';

function displayValue(value: React.ReactNode | null | undefined): React.ReactNode {
  if (value === undefined || value === null || value === '') return '—';
  return value;
}

function genderLabel(value: Applicant['gender'] | string | undefined): string {
  if (value === 'male' || value === 'ذكر') return 'ذكر';
  if (value === 'female' || value === 'أنثى') return 'أنثى';
  return '—';
}

const CATEGORY_LABELS: Record<string, string> = {
  officers_general: 'قسم عام',
  law_bachelor: 'ليسانس حقوق',
  physical_education_bachelor: 'بكالوريوس تربية رياضية',
  specialized_officers: 'الضباط المتخصصون',
};

function applicantCategoryLabel(applicant: Applicant): string {
  const categoryKey = applicantCategoryKey(applicant);
  if (categoryKey && CATEGORY_LABELS[categoryKey]) return CATEGORY_LABELS[categoryKey];
  if (applicant.department) return DEPARTMENT_LABELS[applicant.department];
  return '—';
}

function applicantCommitteeName(applicant: Applicant): string {
  return applicant.committeeName ?? '—';
}

function applicantCategoryKey(applicant: Applicant): ApplicantCategoryKey | null {
  const categoryKey = (applicant as Applicant & { categoryKey?: string }).categoryKey;
  if (isApplicantCategoryKey(categoryKey)) return categoryKey;
  if (applicant.department === 'lawyers') return 'law_bachelor';
  if (applicant.department === 'masters' || applicant.department === 'doctorate' || applicant.department === 'special') {
    return 'specialized_officers';
  }
  if (applicant.department === 'general_first' || applicant.department === 'general_second') return 'officers_general';
  return null;
}

function isApplicantCategoryKey(value: string | undefined): value is ApplicantCategoryKey {
  return APPLICANT_CATEGORY_KEYS.includes(value as ApplicantCategoryKey);
}

export function ApplicantDetailPage(): JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const { data: applicant, isLoading, error, refetch } = useApplicant(id);
  const cycleQuery = useCycle(applicant?.cycleId ?? null);
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
            <Link to={ROUTES.admin.applicants} className={buttonClassName({ variant: 'secondary' })}>
              العودة إلى القائمة
            </Link>
          </div>
        </CardBody>
      </Card>
    );
  }

  const canEdit = Boolean(user) && user!.role !== 'records_clerk';
  const cycleName = cycleQuery.data?.nameAr ?? (cycleQuery.isLoading ? 'جار التحميل...' : '—');

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
                {applicantCategoryLabel(applicant) !== '—'
                  ? applicantCategoryLabel(applicant)
                  : applicant.certType}
                {' · '}
                <Badge tone="info">{applicant.stageLabel}</Badge>
              </span>
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
                className={buttonClassName({ variant: 'secondary' })}
              >
                <Pencil size={14} strokeWidth={1.75} />
                تعديل البيانات
              </Link>
            )}
            <Button variant="secondary" leadingIcon={<Printer size={16} />}>
              طباعة الملف
            </Button>
            <Link to={ROUTES.admin.applicants} className={buttonClassName({ variant: 'ghost' })}>
              <ArrowRight size={16} className="rtl:rotate-180" /> العودة إلى القائمة
            </Link>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        {/* ── Left rail: mirrored read-only sections ─────────────────── */}
        <div className="flex min-w-0 flex-col gap-5">
          {/* §1 Identity */}
          <SectionCard id="section-identity" title={SECTION_LABELS.identity}>
            <DefRow
              label="معرف جدول المتقدمين"
              value={<span className="font-mono" dir="ltr">{displayValue(applicant.applicantTableId)}</span>}
            />
            <DefRow
              label="معرف سجل الإدارة"
              value={<span className="font-mono" dir="ltr">{displayValue(applicant.adminRecordId ?? applicant.id)}</span>}
            />
            <DefRow label="الاسم رباعي" value={applicant.name} />
            <DefRow
              label="الرقم القومي"
              value={
                <span className="font-mono" dir="ltr">
                  {applicant.nationalId}
                </span>
              }
            />
            <DefRow label="النوع" value={genderLabel(applicant.gender)} />
            <DefRow label="تاريخ الميلاد" value={applicant.birthDate ? fmtDate(applicant.birthDate, 'short') : '—'} />
            <DefRow label="محافظة الميلاد" value={displayValue(applicant.birthGovernorate)} />
            <DefRow label="قسم الميلاد" value={displayValue(applicant.birthDistrict)} />
            <DefRow label="الديانة" value={displayValue(applicant.religion)} />
            <DefRow label="الحالة الاجتماعية" value={displayValue(applicant.maritalStatus)} />
            <DefRow label="مصدر السجل" value={displayValue(applicant.source)} />
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
                applicant.contact?.mobilePhone || applicant.phoneNumber ? (
                  <span className="font-mono" dir="ltr">
                    {applicant.contact?.mobilePhone ?? applicant.phoneNumber}
                  </span>
                ) : (
                  '—'
                )
              }
            />
            <DefRow
              label="البريد الإلكتروني"
              value={applicant.contact?.email ?? applicant.email ?? '—'}
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
              value={applicantCategoryLabel(applicant)}
            />
            <DefRow label="اللجنة" value={applicantCommitteeName(applicant)} />
            <DefRow label="الدورة" value={cycleName} />
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

          {/* Test Results snapshot — legacy aggregate results. Hidden for portal
              applicants, whose authoritative exam outcomes live in the portal card
              below (the legacy fields are empty for them and read as misleading). */}
          {applicant.source !== 'applicant-portal' && (
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
          )}

          {/* Portal exam outcomes — admin-editable (gates وثيقة التعارف) */}
          <ApplicantPortalExamsCard
            applicantId={id}
            canEdit={canEdit}
            categoryKey={applicantCategoryKey(applicant)}
            cycleId={applicant.cycleId ?? null}
          />

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

        {/* ── Right rail: audit and timeline ───────────────────────────── */}
        <div className="flex flex-col gap-5">
          <LegacyTimelineCard applicantId={id} />
        </div>
      </div>
    </>
  );
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
      <dd className="break-words text-sm text-ink-900">{value}</dd>
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

  const educationRecord = education as EducationRecord;
  const consumedKeys = new Set<string>(['kind']);
  const secondaryRecord = isEducationRecord(educationRecord.secondary)
    ? educationRecord.secondary
    : undefined;
  const isUniversityQualification = education.kind === 'higher' || hasAnyEducationValue(educationRecord, UNIVERSITY_FIELD_KEYS);
  const isSecondaryQualification =
    education.kind !== 'higher'
    || Boolean(secondaryRecord)
    || hasAnyEducationValue(educationRecord, SECONDARY_FIELD_KEYS);

  return (
    <>
      {isSecondaryQualification && (
        <EducationFieldGroup
          title={isUniversityQualification ? 'بيانات الثانوية' : undefined}
          rows={secondaryEducationRows(educationRecord, secondaryRecord, fallback, consumedKeys)}
        />
      )}
      {isUniversityQualification && (
        <EducationFieldGroup
          title="بيانات المؤهل الجامعي"
          rows={universityEducationRows(educationRecord, fallback, consumedKeys)}
        />
      )}
      <EducationFieldGroup
        title="مؤهلات إضافية"
        rows={extraEducationRows(educationRecord, consumedKeys)}
      />
    </>
  );
}

type EducationRecord = Record<string, unknown>;

type EducationRow = {
  label: string;
  value: React.ReactNode;
  wide?: boolean;
};

type EducationFieldSpec = {
  label: string;
  keys: readonly string[];
  fallback?: unknown;
  formatter?: (value: unknown) => React.ReactNode;
};

const SECONDARY_FIELD_KEYS = [
  'certificateName',
  'thanawiType',
  'schoolName',
  'schoolNameAr',
  'schoolAddress',
  'graduationYear',
  'thanawiGradDate',
  'totalScore',
  'thanawiTotal',
  'percentage',
  'thanawiPercentage',
  'grade',
  'thanawiGrade',
] as const;

const UNIVERSITY_FIELD_KEYS = [
  'qualificationLevel',
  'academicDegree',
  'degree',
  'bachelorFaculty',
  'faculty',
  'bachelorUniversity',
  'university',
  'bachelorSpecialization',
  'specialization',
  'bachelorGrade',
  'bachelorYear',
  'bachelorPercentage',
] as const;

const EDUCATION_EXTRA_LABELS: Record<string, string> = {
  seatType: 'نوع الجلوس',
  branch: 'الشعبة',
  schoolCategory: 'فئة المدرسة',
  country: 'دولة الدراسة',
  thanawiCountry: 'دولة المدرسة',
  thanawiGradDate: 'تاريخ الحصول على الشهادة',
  higherSpecialization: 'تخصص المؤهل الأعلى',
  postgradDegree: 'درجة الماجستير',
  postgradSpecialization: 'تخصص الماجستير',
  postgradUniversity: 'جامعة الماجستير',
  postgradYear: 'سنة الحصول على الماجستير',
  postgradGrade: 'تقدير الماجستير',
  doctorateYear: 'سنة الحصول على الدكتوراه',
  doctorateGrade: 'تقدير الدكتوراه',
};

function isEducationRecord(candidate: unknown): candidate is EducationRecord {
  return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate);
}

function hasSubmittedEducationValue(candidate: unknown): boolean {
  return candidate !== undefined && candidate !== null && candidate !== '';
}

function hasAnyEducationValue(record: EducationRecord, keys: readonly string[]): boolean {
  return keys.some((key) => hasSubmittedEducationValue(record[key]));
}

function educationValue(record: EducationRecord, keys: readonly string[]): unknown {
  return keys.map((key) => record[key]).find(hasSubmittedEducationValue);
}

function markConsumed(consumedKeys: Set<string>, keys: readonly string[], namespace?: string): void {
  for (const key of keys) {
    consumedKeys.add(namespace ? `${namespace}.${key}` : key);
  }
}

function formattedEducationValue(submittedField: unknown): React.ReactNode {
  if (!hasSubmittedEducationValue(submittedField)) return '—';
  if (typeof submittedField === 'number') return <span className="font-mono">{num(submittedField)}</span>;
  if (typeof submittedField === 'boolean') return submittedField ? 'نعم' : 'لا';
  return String(submittedField);
}

function percentageValue(submittedPercent: unknown): React.ReactNode {
  if (!hasSubmittedEducationValue(submittedPercent)) return '—';
  const text = typeof submittedPercent === 'number' ? num(submittedPercent) : String(submittedPercent);
  return <span className="font-mono">{text.includes('%') ? text : `${text}%`}</span>;
}

function educationRowsFromSpecs(
  record: EducationRecord,
  specs: readonly EducationFieldSpec[],
  consumedKeys: Set<string>,
  namespace?: string,
): EducationRow[] {
  return specs.map((spec) => {
    const submittedField = educationValue(record, spec.keys) ?? spec.fallback;
    markConsumed(consumedKeys, spec.keys, namespace);
    return {
      label: spec.label,
      value: spec.formatter ? spec.formatter(submittedField) : formattedEducationValue(submittedField),
    };
  });
}

function secondaryEducationRows(
  record: EducationRecord,
  secondaryRecord: EducationRecord | undefined,
  fallback: Applicant,
  consumedKeys: Set<string>,
): EducationRow[] {
  const secondarySpecs: EducationFieldSpec[] = [
    { label: 'نوع الشهادة', keys: ['certificateName', 'thanawiType'], fallback: fallback.certType },
    { label: 'اسم المدرسة', keys: ['schoolName', 'schoolNameAr'] },
    { label: 'عنوان المدرسة', keys: ['schoolAddress', 'region'] },
    { label: 'سنة التخرج', keys: ['graduationYear', 'thanawiGradDate'], fallback: fallback.certYear },
    { label: 'المجموع', keys: ['totalScore', 'thanawiTotal'], fallback: fallback.certScore, formatter: formattedEducationValue },
    { label: 'النسبة المئوية', keys: ['percentage', 'thanawiPercentage'], fallback: fallback.certPercent, formatter: percentageValue },
    { label: 'التقدير', keys: ['grade', 'thanawiGrade'] },
  ];
  const source = secondaryRecord ?? record;
  const rows = educationRowsFromSpecs(
    source,
    secondarySpecs,
    consumedKeys,
    secondaryRecord ? 'secondary' : undefined,
  );
  if (secondaryRecord) consumedKeys.add('secondary');
  return rows;
}

function universityEducationRows(
  record: EducationRecord,
  fallback: Applicant,
  consumedKeys: Set<string>,
): EducationRow[] {
  const universitySpecs: EducationFieldSpec[] = [
    {
      label: 'المؤهل / الدرجة العلمية',
      keys: ['qualificationLevel', 'academicDegree', 'degree'],
      fallback: applicantCategoryLabel(fallback),
    },
    { label: 'الكلية', keys: ['faculty', 'bachelorFaculty'] },
    { label: 'الجامعة', keys: ['university', 'bachelorUniversity'] },
    { label: 'التخصص', keys: ['specialization', 'bachelorSpecialization'] },
    { label: 'التقدير العام', keys: ['grade', 'bachelorGrade', 'generalGrade'] },
    { label: 'سنة التخرج', keys: ['graduationYear', 'bachelorYear'] },
    { label: 'المجموع', keys: ['totalScore', 'bachelorTotal'], formatter: formattedEducationValue },
    { label: 'النسبة المئوية', keys: ['percentage', 'bachelorPercentage'], formatter: percentageValue },
  ];
  return educationRowsFromSpecs(record, universitySpecs, consumedKeys);
}

function extraEducationRows(record: EducationRecord, consumedKeys: Set<string>): EducationRow[] {
  return Object.entries(record)
    .filter(([key, submittedField]) => (
      key !== 'secondary'
      && !consumedKeys.has(key)
      && hasSubmittedEducationValue(submittedField)
    ))
    .flatMap(([key, submittedField]) => {
      if (isEducationRecord(submittedField)) {
        return Object.entries(submittedField)
          .filter(([childKey, childField]) => (
            !consumedKeys.has(`${key}.${childKey}`)
            && hasSubmittedEducationValue(childField)
          ))
          .map(([childKey, childField]) => ({
            label: EDUCATION_EXTRA_LABELS[childKey] ?? childKey,
            value: formattedEducationValue(childField),
          }));
      }
      return [{
        label: EDUCATION_EXTRA_LABELS[key] ?? key,
        value: formattedEducationValue(submittedField),
      }];
    });
}

function EducationFieldGroup({
  title,
  rows,
}: {
  title?: string;
  rows: EducationRow[];
}): JSX.Element | null {
  if (rows.length === 0) return null;
  return (
    <>
      {title && (
        <div className="md:col-span-2">
          <div className="text-2xs font-bold uppercase tracking-wide text-ink-500">{title}</div>
        </div>
      )}
      {rows.map((row) => (
        <DefRow key={`${title ?? 'education'}-${row.label}`} label={row.label} value={row.value} wide={row.wide} />
      ))}
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
  if (!family) {
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
    { label: 'ولي الأمر', member: family.guardian },
  ];
  const hasDetailedMembers =
    fixed.some(({ member }) => Boolean(member?.fullName))
    || Boolean(family.fatherWives?.length)
    || Boolean(family.motherHusbands?.length)
    || Boolean(family.siblings?.length);
  if (!hasDetailedMembers) {
    return (
      <DefRow
        label="حجم الأسرة"
        value={`${num(fallbackSize)} أفراد (لم تُسجَّل بيانات تفصيلية بعد)`}
        wide
      />
    );
  }
  return (
    <>
      {fixed.map(({ label, member }) =>
        member?.fullName ? (
          <DefRow
            key={label}
            label={label}
            value={<FamilyMemberSummary member={member} />}
          />
        ) : null,
      )}
      {family.fatherWives && family.fatherWives.length > 0 && (
        <FamilyMembersList label="زوجات الأب" members={family.fatherWives} />
      )}
      {family.motherHusbands && family.motherHusbands.length > 0 && (
        <FamilyMembersList label="أزواج الأم" members={family.motherHusbands} />
      )}
      {family.siblings && family.siblings.length > 0 && (
        <FamilyMembersList label="الإخوة والأخوات" members={family.siblings} />
      )}
    </>
  );
}

function FamilyMemberSummary({ member }: { member: ApplicantFamilyMember }): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <span>{member.fullName}</span>
      {member.nationalId && (
        <span className="font-mono text-2xs text-ink-500" dir="ltr">
          {member.nationalId}
        </span>
      )}
      <span className="text-2xs text-ink-500">
        {[member.relationshipId, member.occupation, member.education, member.governorate]
          .filter(Boolean)
          .join(' · ') || '—'}
        {member.alive ? '' : ' · (متوفى)'}
      </span>
    </div>
  );
}

function FamilyMembersList({
  label,
  members,
}: {
  label: string;
  members: ApplicantFamilyMember[];
}): JSX.Element {
  return (
    <DefRow
      label={label}
      value={
        <ul className="flex flex-col gap-2">
          {members.map((member, i) => (
            <li key={`${member.fullName}-${i}`} className="text-sm">
              <FamilyMemberSummary member={member} />
            </li>
          ))}
        </ul>
      }
      wide
    />
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
                <FamilyMemberSummary member={r} />
              </li>
            ))}
          </ul>
        }
        wide
      />
    </>
  );
}
