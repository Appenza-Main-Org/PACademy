/**
 * ApplicantCategoryDetailPage — `/admin/lookups/applicant-categories/:id`.
 *
 * Read-only view of a single applicant-categories lookup row. Mirrors the
 * full ApplicantCategoryRow shape: identifiers, scope (gender + stage),
 * faculty/specialization mapping, description, openness flag, eligibility
 * conditions, required-tests roster, and procedures.
 *
 * Patterns lifted from CycleDetailPage — CenteredShell + PageHeader +
 * Card sections with a small Field row component. The `:id` path param
 * matches the row's `code` (e.g. `officers_general`).
 */

import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { MOCK } from '@/shared/mock-data';
import { useLookup } from '../api/lookups.queries';
import type {
  ApplicantCategoryRow,
  FacultyRow,
  SpecializationRow,
  SubmissionTypeRow,
} from '../types';
import { GRADING_MODE_LABELS_AR } from '../lib/gradingModes';
import { readGradingMode } from '../lib/submissionType';
import type { CategoryCondition, RequiredTestKind } from '@/shared/types/domain';

const STAGE_LABEL: Record<ApplicantCategoryRow['type'], string> = {
  pre_university: 'ثانوي',
  university: 'جامعي',
};

const GENDER_LABEL: Record<'male' | 'female', string> = {
  male: 'ذكور',
  female: 'إناث',
};

const REQUIRED_TEST_LABEL: Record<RequiredTestKind, string> = {
  aptitude: 'القدرات',
  posture: 'القوام',
  medical: 'الكشف الطبي',
  physical: 'اللياقة البدنية',
  psychological: 'الاختبار النفسي',
  interview: 'المقابلة الشخصية',
  drug: 'الكشف عن المخدرات',
  security_review: 'الفحص الأمني',
  tactical_training: 'تدريب تكتيكي',
  security_training: 'تدريب أمني',
  specialized_courses: 'دورات متخصصة',
};

const QUALIFICATION_LABEL: Record<CategoryCondition['requiredQualification'], string> = {
  thanaweya_amma: 'الثانوية العامة',
  azhar: 'الثانوية الأزهرية',
  bachelor: 'بكالوريوس',
  bachelor_law: 'ليسانس حقوق',
  bachelor_medicine: 'بكالوريوس طب',
  bachelor_engineering: 'بكالوريوس هندسة',
  bachelor_media: 'بكالوريوس إعلام',
  police_academy_grad: 'خريج كلية الشرطة',
  serving_officer: 'ضابط حالي',
  any: 'أي مؤهل',
};

const MARITAL_LABEL: Record<CategoryCondition['maritalStatus'], string> = {
  single: 'أعزب',
  any: 'بدون قيد',
};

const COND_GENDER_LABEL: Record<CategoryCondition['gender'], string> = {
  male: 'ذكر',
  female: 'أنثى',
  any: 'الكل',
};

interface FieldProps {
  label: string;
  value: React.ReactNode;
  span?: 'full' | 'half';
}

function Field({ label, value, span = 'half' }: FieldProps): JSX.Element {
  return (
    <div className={`flex flex-col gap-1 ${span === 'full' ? 'md:col-span-2' : ''}`}>
      <span className="text-2xs uppercase tracking-wide text-ink-500">{label}</span>
      <span className="text-sm text-ink-900">{value}</span>
    </div>
  );
}

function Dash(): JSX.Element {
  return <span className="text-ink-400">—</span>;
}

function YesNo({ value }: { value: boolean }): JSX.Element {
  return value ? (
    <Badge tone="success">نعم</Badge>
  ) : (
    <Badge tone="neutral">لا</Badge>
  );
}

function labelByCode<T extends { code: string; name: string }>(
  rows: readonly T[],
  code: string,
): string {
  return rows.find((r) => r.code === code)?.name ?? code;
}

function readSubmissionTypeCode(row: ApplicantCategoryRow): string | null {
  const meta = row.metadata;
  if (meta && typeof meta === 'object' && 'submissionTypeCode' in meta) {
    const v = (meta as { submissionTypeCode?: unknown }).submissionTypeCode;
    return typeof v === 'string' ? v : null;
  }
  return null;
}

