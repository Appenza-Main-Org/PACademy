/**
 * ApplicantPortalExamsCard — admin control for an applicant's portal exam outcomes.
 *
 * Exam results (the portal "follow-up" pipeline) live in the shared portal draft row,
 * keyed by the cycle test CODE (TST-01 … TST-15 — the same codes Stage 10 and the
 * وثيقة التعارف gate read). The admin frontend is authenticated against the ADMIN API
 * (not the applicant API), so this card reads/writes through the admin backend:
 *   GET  /api/applicants/:id/follow-up  → { applicantId, hasPortalRecord, followUp }
 *   PUT  /api/applicants/:id/follow-up  → merges the supplied { code: outcome } map.
 *
 * The exam that opens «وثيقة التعارف» is whichever test the admission settings name as
 * the entry test (acquaintanceDocumentsEntryResponsibleTestCode); that row is flagged,
 * and a one-click action marks it «اجتاز» so the document opens for the applicant.
 *
 * @example
 *   <ApplicantPortalExamsCard applicantId={id} canEdit={canEdit} />
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
import { useLookup } from '@/features/lookups';
import { useAdminSettings } from '../../api/settings.queries';
import type { PipelineState } from '@/shared/types/domain';

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

function outcomeOf(map: Record<string, PipelineState> | undefined, code: string): PipelineState {
  return map?.[code] ?? 'pending';
}

export function ApplicantPortalExamsCard({
  applicantId,
  canEdit,
}: {
  applicantId: string;
  canEdit: boolean;
}): JSX.Element | null {
  const statusQuery = useAdminPortalStatus(applicantId || null);
  const testsQuery = useLookup('tests');
  const settingsQuery = useAdminSettings();
  const mutation = useUpdateFollowUpMutation(applicantId);

  const [outcomes, setOutcomes] = useState<Record<string, PipelineState>>({});

  // Hydrate the editable outcomes whenever the resolved follow-up changes.
  useEffect(() => {
    setOutcomes({ ...(statusQuery.data?.followUp ?? {}) });
  }, [statusQuery.data?.applicantId, statusQuery.data?.followUp]);

  if (!applicantId) return null;

  const exams = (testsQuery.data ?? [])
    .filter((t) => t.isActive)
    .slice()
    .sort((a, b) => a.order - b.order);
  const openingTestCode = settingsQuery.data?.acquaintanceDocumentsEntryResponsibleTestCode ?? '';
  const openingExam = exams.find((e) => e.code === openingTestCode);

  const saved = statusQuery.data?.followUp;
  const hasPortalRecord = statusQuery.data?.hasPortalRecord ?? false;
  const isDirty = exams.some((e) => outcomeOf(outcomes, e.code) !== outcomeOf(saved, e.code));

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
    for (const exam of exams) {
      if (outcomeOf(outcomes, exam.code) !== outcomeOf(saved, exam.code)) {
        patch[exam.code] = outcomeOf(outcomes, exam.code);
      }
    }
    if (Object.keys(patch).length === 0) return;
    persist(patch);
  }

  function handlePassGateExam() {
    if (!openingExam) return;
    setOutcomes((prev) => ({ ...prev, [openingExam.code]: 'passed' }));
    persist({ [openingExam.code]: 'passed' });
  }

  const isLoading = statusQuery.isLoading || testsQuery.isLoading;
  const gatePassed = openingExam ? outcomeOf(saved, openingExam.code) === 'passed' : false;

  return (
    <Card>
      <CardHeader
        title="نتائج اختبارات بوابة المتقدم"
        subtitle={
          openingExam
            ? `تحديث النتائج المسجّلة في بوابة المتقدم — اجتياز اختبار «${openingExam.name}» يفتح وثيقة التعارف`
            : 'تحديث النتائج المسجّلة في بوابة المتقدم'
        }
      />
      <CardBody>
        {isLoading ? (
          <LoadingState variant="list" />
        ) : statusQuery.isError ? (
          <div
            className="rounded-md text-sm text-danger-700"
            style={{ padding: 12, background: 'var(--surface-muted)' }}
          >
            تعذّر تحميل نتائج الاختبارات. حدّث الصفحة وحاول مرة أخرى.
          </div>
        ) : !hasPortalRecord ? (
          <div
            className="rounded-md text-sm text-ink-600"
            style={{ padding: 12, background: 'var(--surface-muted)' }}
          >
            لم يبدأ هذا المتقدم التقديم عبر بوابة المتقدم بعد، فلا توجد نتائج اختبارات لتحديثها.
          </div>
        ) : exams.length === 0 ? (
          <div
            className="rounded-md text-sm text-ink-600"
            style={{ padding: 12, background: 'var(--surface-muted)' }}
          >
            لا توجد اختبارات مُفعّلة في قائمة الاختبارات.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              {exams.map((exam) => {
                const isGate = exam.code === openingTestCode;
                const savedOutcome = outcomeOf(saved, exam.code);
                return (
                  <div
                    key={exam.code}
                    className="flex flex-col gap-2 rounded-md sm:flex-row sm:items-center sm:justify-between"
                    style={{ padding: 12, background: 'var(--surface-muted)' }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink-900">{exam.name}</span>
                      {isGate && <Badge tone="info">يفتح وثيقة التعارف</Badge>}
                      <Badge tone={OUTCOME_TONE[savedOutcome]}>{outcomeLabel(savedOutcome)}</Badge>
                    </div>
                    <Select
                      options={OUTCOME_OPTIONS}
                      value={outcomeOf(outcomes, exam.code)}
                      onChange={(e) =>
                        setOutcomes((prev) => ({ ...prev, [exam.code]: e.target.value as PipelineState }))
                      }
                      disabled={!canEdit || mutation.isPending}
                      containerClassName="sm:w-56"
                    />
                  </div>
                );
              })}
            </div>

            {canEdit && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                {openingExam ? (
                  <Button
                    variant="secondary"
                    leadingIcon={<CheckCircle2 size={16} />}
                    onClick={handlePassGateExam}
                    disabled={mutation.isPending || gatePassed}
                  >
                    {`اجتياز اختبار «${openingExam.name}» (فتح وثيقة التعارف)`}
                  </Button>
                ) : (
                  <span />
                )}
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
