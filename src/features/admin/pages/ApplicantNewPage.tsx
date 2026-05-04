/**
 * /admin/applicants/new — admin Add Applicant page.
 * Mounts <ApplicantForm /> in "create" mode and routes the user to the new
 * detail page on success. NID-collision detection happens in the service
 * layer; we surface its message inline on the NID field.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PageHeader, toast } from '@/shared/components';
import {
  ApplicantTransitionError,
  useCreateApplicant,
  type ApplicantInput,
} from '@/features/applicants';
import { ROUTES } from '@/config/routes';
import { ApplicantForm } from '@/features/admin/components/applicants/ApplicantForm';

export function ApplicantNewPage(): JSX.Element {
  const navigate = useNavigate();
  const createMut = useCreateApplicant();
  const [nidError, setNidError] = useState<string | null>(null);

  const handleSubmit = async (values: ApplicantInput): Promise<void> => {
    setNidError(null);
    try {
      const created = await createMut.mutateAsync(values);
      toast(`تمت إضافة المتقدم بنجاح · ${created.id}`, 'success');
      navigate(ROUTES.admin.applicantDetail(created.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذر إضافة المتقدم';
      if (err instanceof ApplicantTransitionError && err.code === 409) {
        setNidError(message);
      } else {
        toast(message, 'danger');
      }
    }
  };

  return (
    <>
      <PageHeader
        title="إضافة متقدم جديد"
        subtitle="إنشاء ملف متقدم بكامل بياناته وفقاً لكرّاسة الشروط (RFP §2)"
        breadcrumbs={[
          { label: 'الإدارة', href: '#' + ROUTES.admin.dashboard },
          { label: 'المتقدمون', href: '#' + ROUTES.admin.applicants },
          { label: 'متقدم جديد' },
        ]}
        actions={
          <Link to={ROUTES.admin.applicants} className="btn btn-ghost">
            <ArrowRight size={16} className="rtl:rotate-180" /> الرجوع للقائمة
          </Link>
        }
      />
      <ApplicantForm
        onSubmit={handleSubmit}
        nidServerError={nidError}
        submitLabel={createMut.isPending ? 'جارِ الحفظ…' : 'حفظ المتقدم'}
      />
    </>
  );
}