export function ApplicantCategoryDetailPage(): JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useLookup('applicant-categories');

  const row = useMemo(
    () => (data ?? []).find((c) => c.code === id) ?? null,
    [data, id],
  );

  if (isLoading) {
    return (
      <CenteredShell>
        <LoadingState variant="page" />
      </CenteredShell>
    );
  }
  if (error) {
    return (
      <CenteredShell>
        <ErrorState error={error} onRetry={() => refetch()} />
      </CenteredShell>
    );
  }
  if (!row) {
    return (
      <CenteredShell>
        <EmptyState
          variant="generic"
          title="الفئة غير موجودة"
          description="تأكد من الرابط أو ارجع إلى قائمة الفئات."
          action={
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<ArrowRight size={14} strokeWidth={1.75} />}
              onClick={() =>
                navigate(ROUTES.admin.adminLookupsType('applicant-categories'))
              }
            >
              العودة إلى الفئات
            </Button>
          }
        />
      </CenteredShell>
    );
  }

  const faculties = MOCK.lookups.faculties as FacultyRow[];
  const specializations = MOCK.lookups.specializations as SpecializationRow[];
  const submissionTypes = MOCK.lookups['submission-types'] as SubmissionTypeRow[];

  const submissionCode = readSubmissionTypeCode(row);
  const submissionRow = submissionCode
    ? submissionTypes.find((s) => s.code === submissionCode) ?? null
    : null;
  const gradingMode = submissionRow ? readGradingMode(submissionRow) : null;

  const orderedTests = [...row.requiredTests].sort((a, b) => a.order - b.order);
  const cond = row.conditions;

  return (
    <CenteredShell>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            {row.name}
            <Badge tone={row.isActive ? 'success' : 'neutral'}>
              {row.isActive ? 'نشط' : 'غير نشط'}
            </Badge>
            {row.isOpen ? (
              <Badge tone="info">مفتوحة للتقديم</Badge>
            ) : (
              <Badge tone="neutral">مغلقة</Badge>
            )}
          </span>
        }
        subtitle={row.description || undefined}
        breadcrumbs={[
          { label: 'الإدارة', href: ROUTES.admin.dashboard },
          { label: 'الأكواد المرجعية', href: ROUTES.admin.adminLookups },
          {
            label: 'فئات المتقدمين',
            href: ROUTES.admin.adminLookupsType('applicant-categories'),
          },
          { label: row.name },
        ]}
      />

      <div className="flex flex-col gap-4">
        {/* Identifiers + bilingual labels */}
        <Card>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="الاسم (عربي)" value={row.name} />
            <Field label="الاسم (إنجليزي)" value={row.nameEn || <Dash />} />
            <Field
              label="الكود"
              value={
                <span className="font-mono text-xs text-ink-700" dir="ltr">
                  {row.code}
                </span>
              }
            />
            <Field
              label="نوع التقديم"
              value={
                submissionRow ? (
                  <span className="inline-flex items-center gap-2">
                    <span>{submissionRow.name}</span>
                    {gradingMode && (
                      <Badge tone={gradingMode === 'GRADES' ? 'info' : 'accent'}>
                        {GRADING_MODE_LABELS_AR[gradingMode]}
                      </Badge>
                    )}
                  </span>
                ) : (
                  <Dash />
                )
              }
            />
          </div>
        </Card>

        {/* Scope: gender + stage */}
        <Card>
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="نطاق النوع"
              value={
                row.genderScope.length === 0 ? (
                  <Dash />
                ) : (
                  <span className="inline-flex flex-wrap items-center gap-1">
                    {row.genderScope.map((g) => (
                      <Badge key={g} tone={g === 'male' ? 'info' : 'accent'}>
                        {GENDER_LABEL[g]}
                      </Badge>
                    ))}
                  </span>
                )
              }
            />
            <Field
              label="مرحلة الالتحاق"
              value={
                <Badge tone={row.type === 'university' ? 'info' : 'neutral'}>
                  {STAGE_LABEL[row.type]}
                </Badge>
              }
            />
          </div>
        </Card>

        {/* Faculty + specialization mapping */}
        <Card>
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="الكليات المؤهلة"
              value={
                row.facultyCodes.length === 0 ? (
                  <Dash />
                ) : (
                  <span className="inline-flex flex-wrap items-center gap-1">
                    {row.facultyCodes.map((c) => (
                      <Badge key={c} tone="neutral">
                        {labelByCode(faculties, c)}
                      </Badge>
                    ))}
                  </span>
                )
              }
            />
            <Field
              label="التخصصات المؤهلة"
              value={
                row.specializationCodes.length === 0 ? (
                  <span className="text-ink-500">الكل</span>
                ) : (
                  <span className="inline-flex flex-wrap items-center gap-1">
                    {row.specializationCodes.map((c) => (
                      <Badge key={c} tone="accent">
                        {labelByCode(specializations, c)}
                      </Badge>
                    ))}
                  </span>
                )
              }
            />
          </div>
        </Card>

        {/* Eligibility conditions — singular CategoryCondition */}
        <Card>
          <h2 className="mb-4 font-ar-display text-md font-bold text-ink-900">
            شروط الأهلية
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="السن (من — إلى)"
              value={
                cond.ageMin === null && cond.ageMax === null ? (
                  <Dash />
                ) : (
                  <span className="font-numeric tnum" dir="ltr">
                    {cond.ageMin ?? '—'} → {cond.ageMax ?? '—'}
                  </span>
                )
              }
            />
            <Field
              label="الحد الأدنى للنسبة"
              value={
                cond.minScorePercent === null ? (
                  <Dash />
                ) : (
                  <span className="font-numeric tnum" dir="ltr">
                    {cond.minScorePercent}%
                  </span>
                )
              }
            />
            <Field
              label="المؤهل المطلوب"
              value={QUALIFICATION_LABEL[cond.requiredQualification]}
            />
            <Field label="النوع" value={COND_GENDER_LABEL[cond.gender]} />
            <Field
              label="الحد الأدنى للطول"
              value={
                cond.minHeightCm === null ? (
                  <Dash />
                ) : (
                  <span className="font-numeric tnum" dir="ltr">
                    {cond.minHeightCm} سم
                  </span>
                )
              }
            />
            <Field label="الحالة الاجتماعية" value={MARITAL_LABEL[cond.maritalStatus]} />
            <Field label="الكشف الطبي مطلوب" value={<YesNo value={cond.medicalRequired} />} />
            <Field label="فحص حسن السير والسلوك" value={<YesNo value={cond.conductCheck} />} />
            <Field
              label="الجنسية المصرية مطلوبة"
              value={<YesNo value={cond.egyptianNationalityRequired} />}
            />
            <Field
              label="موافقة جهة العمل مطلوبة"
              value={<YesNo value={cond.employerApprovalRequired} />}
            />
            <Field label="بالترشيح فقط" value={<YesNo value={cond.nominationOnly} />} />
            <Field
              label="شروط إضافية"
              span="full"
              value={
                cond.freeText.length === 0 ? (
                  <Dash />
                ) : (
                  <ul className="ms-5 list-disc space-y-1">
                    {cond.freeText.map((t, idx) => (
                      <li key={`${idx}-${t}`} className="text-sm text-ink-900">
                        {t}
                      </li>
                    ))}
                  </ul>
                )
              }
            />
          </div>
        </Card>

        {/* Required tests roster */}
        <Card>
          <h2 className="mb-4 font-ar-display text-md font-bold text-ink-900">
            الاختبارات المطلوبة
          </h2>
          {orderedTests.length === 0 ? (
            <Dash />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-2xs uppercase tracking-wide text-ink-500">
                    <th className="py-2 ps-2 pe-3 text-start font-medium">الترتيب</th>
                    <th className="py-2 px-3 text-start font-medium">الاختبار</th>
                    <th className="py-2 ps-3 pe-2 text-start font-medium">معيار النجاح</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedTests.map((t) => (
                    <tr key={`${t.kind}-${t.order}`} className="border-b border-border-subtle/60">
                      <td className="py-2 ps-2 pe-3 font-numeric tnum text-ink-700" dir="ltr">
                        {t.order}
                      </td>
                      <td className="py-2 px-3 text-ink-900">
                        {REQUIRED_TEST_LABEL[t.kind]}
                      </td>
                      <td className="py-2 ps-3 pe-2 text-ink-700">
                        {t.passingCriteria.trim() ? t.passingCriteria : <Dash />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Procedures */}
        <Card>
          <h2 className="mb-4 font-ar-display text-md font-bold text-ink-900">
            الإجراءات
          </h2>
          {row.procedures.length === 0 ? (
            <Dash />
          ) : (
            <ol className="ms-5 list-decimal space-y-1">
              {row.procedures.map((p, idx) => (
                <li key={`${idx}-${p}`} className="text-sm text-ink-900">
                  {p}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </CenteredShell>
  );
}
