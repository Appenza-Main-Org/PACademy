/**
 * CommitteeCreatePage — full-form committee creation flow.
 *
 * Composes CommitteeForm with the basic / head / officers /
 * specializations / capacity / rules sections per the admin module spec.
 */

import { useNavigate } from 'react-router-dom';
import { PageHeader, toast } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { useCreateCommittee, useEligibleOfficers } from '../api/committee.queries';
import { CommitteeForm, type CommitteeFormValues } from '../components/CommitteeForm';
import { ROUTES } from '@/config/routes';

export function CommitteeCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const createMut = useCreateCommittee();
  const { data: officers = [] } = useEligibleOfficers();

  const handleSubmit = (values: CommitteeFormValues): void => {
    const headLabel = officers.find((o) => o.id === values.headUserId)?.name ?? values.headUserId;
    createMut.mutate(
      {
        name: values.name,
        head: headLabel,
        type: 'capacities',
        members: values.officerIds.length,
        capacityPerSession: Math.min(values.capacity, 100),
        cycleId: values.cycleId,
        headUserId: values.headUserId,
        capacity: values.capacity,
        academicYearId: values.academicYearId,
        status: values.status,
        specializationIds: values.specializationIds,
        officerIds: values.officerIds,
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
        subtitle="أدخِل بيانات اللجنة، رئيسها، الأعضاء، التخصصات، السعة وشروط التوزيع."
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
