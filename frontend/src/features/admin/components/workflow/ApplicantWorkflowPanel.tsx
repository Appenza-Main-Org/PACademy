/**
 * ApplicantWorkflowPanel — live progress + transition control surface for
 * one applicant on the admin detail page. Combines:
 *   1. <StageStepper> showing the applicant's position in their department's
 *      workflow (completed / current / pending).
 *   2. Test-result rows for the current stage.
 *   3. "تحديث الحالة" dialog constrained to currentStage.allowedNextStatuses
 *      — the enforcement surface for "no transition without conditions".
 *   4. <WorkflowTimeline> — audit trail of past stage transitions.
 */

import { useState } from 'react';
import { ArrowRight, RefreshCw, ShieldAlert } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  Select,
  StageStepper,
  toast,
  type StageDescriptor,
  type StageState,
} from '@/shared/components';
import { date as fmtDate } from '@/shared/lib/format';
import {
  TEST_KIND_LABELS,
  type ApplicantStatus,
  type DepartmentWorkflow,
  type ApplicantWorkflowProgress,
  type WorkflowStage,
  type WorkflowTransitionEvent,
} from '@/shared/types/domain';
import {
  useApplicantWorkflow,
  useApplicantWorkflowProgress,
  useApplicantWorkflowTransitions,
  useTransitionApplicant,
} from '@/features/applicants/api/applicant.queries';

const STATUS_LABEL_AR: Record<ApplicantStatus, string> = {
  pending: 'في الانتظار',
  'under-review': 'قيد المراجعة',
  approved: 'مقبول',
  rejected: 'مرفوض',
  'on-hold': 'موقوف',
  'documents-required': 'مستندات ناقصة',
  under_medical_review: 'قيد الكشف الطبي',
  passed_physical: 'اجتاز اللياقة',
  failed_interview: 'لم يجتز المقابلة',
  awaiting_board_decision: 'بانتظار قرار الهيئة',
};

interface Props {
  applicantId: string;
  /** Whether the current user can mutate state (super_admin / committee_admin). */
  canTransition: boolean;
}

