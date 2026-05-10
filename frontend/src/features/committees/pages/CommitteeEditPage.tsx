/**
 * CommitteeEditPage — update an existing committee's basic info,
 * officers, specializations, capacity, and rules.
 */

import { useNavigate, useParams } from 'react-router-dom';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  toast,
} from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import {
  useCommittee,
  useCommitteeUpdate,
  useEligibleOfficers,
} from '../api/committee.queries';
import { CommitteeForm, type CommitteeFormValues } from '../components/CommitteeForm';
import { ROUTES } from '@/config/routes';

export function CommitteeEditPage(): JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: committee, isLoading, error, refetch } = useCommittee(id);
  const { data: officers = [] } = useEligibleOfficers();
  const updateMut = useCommitteeUpdate();

  if (isLoading) return <CenteredShell><LoadingState variant="page" /></CenteredShell>;
  if (error) return <CenteredShell><ErrorState error={error} onRetry={() => refetch()} /></CenteredShell>;
  if (!committee) {
    return <CenteredShell><EmptyState variant="generic" title="اللجنة غير موجودة" /></CenteredShell>;
  }

  const handleSubmit = (values: CommitteeFormValues): void => {
    const headLabel = officers.find((o) => o.id === values.headUserId)?.name ?? committee.head;
    updateMut.mutate(
      {
        id: committee.id,
        patch: {
          name: values.name,
          head: headLabel,
          headUserId: values.headUserId,
          members: values.officerIds.length,
          capacity: values.capacity,
          capacityPerDay: Math.min(values.capacity, 100),
          academicYearId: values.academicYearId,
          status: values.status,
          specializationIds: values.specializationIds,
          officerIds: values.officerIds,
          rules: values.rules,
          linkedCycleId: values.cycleId,
        },
      },
      {
        onSuccess: () => {
          toast(`تم تحديث "${values.name}"`, 'success');
          navigate(ROUTES.committee.detail(committee.id));
        },
        onError: (err) => toast((err as Error).message, 'danger'),
      },
    );
  };

  return (
    <CenteredShell>
      <PageHeader
        title={`تعديل: ${committee.name}`}
        subtitle="حدّث بيانات اللجنة، الضباط، التخصصات، السعة وشروط التوزيع."
        breadcrumbs={[
          { label: 'لجان القبول', href: ROUTES.committee.list },
          { label: committee.name, href: ROUTES.committee.detail(committee.id) },
          { label: 'تعديل' },
        ]}
      />
      <CommitteeForm
        initial={committee}
        submittingLabel="حفظ التعديلات"
        isSubmitting={updateMut.isPending}
        onCancel={() => navigate(ROUTES.committee.detail(committee.id))}
        onSubmit={handleSubmit}
      />
    </CenteredShell>
  );
}
