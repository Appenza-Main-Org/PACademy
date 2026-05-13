/**
 * CommitteeCreatePage — committee creation flow.
 *
 * Composes CommitteeForm with the basic / فئات المتقدمين / capacity /
 * rules sections. Committee head and assigned officers are no longer
 * captured at create time (they're set elsewhere in the admin workflow).
 */

import { useNavigate } from 'react-router-dom';
import { PageHeader, toast } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { useCreateCommittee } from '../api/committee.queries';
import { CommitteeForm, type CommitteeFormValues } from '../components/CommitteeForm';
import { ROUTES } from '@/config/routes';
import {
  APPLICANT_CATEGORY_KEYS,
  type ApplicantCategoryKey,
} from '@/shared/types/domain';

function isApplicantCategoryKey(v: string): v is ApplicantCategoryKey {
  return (APPLICANT_CATEGORY_KEYS as readonly string[]).includes(v);
}

export function CommitteeCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const createMut = useCreateCommittee();

  const handleSubmit = (values: CommitteeFormValues): void => {
    /* Map the multi-select "فئات المتقدمين" to a single categoryKey for
     * the new shape — first valid entry wins. Falls back to
     * `officers_general` when nothing valid is picked so the type
     * contract is honoured. */
    const firstCategory = values.specializationIds.find(isApplicantCategoryKey);
    const categoryKey: ApplicantCategoryKey = firstCategory ?? 'officers_general';
    const gradeMin = values.rules.gradeFrom ?? 0;
    const gradeMax = values.rules.gradeTo ?? 100;

    createMut.mutate(
      {
        name: values.name,
        head: '',
        type: 'capacities',
        members: 0,
        capacityPerSession: Math.min(values.capacity, 100),
        cycleId: values.cycleId,
        categoryKey,
        capacity: values.capacity,
        gradeType: 'score',
        gradeMin,
        gradeMax,
        academicYearId: values.academicYearId,
        status: values.status,
        specializationIds: values.specializationIds,
        rules: values.rules,
      },
      {
        onSuccess: (committee) => {
          toast(`تم إنشاء لجنة ${committee.name}`, 'success');
          navigate(ROUTES.committee.list);
        },
        onError: (err) => toast((err as Error).message, 'danger'),
      },
    );
  };

  return (
    <CenteredShell>
      <PageHeader
        title="إنشاء لجنة جديدة"
        subtitle="أدخِل بيانات اللجنة، فئات المتقدمين، السعة وشروط التوزيع."
        breadcrumbs={[
          { label: 'لجان القبول', href: ROUTES.committee.list },
          { label: 'إنشاء لجنة' },
        ]}
      />
      <CommitteeForm
        submittingLabel="إنشاء اللجنة"
        isSubmitting={createMut.isPending}
        onCancel={() => navigate(ROUTES.committee.list)}
        onSubmit={handleSubmit}
      />
    </CenteredShell>
  );
}
