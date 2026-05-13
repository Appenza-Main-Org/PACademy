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

export function CommitteeCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const createMut = useCreateCommittee();

  const handleSubmit = (values: CommitteeFormValues): void => {
    createMut.mutate(
      {
        name: values.name,
        head: '',
        type: 'capacities',
        members: 0,
        capacityPerSession: Math.min(values.capacity, 100),
        cycleId: values.cycleId,
        capacity: values.capacity,
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
