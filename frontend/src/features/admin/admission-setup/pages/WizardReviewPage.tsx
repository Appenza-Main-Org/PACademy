/**
 * WizardReviewPage — final review step in the admission-setup wizard.
 * Shows a recap of every step's status pill plus Approve / Cancel-approval
 * actions tied to the cycle status workflow.
 *
 * Embedded by `AdmissionSetupWizardPage`; never routed to directly.
 */

import { Link } from 'react-router-dom';
import { CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  toast,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { hasPermission, useAuthStore } from '@/features/auth';
import {
  useCycleActivate,
  useCycleTransition,
} from '@/features/admin/api/cycles.queries';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';
import { ADMISSION_SETUP_STEPS } from '../config';
import {
  computeStepStatus,
  STEP_STATUS_LABEL,
  STEP_STATUS_TONE,
  type StepStatusInputs,
} from '../lib/step-status';
import { clearDraft } from '../lib/wizard-draft';

interface WizardReviewPageProps {
  statusInputs: StepStatusInputs;
}

export function WizardReviewPage({ statusInputs }: WizardReviewPageProps): JSX.Element {
  const cycleCtx = useAdmissionSetupCycle();
  const { cycle } = cycleCtx;
  const user = useAuthStore((s) => s.user);
  const canWrite = Boolean(user && hasPermission(user.permissions, 'admission-setup:write'));
  const activateMut = useCycleActivate();
  const transitionMut = useCycleTransition();

  if (!cycle) {
    return (
      <Card>
        <EmptyState
          variant="generic"
          title="لم يتم اختيار دورة"
          description="اختر دورة من لوحة التقديم لمراجعة إعداداتها."
          action={
            <Link to={ROUTES.admin.admissionSetup.index} className="inline-flex">
              <Button variant="primary">العودة للوحة التقديم</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  const incompleteSteps = ADMISSION_SETUP_STEPS.filter(
    (s) => computeStepStatus(s.key, statusInputs) !== 'complete',
  );

  const isApproved =
    cycle.status === 'active' || cycle.status === 'open' || cycle.status === 'extended';

  const handleApprove = (): void => {
    if (!canWrite) {
      toast('ليس لديك صلاحية الاعتماد', 'danger');
      return;
    }
    if (incompleteSteps.length > 0) {
      toast(
        `يتبقى ${incompleteSteps.length} خطوة غير مكتملة قبل الاعتماد`,
        'warning',
      );
      return;
    }
    activateMut.mutate(cycle.id, {
      onSuccess: () => {
        clearDraft(cycle.id);
        toast('تم اعتماد الدورة وإتاحتها للمتقدمين', 'success');
      },
      onError: (err) => toast((err).message ?? 'تعذر اعتماد الدورة', 'danger'),
    });
  };

  const handleCancelApproval = (): void => {
    if (!canWrite) {
      toast('ليس لديك صلاحية إلغاء الاعتماد', 'danger');
      return;
    }
    transitionMut.mutate(
      { id: cycle.id, next: 'draft' },
      {
        onSuccess: () => toast('تم إلغاء اعتماد الدورة وإرجاعها مسودة', 'success'),
        onError: (err) =>
          toast((err).message ?? 'تعذر إلغاء الاعتماد', 'danger'),
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="المراجعة والاعتماد"
        subtitle={`مراجعة إعدادات دورة "${cycle.nameAr}" قبل الاعتماد النهائي.`}
      />

      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-ar-display text-md font-bold text-ink-900">
              ملخص الخطوات
            </h2>
            <Badge tone={incompleteSteps.length === 0 ? 'success' : 'warning'}>
              {incompleteSteps.length === 0
                ? 'جميع الخطوات مكتملة'
                : `${incompleteSteps.length} خطوة غير مكتملة`}
            </Badge>
          </div>
          <ul className="grid gap-2 md:grid-cols-2">
            {ADMISSION_SETUP_STEPS.map((step) => {
              const status = computeStepStatus(step.key, statusInputs);
              const StepIcon = step.icon;
              return (
                <li
                  key={step.key}
                  className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface-card px-3 py-2"
                >
                  <Link
                    to={ROUTES.admin.admissionSetup.wizard(step.key)}
                    className="flex min-w-0 items-center gap-2 text-sm text-ink-700 hover:text-ink-900"
                  >
                    <span
                      aria-hidden
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md"
                      style={{ background: 'var(--accent-50)', color: 'var(--accent-600)' }}
                    >
                      <StepIcon size={14} strokeWidth={1.75} />
                    </span>
                    <span className="truncate">{step.labelAr}</span>
                  </Link>
                  <Badge tone={STEP_STATUS_TONE[status]}>{STEP_STATUS_LABEL[status]}</Badge>
                </li>
              );
            })}
          </ul>
        </div>
      </Card>

      <Card variant="elevated">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="inline-flex h-10 w-10 items-center justify-center rounded-md"
              style={{
                background: isApproved ? 'var(--success-50, #E6F4EA)' : 'var(--accent-50)',
                color: isApproved ? 'var(--success, #1E8E3E)' : 'var(--accent-600)',
              }}
            >
              {isApproved ? (
                <ShieldCheck size={20} strokeWidth={1.75} />
              ) : (
                <ShieldAlert size={20} strokeWidth={1.75} />
              )}
            </span>
            <div className="min-w-0">
              <h2 className="font-ar-display text-md font-bold text-ink-900">
                {isApproved ? 'الدورة معتمدة' : 'في انتظار الاعتماد'}
              </h2>
              <p className="mt-0.5 text-2xs text-ink-500">
                {isApproved
                  ? 'الدورة منشورة للمتقدمين. يمكنك إلغاء الاعتماد لإعادتها مسودة.'
                  : 'بعد مراجعة جميع الخطوات، اعتمد الدورة لإتاحتها للمتقدمين.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isApproved ? (
              <Button
                variant="ghost"
                onClick={handleCancelApproval}
                isLoading={transitionMut.isPending}
                disabled={!canWrite}
              >
                إلغاء الاعتماد
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleApprove}
                isLoading={activateMut.isPending}
                disabled={!canWrite || incompleteSteps.length > 0}
                leadingIcon={<CheckCircle2 size={14} strokeWidth={1.75} />}
              >
                اعتماد ونشر
              </Button>
            )}
          </div>
          {!canWrite && (
            <p className="text-2xs text-ink-500">
              ليس لديك صلاحية التعديل — تواصل مع مدير النظام لاعتماد الدورة.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
