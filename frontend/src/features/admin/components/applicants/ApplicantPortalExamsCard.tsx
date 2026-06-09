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
  type FollowUpExam,
  type FollowUpExamPlan,
  useAdminPortalStatus,
  useFollowUpExamPlan,
  useUpdateFollowUpMutation,
} from '@/features/applicant-portal';
import { useAdminSettings } from '../../api/settings.queries';
import type { ApplicantCategoryKey, PipelineState } from '@/shared/types/domain';

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

function outcomeOf(map: Record<string, PipelineState> | undefined, exam: FollowUpExam): PipelineState {
  return map?.[exam.id] ?? map?.[exam.key] ?? 'pending';
}

function configuredExams(
  plan: FollowUpExamPlan | null | undefined,
  availableExams: readonly FollowUpExam[],
): Array<{ exam: FollowUpExam; isRequired: boolean }> {
  if (!plan) return [];

  const examById = new Map(availableExams.map((exam) => [exam.id, exam]));
  return plan.exams
    .filter((entry) => entry.isActive !== false && entry.isEnabled !== false && entry.stageIsActive !== false)
    .filter((entry) => examById.has(entry.examId))
    .sort((a, b) => a.order - b.order)
    .map((entry) => ({
      exam: examById.get(entry.examId)!,
      isRequired: entry.isRequired,
    }));
}

export function ApplicantPortalExamsCard({
  applicantId,
  canEdit,
  categoryKey,
  cycleId,
}: {
  applicantId: string;
  canEdit: boolean;
  categoryKey: ApplicantCategoryKey | null;
  cycleId: string | null;
}): JSX.Element | null {
  const statusQuery = useAdminPortalStatus(applicantId || null);
  const examPlanQuery = useFollowUpExamPlan(cycleId, categoryKey);
  const settingsQuery = useAdminSettings();
  const mutation = useUpdateFollowUpMutation(applicantId);

  const [outcomes, setOutcomes] = useState<Record<string, PipelineState>>({});

  // Hydrate the editable outcomes whenever the resolved follow-up changes.
  useEffect(() => {
    setOutcomes({ ...(statusQuery.data?.followUp ?? {}) });
  }, [statusQuery.data?.applicantId, statusQuery.data?.followUp]);

  if (!applicantId) return null;

  const exams = configuredExams(examPlanQuery.data?.plan, examPlanQuery.data?.exams ?? []);
  const openingTestCode = settingsQuery.data?.acquaintanceDocumentsEntryResponsibleTestCode ?? '';
  const openingExam = exams.find(({ exam }) => exam.id === openingTestCode || exam.key === openingTestCode)?.exam;

  const saved = statusQuery.data?.followUp;
  const hasPortalRecord = statusQuery.data?.hasPortalRecord ?? false;
  const isDirty = exams.some(({ exam }) => outcomeOf(outcomes, exam) !== outcomeOf(saved, exam));

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
    for (const { exam } of exams) {
      if (outcomeOf(outcomes, exam) !== outcomeOf(saved, exam)) {
        patch[exam.id] = outcomeOf(outcomes, exam);
      }
    }
    if (Object.keys(patch).length === 0) return;
    persist(patch);
  }

  function handlePassGateExam() {
    if (!openingExam) return;
    setOutcomes((prev) => ({ ...prev, [openingExam.id]: 'passed' }));
    persist({ [openingExam.id]: 'passed' });
  }

  const isLoading = statusQuery.isLoading || examPlanQuery.isLoading;
  const gatePassed = openingExam ? outcomeOf(saved, openingExam) === 'passed' : false;

  return (
    <Card>
      <CardHeader
        title="نتائج اختبارات بوابة المتقدم"
        subtitle={
          openingExam
            ? `تحديث النتائج المسجّلة في بوابة المتقدم — اجتياز اختبار «${openingExam.nameAr}» يفتح وثيقة التعارف`
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
        ) : !cycleId || !categoryKey ? (
          <div
            className="rounded-md text-sm text-ink-600"
            style={{ padding: 12, background: 'var(--surface-muted)' }}
          >
            لا يمكن تحديد اختبارات المتقدم لأن الدورة أو فئة التقديم غير مسجلة على الملف.
          </div>
        ) : examPlanQuery.isError ? (
          <div
            className="rounded-md text-sm text-danger-700"
            style={{ padding: 12, background: 'var(--surface-muted)' }}
          >
            تعذّر تحميل إعدادات اختبارات هذه الفئة. حدّث الصفحة وحاول مرة أخرى.
          </div>
        ) : exams.length === 0 ? (
          <div
            className="rounded-md text-sm text-ink-600"
            style={{ padding: 12, background: 'var(--surface-muted)' }}
          >
            لا توجد اختبارات مُفعّلة لهذه الفئة في إعدادات القبول.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              {exams.map(({ exam, isRequired }) => {
                const isGate = exam.id === openingTestCode || exam.key === openingTestCode;
                const savedOutcome = outcomeOf(saved, exam);
                return (
                  <div
                    key={exam.id}
                    className="flex flex-col gap-2 rounded-md sm:flex-row sm:items-center sm:justify-between"
                    style={{ padding: 12, background: 'var(--surface-muted)' }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink-900">{exam.nameAr}</span>
                      {isGate && <Badge tone="info">يفتح وثيقة التعارف</Badge>}
                      {!isRequired && <Badge tone="neutral">تكميلي</Badge>}
                      <Badge tone={OUTCOME_TONE[savedOutcome]}>{outcomeLabel(savedOutcome)}</Badge>
                    </div>
                    <Select
                      options={OUTCOME_OPTIONS}
                      value={outcomeOf(outcomes, exam)}
                      onChange={(e) =>
                        setOutcomes((prev) => ({ ...prev, [exam.id]: e.target.value as PipelineState }))
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
                    {`اجتياز اختبار «${openingExam.nameAr}» (فتح وثيقة التعارف)`}
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
