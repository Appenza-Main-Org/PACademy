/**
 * ApplicantPortalExamsCard — admin control for an applicant's portal exam outcomes.
 *
 * The admin record only carries the national ID; the portal stores exam results
 * (the "follow-up" pipeline) keyed by the portal applicant GUID. This card bridges
 * the two: it resolves the applicant by national ID (GET /applicant/admin/status/:nid),
 * shows their current per-exam outcome, and lets an admin set any outcome
 * (PUT /applicant/follow-up/:guid).
 *
 * Marking the first exam (القدرات) as «اجتاز» is the gate the backend evaluates to
 * open «وثيقة التعارف» for the applicant, when general-settings ties the document to
 * passing that test.
 *
 * @example
 *   <ApplicantPortalExamsCard nationalId={applicant.nationalId} canEdit={canEdit} />
 */

import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  LoadingState,
  Select,
  toast,
} from '@/shared/components';
import {
  useAdminPortalStatus,
  useUpdateFollowUpMutation,
} from '@/features/applicant-portal';
import type { PipelineState } from '@/shared/types/domain';

/** The six canonical follow-up keys the portal/backend accept. القدرات is exam #1. */
const PORTAL_EXAMS: ReadonlyArray<{ key: string; label: string; isFirst?: boolean }> = [
  { key: 'capacities', label: 'القدرات', isFirst: true },
  { key: 'traits', label: 'السمات (الخارجية / الداخلية / الهيئة / القوام)' },
  { key: 'sports', label: 'اللياقة الرياضية' },
  { key: 'medical', label: 'الكشف الطبي' },
  { key: 'investigation', label: 'التحريات' },
  { key: 'finalResult', label: 'النتيجة النهائية' },
];

const OUTCOME_OPTIONS: ReadonlyArray<{ value: PipelineState; label: string }> = [
  { value: 'pending', label: 'لم يبدأ' },
  { value: 'in-progress', label: 'جارٍ' },
  { value: 'awaiting-approval', label: 'بانتظار الاعتماد' },
  { value: 'passed', label: 'اجتاز' },
  { value: 'failed', label: 'لم يجتز' },
];

const OUTCOME_TONE: Record<PipelineState, 'success' | 'danger' | 'warning' | 'neutral'> = {
  passed: 'success',
  failed: 'danger',
  'in-progress': 'warning',
  'awaiting-approval': 'warning',
  pending: 'neutral',
};

function outcomeLabel(state: PipelineState): string {
  return OUTCOME_OPTIONS.find((o) => o.value === state)?.label ?? state;
}

function readOutcomes(followUp: Record<string, PipelineState> | undefined): Record<string, PipelineState> {
  const next: Record<string, PipelineState> = {};
  for (const exam of PORTAL_EXAMS) next[exam.key] = followUp?.[exam.key] ?? 'pending';
  return next;
}

export function ApplicantPortalExamsCard({
  nationalId,
  canEdit,
}: {
  nationalId: string;
  canEdit: boolean;
}): JSX.Element | null {
  const statusQuery = useAdminPortalStatus(nationalId || null);
  const applicantId = statusQuery.data?.applicantId ?? '';
  const mutation = useUpdateFollowUpMutation(applicantId);

  const [outcomes, setOutcomes] = useState<Record<string, PipelineState>>({});

  // Hydrate the editable outcomes whenever the resolved draft changes.
  useEffect(() => {
    setOutcomes(readOutcomes(statusQuery.data?.draft.followUp));
  }, [statusQuery.data?.applicantId, statusQuery.data?.draft.followUp]);

  if (!nationalId) return null;

  const saved = readOutcomes(statusQuery.data?.draft.followUp);
  const isDirty = PORTAL_EXAMS.some((e) => outcomes[e.key] !== saved[e.key]);

  function persist(patch: Record<string, PipelineState>) {
    mutation.mutate(patch, {
      onSuccess: () => {
        toast('تم تحديث نتائج اختبارات المتقدم', 'success');
        void statusQuery.refetch();
      },
      onError: () => toast('تعذّر تحديث النتائج، حاول مرة أخرى', 'danger'),
    });
  }

  function handleSave() {
    const patch: Record<string, PipelineState> = {};
    for (const exam of PORTAL_EXAMS) {
      if (outcomes[exam.key] !== saved[exam.key]) patch[exam.key] = outcomes[exam.key];
    }
    if (Object.keys(patch).length === 0) return;
    persist(patch);
  }

  function handlePassFirstExam() {
    setOutcomes((prev) => ({ ...prev, capacities: 'passed' }));
    persist({ capacities: 'passed' });
  }

  return (
    <Card>
      <CardHeader
        title="نتائج اختبارات بوابة المتقدم"
        subtitle="تحديث النتائج المسجّلة في بوابة المتقدم — اجتياز اختبار القدرات يفتح وثيقة التعارف"
      />
      <CardBody>
        {statusQuery.isLoading ? (
          <LoadingState variant="list" />
        ) : statusQuery.isError ? (
          <div
            className="rounded-md text-sm text-ink-600"
            style={{ padding: 12, background: 'var(--surface-muted)' }}
          >
            لم يبدأ هذا المتقدم التقديم عبر بوابة المتقدم بعد، فلا توجد نتائج اختبارات لتحديثها.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              {PORTAL_EXAMS.map((exam) => (
                <div
                  key={exam.key}
                  className="flex flex-col gap-2 rounded-md sm:flex-row sm:items-center sm:justify-between"
                  style={{ padding: 12, background: 'var(--surface-muted)' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink-900">{exam.label}</span>
                    {exam.isFirst && <Badge tone="info">الاختبار الأول</Badge>}
                    <Badge tone={OUTCOME_TONE[saved[exam.key]]}>{outcomeLabel(saved[exam.key])}</Badge>
                  </div>
                  <Select
                    options={OUTCOME_OPTIONS}
                    value={outcomes[exam.key] ?? 'pending'}
                    onChange={(e) =>
                      setOutcomes((prev) => ({ ...prev, [exam.key]: e.target.value as PipelineState }))
                    }
                    disabled={!canEdit || mutation.isPending}
                    containerClassName="sm:w-56"
                  />
                </div>
              ))}
            </div>

            {canEdit && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  variant="secondary"
                  leadingIcon={<CheckCircle2 size={16} />}
                  onClick={handlePassFirstExam}
                  disabled={mutation.isPending || saved.capacities === 'passed'}
                >
                  تعيين اجتياز اختبار القدرات
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  disabled={!isDirty || mutation.isPending}
                  isLoading={mutation.isPending}
                >
                  حفظ النتائج
                </Button>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