export function ApplicantWorkflowPanel({ applicantId, canTransition }: Props): JSX.Element {
  const wfQuery = useApplicantWorkflow(applicantId);
  const progressQuery = useApplicantWorkflowProgress(applicantId);
  const trxQuery = useApplicantWorkflowTransitions(applicantId);

  if (wfQuery.isLoading || progressQuery.isLoading) return <LoadingState variant="detail" />;
  if (wfQuery.error) {
    return <ErrorState error={wfQuery.error} onRetry={() => wfQuery.refetch()} />;
  }
  const workflow = wfQuery.data ?? null;
  const progress = progressQuery.data ?? null;
  const transitions = trxQuery.data ?? [];

  if (!workflow || !progress) {
    return (
      <Card>
        <EmptyState
          variant="generic"
          title="لا يوجد سير عمل مرتبط"
          description="لم يتم ربط هذا المتقدم بأي سير عمل من إعدادات الإدارة."
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <WorkflowProgressCard
        workflow={workflow}
        progress={progress}
        applicantId={applicantId}
        canTransition={canTransition}
      />
      <WorkflowTimeline events={transitions} />
    </div>
  );
}

function WorkflowProgressCard({
  workflow,
  progress,
  applicantId,
  canTransition,
}: {
  workflow: DepartmentWorkflow;
  progress: ApplicantWorkflowProgress;
  applicantId: string;
  canTransition: boolean;
}): JSX.Element {
  const [open, setOpen] = useState(false);

  const currentStage: WorkflowStage | null =
    workflow.stages.find((s) => s.id === progress.currentStageId) ?? null;

  const stages: StageDescriptor[] = workflow.stages.map((s) => {
    let state: StageState = 'upcoming';
    if (progress.completedStageIds.includes(s.id)) state = 'complete';
    else if (s.id === progress.currentStageId) state = 'current';
    return { label: s.name, state };
  });

  const stageResults = currentStage
    ? progress.testResults.filter((r) => r.stageId === currentStage.id)
    : [];

  return (
    <Card>
      <CardHeader
        title={`سير العمل: ${workflow.name}`}
        subtitle={`الإصدار v${workflow.version} · ${workflow.stages.length} مرحلة`}
        actions={
          canTransition && currentStage ? (
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<RefreshCw size={14} strokeWidth={1.75} />}
              onClick={() => setOpen(true)}
            >
              تحديث الحالة
            </Button>
          ) : null
        }
      />

      <StageStepper
        stages={stages}
        currentIndex={Math.max(0, progress.completedStageIds.length)}
        orientation="vertical"
        ariaLabel="مراحل سير عمل المتقدم"
      />

      <section className="mt-4 rounded-md border border-border-subtle bg-ink-50/40 p-3">
        <h4 className="text-2xs font-bold uppercase tracking-wide text-ink-500">
          {currentStage
            ? `نتائج اختبارات: ${currentStage.name}`
            : 'سير العمل مكتمل'}
        </h4>
        {currentStage && currentStage.tests.length === 0 && (
          <p className="mt-2 text-2xs text-ink-500">
            لا توجد اختبارات مُعرّفة على هذه المرحلة.
          </p>
        )}
        {currentStage && currentStage.tests.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5">
            {currentStage.tests.map((t) => {
              const r = stageResults.find((x) => x.testId === t.id);
              const outcome = r?.outcome ?? 'pending';
              return (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border-subtle bg-surface-card p-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink-900">{t.name}</p>
                    <p className="text-2xs text-ink-500">
                      {TEST_KIND_LABELS[t.kind]} · {t.required ? 'إلزامي' : 'اختياري'}
                    </p>
                  </div>
                  <OutcomeBadge outcome={outcome} score={r?.score} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {canTransition && currentStage && (
        <TransitionDialog
          open={open}
          applicantId={applicantId}
          stage={currentStage}
          onClose={() => setOpen(false)}
        />
      )}
    </Card>
  );
}

function OutcomeBadge({
  outcome,
  score,
}: {
  outcome: 'pass' | 'fail' | 'pending';
  score?: number;
}): JSX.Element {
  if (outcome === 'pass') {
    return (
      <Badge tone="success">
        ناجح{typeof score === 'number' ? ` · ${score}` : ''}
      </Badge>
    );
  }
  if (outcome === 'fail') {
    return <Badge tone="danger">راسب</Badge>;
  }
  return <Badge tone="neutral">قيد الإدخال</Badge>;
}

function TransitionDialog({
  open,
  applicantId,
  stage,
  onClose,
}: {
  open: boolean;
  applicantId: string;
  stage: WorkflowStage;
  onClose: () => void;
}): JSX.Element {
  const [toStatus, setToStatus] = useState<ApplicantStatus | ''>('');
  const [reason, setReason] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const transitionMut = useTransitionApplicant();

  const onSubmit = (): void => {
    if (!toStatus) {
      setServerError('اختر الحالة الجديدة');
      return;
    }
    setServerError(null);
    transitionMut.mutate(
      { id: applicantId, toStatus, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          toast(`تم الانتقال إلى "${STATUS_LABEL_AR[toStatus]}"`, 'success');
          setToStatus('');
          setReason('');
          onClose();
        },
        onError: (err) => {
          setServerError((err).message ?? 'تعذر تنفيذ الانتقال');
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        setServerError(null);
        onClose();
      }}
      title={`الانتقال من "${stage.name}"`}
      subtitle="الحالات المتاحة محدودة بناءً على إعدادات سير العمل"
      size="md"
      transparentBackdrop={false}
    >
      <Modal.Body>
        <div className="flex flex-col gap-3">
          {stage.allowedNextStatuses.length === 0 ? (
            <div className="rounded-md border border-dashed border-gold-300 bg-gold-50 p-3 text-2xs text-gold-700">
              لا توجد حالات لاحقة مسموح بها على هذه المرحلة. عدّل سير العمل من
              إعدادات الإدارة لإضافة حالات.
            </div>
          ) : (
            <Select
              label="الحالة الجديدة"
              required
              value={toStatus}
              onChange={(e) => setToStatus(e.target.value as ApplicantStatus | '')}
              options={[
                { value: '', label: '— اختر —' },
                ...stage.allowedNextStatuses.map((s) => ({
                  value: s,
                  label: STATUS_LABEL_AR[s],
                })),
              ]}
            />
          )}
          <div className="flex flex-col gap-1">
            <label htmlFor="trx-reason" className="text-sm font-medium text-ink-700">
              السبب (اختياري)
            </label>
            <textarea
              id="trx-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="rounded-md border border-border-default bg-surface-card p-2 text-sm text-ink-900 focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none"
              placeholder="ملاحظات للسجل (تظهر في سجل التحريات)"
            />
          </div>
          {serverError && (
            <div className="flex items-start gap-2 rounded-md border border-terra-300 bg-terra-50 p-2 text-2xs text-terra-700">
              <ShieldAlert size={12} strokeWidth={2} className="mt-0.5 flex-shrink-0" />
              <span>{serverError}</span>
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="ghost"
          onClick={() => {
            setServerError(null);
            onClose();
          }}
        >
          إلغاء
        </Button>
        <Button
          variant="primary"
          isLoading={transitionMut.isPending}
          leadingIcon={<ArrowRight size={14} strokeWidth={1.75} className="rtl:rotate-180" />}
          onClick={onSubmit}
          disabled={stage.allowedNextStatuses.length === 0}
        >
          تأكيد الانتقال
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

function WorkflowTimeline({ events }: { events: WorkflowTransitionEvent[] }): JSX.Element {
  if (events.length === 0) {
    return (
      <Card>
        <CardHeader title="سجل انتقالات المراحل" />
        <p className="rounded-md bg-ink-50/60 p-3 text-center text-2xs text-ink-500">
          لم يحدث أي انتقال بعد.
        </p>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader
        title="سجل انتقالات المراحل"
        subtitle={`عدد الإجراءات: ${events.length}`}
      />
      <ol className="flex flex-col">
        {events.map((e) => (
          <li
            key={e.id}
            className="flex items-start justify-between gap-3 border-b border-border-subtle py-2 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="text-sm text-ink-900">
                {e.fromStatus ? STATUS_LABEL_AR[e.fromStatus] : '—'}{' '}
                <ArrowRight
                  size={12}
                  strokeWidth={1.75}
                  className="mx-1 inline-block rtl:rotate-180"
                />{' '}
                <span className="font-medium">{STATUS_LABEL_AR[e.toStatus]}</span>
              </p>
              <p className="mt-0.5 text-2xs text-ink-500">
                {e.actorName} · {fmtDate(e.ts, 'rel')}
                {e.reason ? ` · ${e.reason}` : ''}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
