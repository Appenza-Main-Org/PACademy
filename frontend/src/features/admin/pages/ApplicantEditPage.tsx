/**
 * /admin/applicants/:id/edit — admin Edit Applicant page.
 * Reuses <ApplicantForm /> in "edit" mode (initialValues prefilled from
 * useApplicant). Locked-fields rules (RFP §2 page 39):
 *   - status === 'on-hold'                 → fully read-only banner
 *   - attendanceCardPrintedAt set          → personal + academic locked
 *   - National ID always locked post-creation (form enforces via prop)
 */

import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  ErrorState,
  LoadingState,
  PageHeader,
  buttonClassName,
  toast,
} from '@/shared/components';
import {
  useApplicant,
  useUpdateApplicant,
  type ApplicantInput,
} from '@/features/applicants';
import { ROUTES } from '@/config/routes';
import type { Applicant, ApplicantEducation } from '@/shared/types/domain';
import { ApplicantForm } from '@/features/admin/components/applicants/ApplicantForm';
import { isValidationError } from '@/shared/lib/errors';

function applicantToInput(a: Applicant): Partial<ApplicantInput> {
  /* Reverse the inputToApplicant() mapping. Falls back to plausible defaults
   * for legacy seed rows that lack extended fields. */
  const fullName = a.fullName ?? namePartsFromString(a.name);
  const education: ApplicantEducation =
    a.education ??
    {
      kind: 'general',
      certificateName: a.certType,
      schoolName: '',
      totalScore: a.certScore,
      branch: (['علمي علوم', 'علمي رياضة', 'أدبي'] as const).includes(
        a.certSection as 'علمي علوم' | 'علمي رياضة' | 'أدبي',
      )
        ? (a.certSection as 'علمي علوم' | 'علمي رياضة' | 'أدبي')
        : 'علمي علوم',
      schoolCategory: '',
      graduationYear: a.certYear,
      percentage: Number(a.certPercent) || 0,
    };
  return {
    nationalId: a.nationalId,
    fullName,
    religion: a.religion ?? 'مسلم',
    maritalStatus: a.maritalStatus ?? 'أعزب',
    currentAddress: a.currentAddress ?? {
      governorate: a.governorate,
      city: a.city,
      detail: '',
      street: '',
    },
    contact: a.contact ?? {
      mobilePhone: '',
      homePhone: '',
      email: '',
      socialFacebook: '',
      socialInstagram: '',
      socialX: '',
      socialOther: '',
    },
    department: a.department ?? 'general_first',
    cycleId: a.cycleId,
    education,
    family: {
      father: a.family?.father,
      mother: a.family?.mother,
      paternalGrandfather: a.family?.paternalGrandfather,
      paternalGrandmother: a.family?.paternalGrandmother,
      maternalGrandfather: a.family?.maternalGrandfather,
      maternalGrandmother: a.family?.maternalGrandmother,
      siblings: a.family?.siblings ?? [],
      relatives: (a.family?.relatives ?? []).map((r) => ({
        ...r,
        relationshipId: r.relationshipId ?? '',
      })),
    },
  };
}

function namePartsFromString(name: string): ApplicantInput['fullName'] {
  const parts = name.split(/\s+/).filter(Boolean);
  return {
    first: parts[0] ?? '',
    second: parts[1] ?? '',
    third: parts[2] ?? '',
    fourth: parts.slice(3).join(' '),
  };
}

export function ApplicantEditPage(): JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: applicant, isLoading, error } = useApplicant(id);
  const updateMut = useUpdateApplicant();

  const initialValues = useMemo(
    () => (applicant ? applicantToInput(applicant) : undefined),
    [applicant],
  );

  if (isLoading) return <LoadingState variant="detail" />;
  if (error) return <ErrorState error={error as Error} />;
  if (!applicant) {
    return (
      <ErrorState
        title="لم يُعثر على المتقدم"
        description={`الكود "${id}" غير موجود في قاعدة البيانات.`}
      />
    );
  }

  const fullyLocked = applicant.status === 'on-hold';
  const personalAcademicLocked = Boolean(applicant.attendanceCardPrintedAt);

  const handleSubmit = async (values: ApplicantInput): Promise<void> => {
    try {
      await updateMut.mutateAsync({ id, patch: values });
      toast('تم حفظ التعديلات بنجاح', 'success');
      navigate(ROUTES.admin.applicantDetail(id));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذر حفظ التعديلات';
      toast(message, 'danger');
      if (isValidationError(err)) throw err;
    }
  };

  return (
    <>
      <PageHeader
        title={`تعديل بيانات ${applicant.name}`}
        subtitle={`كود التقدم: ${id}`}
        breadcrumbs={[
          { label: 'الإدارة', href: '#' + ROUTES.admin.dashboard },
          { label: 'المتقدمون', href: '#' + ROUTES.admin.applicants },
          { label: applicant.id, href: '#' + ROUTES.admin.applicantDetail(id) },
          { label: 'تعديل' },
        ]}
        actions={
          <Link
            to={ROUTES.admin.applicantDetail(id)}
            className={buttonClassName({ variant: 'ghost' })}
          >
            <ArrowRight size={16} className="rtl:rotate-180" /> العودة إلى ملف المتقدم
          </Link>
        }
      />
      <ApplicantForm
        initialValues={initialValues}
        fullyLocked={fullyLocked}
        personalAcademicLocked={personalAcademicLocked}
        submitLabel={updateMut.isPending ? 'جارِ الحفظ…' : 'حفظ التعديلات'}
        onSubmit={handleSubmit}
        autosaveKey={null}
      />
    </>
  );
}
