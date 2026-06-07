/**
 * AdmissionSetupWizardPage — single shell that orchestrates every step
 * (plus a virtual `review` step) as a top-stepper wizard.
 *
 * Driven by `:stepKey` in the URL — adding a new entry to
 * `ADMISSION_SETUP_STEPS` automatically threads through both the stepper
 * and the renderer map (see STEP_RENDERERS below) as long as the new
 * step's component is registered here.
 *
 * Footer actions:
 *   • السابق         — back to previous step (disabled on first)
 *   • حفظ كمسودة     — persist current step pointer to localStorage so the
 *                      admin can resume from the launcher; toast confirms.
 *   • التالي          — advance one step (or jump to review on the final
 *                      configuration step). Per-step validation is delegated
 *                      to the step component via the existing service-level
 *                      throws — there's no separate Next-time validator.
 *   • إرسال للاعتماد  — appears on the last config step (electronic_declaration)
 *                      and routes to the review step.
 *
 * Cycle context: piggybacks on `useAdmissionSetupCycle` (sessionStorage-backed)
 * so switching the cycle from the launcher persists into the wizard.
 *
 * Each per-step component renders its own form + save button (already shipped
 * by Phase 5 of the admission-setup feature). The wizard wraps them with a
 * `WizardModeProvider` so their inner `AdmissionSetupShell` skips its own
 * breadcrumb/header — the wizard owns all chrome at this level.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import {
  Badge,
  Button,
  EmptyState,
  LoadingState,
  toast,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { cn } from '@/shared/lib/cn';
import { isConflictError } from '@/shared/lib/errors';
import { hasPermission, useAuthStore } from '@/features/auth';
import { useAdmissionSetupIsReadOnly } from '../components/AdmissionSetupShell';
import { useCategoriesAdmin } from '@/features/admin/api/categories.queries';
import { useCommittees } from '@/features/committees';
import { useSaveExamPlan } from '@/features/admin/api/examPlans.queries';
import { useLookup } from '@/features/lookups';
import {
  ADMISSION_SETUP_STEPS,
  ADMISSION_SETUP_TOTAL_STEPS,
} from '../config';
import {
  VerticalStepper,
  type VerticalStepDescriptor,
  type VerticalStepState,
} from '../components/VerticalStepper';
import { WizardModeProvider } from '../components/WizardModeContext';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';
import {
  computeStepStatus,
  type StepStatusInputs,
} from '../lib/step-status';
import { computeApplicationSettingsStatus } from '../lib/application-settings-completion';
import {
  findCategoriesMissingExams,
  findCategoriesWithInvalidExamOrders,
  formatInvalidExamOrderCategoriesMessage,
  formatMissingExamCategoriesMessage,
  hasPendingExamPlanDrafts,
  type ExamPlanStepDraftState,
} from '../lib/exam-plan-step';
import { writeDraft } from '../lib/wizard-draft';
import { hydrateApplicationSettingsCycleDraft } from '../lib/application-settings-cycle-draft';
import {
  getWizardGateState,
  isWizardStepSelectable,
  type WizardStatusByKey,
} from '../lib/wizard-gating';
import {
  useCommitteeBindings,
  useElectronicDeclaration,
} from '../api/admission-setup.queries';
import { useExamScheduleAggregate } from '../api/examSchedule.queries';
import { useCycleCommitteeBindings } from '../api/committeeBinding.queries';
import {
  applicationSettingsQueryOptions,
  useCategoryConfigs,
} from '../api/applicationSettings.queries';
import { buildCommitteeBindingsSnapshot } from '../lib/step-status';
import { useAdmissionSetupWizardStore } from '../store/wizardSharedState';
import type { AdmissionSetupStepKey } from '../types';
import { ApplicationSettingsPage } from './ApplicationSettingsPage';
import { ApplicationSettingsReviewPage } from './ApplicationSettingsReviewPage';
import { FeesPage } from './FeesPage';
import { ExamsManagementPage } from './ExamsManagementPage';
import { ElectronicDeclarationPage } from './ElectronicDeclarationPage';
import { WizardReviewPage } from './WizardReviewPage';

const REVIEW_KEY = 'review' as const;
type WizardStepKey = AdmissionSetupStepKey | typeof REVIEW_KEY;

/* The renderer map mirrors ADMISSION_SETUP_STEPS — adding a step is one
 * entry here plus the config append. */
const STEP_RENDERERS: Record<AdmissionSetupStepKey, () => JSX.Element> = {
  application_settings: () => <ApplicationSettingsPage />,
  application_settings_review: () => <ApplicationSettingsReviewPage />,
  fees: () => <FeesPage />,
  exams: () => <ExamsManagementPage />,
  electronic_declaration: () => <ElectronicDeclarationPage />,
};

export function AdmissionSetupWizardPage(): JSX.Element {
  const { stepKey } = useParams<{ stepKey: string }>();
  const navigate = useNavigate();
  const cycleCtx = useAdmissionSetupCycle();
  const user = useAuthStore((s) => s.user);
  const canRead = Boolean(user && hasPermission(user.permissions, 'admission-setup:read'));
  const isReadOnly = useAdmissionSetupIsReadOnly();
  const saveExamPlanMut = useSaveExamPlan();
  const [examStepDraftState, setExamStepDraftState] =
    useState<ExamPlanStepDraftState | null>(null);
  const [isSavingExamStep, setIsSavingExamStep] = useState(false);
  const [isApplicationSettingsHydrated, setIsApplicationSettingsHydrated] = useState(false);
  const hydratedCycleRef = useRef<string | null>(null);

  /* Sorted once; ADMISSION_SETUP_STEPS already arrives in order but the
   * sort is cheap and guards against config drift. */
  const orderedSteps = useMemo(
    () => [...ADMISSION_SETUP_STEPS].sort((a, b) => a.order - b.order),
    [],
  );

  const validKeys = useMemo<readonly WizardStepKey[]>(
    () => [...orderedSteps.map((s) => s.key), REVIEW_KEY] as const,
    [orderedSteps],
  );

  const activeKey = (stepKey as WizardStepKey | undefined) ?? orderedSteps[0]!.key;
  const isReview = activeKey === REVIEW_KEY;

  const cycleId = cycleCtx.cycle?.id ?? null;
  useEffect(() => {
    setExamStepDraftState(null);
  }, [cycleId]);

  const categoriesQuery = useCategoriesAdmin();
  const categoryConfigsQuery = useCategoryConfigs(canRead, cycleId);
  const applicantCategoriesOptions = useMemo(
    () => ({
      ...applicationSettingsQueryOptions,
      enabled: canRead,
      /* useLookup sets refetchOnMount: 'always' for `applicant-categories`
       * (it's in NO_CACHE_LOOKUPS). The wizard mounts this query from
       * multiple descendants — that aggressive default cascades observer
       * remounts into a refetch loop. Respect the 2-minute stale window
       * instead. Mutations on this lookup already invalidate. */
      refetchOnMount: true as const,
    }),
    [canRead],
  );
  const applicantCategoriesQuery = useLookup(
    'applicant-categories',
    applicantCategoriesOptions,
  );
  const committeesQuery = useCommittees();
  const examScheduleAggregateQuery = useExamScheduleAggregate(cycleId);
  const declarationQuery = useElectronicDeclaration(cycleId);
  const rosterQuery = useCommitteeBindings(cycleId, null);
  const cycleBindingsQuery = useCycleCommitteeBindings(cycleId);
  const localApplicationSettingsRows = useAdmissionSetupWizardStore((s) => s.local);
  const approvedApplicationSettingsRows = useAdmissionSetupWizardStore((s) => s.approved);
  const committeeBindingsSnapshot =
    cycleId &&
    examScheduleAggregateQuery.data &&
    rosterQuery.data &&
    cycleBindingsQuery.data
      ? buildCommitteeBindingsSnapshot(
          rosterQuery.data,
          cycleBindingsQuery.data,
          cycleId,
          examScheduleAggregateQuery.data.activeCategoryIds,
        )
      : null;

  useEffect(() => {
    if (!cycleId) {
      hydratedCycleRef.current = null;
      setIsApplicationSettingsHydrated(true);
      return;
    }
    if (hydratedCycleRef.current === cycleId) {
      setIsApplicationSettingsHydrated(true);
      return;
    }
    let cancelled = false;
    setIsApplicationSettingsHydrated(false);
    void hydrateApplicationSettingsCycleDraft(cycleId).finally(() => {
      if (!cancelled) {
        hydratedCycleRef.current = cycleId;
        setIsApplicationSettingsHydrated(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [cycleId]);

  const isKnownStep = validKeys.includes(activeKey);
  const isGateLoading =
    cycleCtx.isLoading ||
    categoryConfigsQuery.isLoading ||
    applicantCategoriesQuery.isLoading ||
    !isApplicationSettingsHydrated;

  const applicationSettingsStatus = computeApplicationSettingsStatus(
    categoryConfigsQuery.data ?? [],
    applicantCategoriesQuery.data ?? [],
    [...localApplicationSettingsRows, ...approvedApplicationSettingsRows],
  );

  const statusInputs: StepStatusInputs = {
    cycle: cycleCtx.cycle,
    categories: categoriesQuery.data ?? [],
    committees: committeesQuery.data ?? [],
    declaration: declarationQuery.data ?? null,
    committeeBindings: committeeBindingsSnapshot,
    applicationSettingsStatus,
    examPlanDraftState: examStepDraftState,
  };

  const statusByKey = orderedSteps.reduce<WizardStatusByKey>((acc, step) => {
    acc[step.key] = computeStepStatus(step.key, statusInputs);
    return acc;
  }, {});
  const gateState = getWizardGateState(
    orderedSteps,
    activeKey,
    statusByKey,
    REVIEW_KEY,
  );

  /* Persist the wizard pointer on every allowed step change so refresh /
   * re-entry lands on the same step. Skip locked deep links because those
   * immediately redirect to the first incomplete step. */
  useEffect(() => {
    if (!canRead || !cycleId || !isKnownStep || isGateLoading || gateState.redirectKey) return;
    writeDraft(cycleId, activeKey);
  }, [canRead, cycleId, activeKey, isKnownStep, isGateLoading, gateState.redirectKey]);

  if (!canRead) {
    return (
      <div className="px-4 py-8">
        <EmptyState variant="generic" title="ليس لديك صلاحية الاطلاع على إعدادات التقديم" />
      </div>
    );
  }

  if (!isKnownStep) {
    return <Navigate to={ROUTES.admin.admissionSetup.wizard(orderedSteps[0]!.key)} replace />;
  }

  if (isGateLoading) {
    return (
      <div className="px-4 py-8">
        <LoadingState variant="list" />
      </div>
    );
  }

  if (gateState.redirectKey) {
    return <Navigate to={ROUTES.admin.admissionSetup.wizard(gateState.redirectKey)} replace />;
  }

  const stepperItems: VerticalStepDescriptor[] = orderedSteps.map((s) => ({
    key: s.key,
    label: s.labelAr,
    order: s.order,
    state: deriveStepperState(s.key, activeKey, statusInputs),
  }));
  /* Append the review step as the (N+1)th item. */
  stepperItems.push({
    key: REVIEW_KEY,
    label: 'المراجعة والاعتماد',
    order: ADMISSION_SETUP_TOTAL_STEPS + 1,
    state: isReview ? 'current' : 'upcoming',
  });

  const activeIndex = isReview
    ? ADMISSION_SETUP_TOTAL_STEPS
    : orderedSteps.findIndex((s) => s.key === activeKey);
  const isFinalConfigStep = activeIndex === ADMISSION_SETUP_TOTAL_STEPS - 1;

  const goTo = (key: WizardStepKey): void => {
    if (!isWizardStepSelectable(key, orderedSteps, statusByKey, REVIEW_KEY)) {
      toast('أكمل الخطوة الحالية أولاً قبل الانتقال إلى الخطوات التالية.', 'warning');
      return;
    }
    navigate(ROUTES.admin.admissionSetup.wizard(key));
  };

  const handlePrev = (): void => {
    if (!gateState.previousKey) return;
    goTo(gateState.previousKey as WizardStepKey);
  };

  const saveExamStepBeforeAdvance = async (): Promise<boolean> => {
    if (isReadOnly) return true;
    if (!cycleId) {
      toast('يجب اختيار دورة قبول قبل الانتقال للخطوة التالية', 'warning');
      return false;
    }
    if (!examStepDraftState || examStepDraftState.activeCategories.length === 0) {
      toast('يرجى تفعيل فئة واحدة على الأقل من إعدادات التقديم قبل الانتقال للخطوة التالية', 'warning');
      return false;
    }
    if (hasPendingExamPlanDrafts(examStepDraftState)) {
      toast('جارِ تحميل خطط الاختبارات، حاول مرة أخرى بعد لحظات', 'info');
      return false;
    }

    const missing = findCategoriesMissingExams(
      examStepDraftState.activeCategories,
      examStepDraftState.draftsByCategory,
    );
    if (missing.length > 0) {
      toast(formatMissingExamCategoriesMessage(missing), 'danger');
      return false;
    }

    const invalidOrders = findCategoriesWithInvalidExamOrders(
      examStepDraftState.activeCategories,
      examStepDraftState.draftsByCategory,
    );
    if (invalidOrders.length > 0) {
      toast(formatInvalidExamOrderCategoriesMessage(invalidOrders), 'danger');
      return false;
    }

    setIsSavingExamStep(true);
    try {
      for (const category of examStepDraftState.activeCategories) {
        const draft = examStepDraftState.draftsByCategory[category.key];
        if (!draft) continue;
        await saveExamPlanMut.mutateAsync({
          cycleId,
          categoryId: category.key,
          entries: draft.entries,
        });
      }
      toast('تم حفظ خطط الاختبارات', 'success');
      return true;
    } catch (err) {
      if (isConflictError(err) && err.conflictCode === 'EXAM_ORDER_DUPLICATE') {
        toast(err.message, 'danger');
      } else {
        toast(err instanceof Error ? err.message : 'تعذر حفظ خطط الاختبارات', 'danger');
      }
      return false;
    } finally {
      setIsSavingExamStep(false);
    }
  };

  const handleNext = async (): Promise<void> => {
    if (isReview) return;
    if (activeKey === 'exams') {
      const canAdvance = await saveExamStepBeforeAdvance();
      if (!canAdvance) return;
      if (!gateState.nextKey) return;
      goTo(gateState.nextKey as WizardStepKey);
      return;
    }
    if (!gateState.canGoNext || !gateState.nextKey) {
      toast('أكمل بيانات الخطوة الحالية واحفظها قبل المتابعة.', 'warning');
      return;
    }
    if (isFinalConfigStep) {
      const status = computeStepStatus(activeKey as AdmissionSetupStepKey, statusInputs);
      if (status !== 'complete') {
        toast('يجب إدخال نص الإقرار أو رفع ملف PDF قبل إرسال الدورة للاعتماد', 'warning');
        return;
      }
      goTo(gateState.nextKey as WizardStepKey);
      return;
    }
    goTo(gateState.nextKey as WizardStepKey);
  };

  const activeStep = isReview ? null : orderedSteps.find((s) => s.key === activeKey);

  const activeLabel = isReview ? 'المراجعة والاعتماد' : activeStep?.labelAr ?? '';

  return (
    <WizardModeProvider>
      {/* `scrollPaddingBlockEnd` ensures keyboard / browser scroll-into-view
       * lands the focused field comfortably above the sticky toolbar
       * instead of underneath it. */}
      <div
        className="flex flex-col gap-3"
        style={{ scrollPaddingBlockEnd: '6rem' }}
      >
        {/* Slim breadcrumb-style context bar — replaces the duplicate
         * outer PageHeader. Step page below renders the H1. */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2 text-2xs text-ink-500">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={ROUTES.admin.admissionSetup.index}
              className="inline-flex items-center gap-1 text-ink-500 hover:text-ink-900"
            >
              <ArrowRight size={12} strokeWidth={1.75} />
              لوحة التقديم
            </Link>
            <span aria-hidden className="text-ink-300">·</span>
            <span>
              {cycleCtx.cycle ? (
                <>
                  دورة <span className="font-medium text-ink-700">{cycleCtx.cycle.nameAr}</span>
                </>
              ) : (
                'لم يتم اختيار دورة'
              )}
            </span>
            <span aria-hidden className="text-ink-300">·</span>
            <span className="font-numeric tnum">
              الخطوة {activeIndex + 1} من {ADMISSION_SETUP_TOTAL_STEPS + 1} —{' '}
              <span className="text-ink-700">{activeLabel}</span>
            </span>
          </div>
          <CycleSwitcher cycleCtx={cycleCtx} />
        </div>

        {/* Read-only alert — visible whenever the chosen cycle has passed
         * the إدراج ومراجعة stage. Admins can navigate every step and
         * inspect every value, but write actions are disabled at their
         * source by `useAdmissionSetupCanWrite()`. */}
        {isReadOnly && cycleCtx.cycle && (
          <div
            role="alert"
            className="no-print flex flex-wrap items-start gap-2 rounded-md border border-terra-200 bg-terra-50 px-3 py-2 text-2xs text-terra-800"
          >
            <AlertTriangle size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-terra-800">
                تنبيه: الدورة الحالية نشطة ومعتمدة — لا يمكن تعديل إعداد التقديم
              </p>
              <p className="mt-0.5 text-terra-700">
                دورة <span className="font-medium">{cycleCtx.cycle.nameAr}</span>{' '}
                في حالة «اعتماد ونشر» و«نشطة»، لذلك يستطيع المدير استعراض إعداد
                التقديم فقط دون إضافة أو تعديل أو حذف. لإجراء تغييرات، يلزم إعادة
                الدورة إلى حالة «إدراج ومراجعة» من{' '}
                <Link
                  to={ROUTES.admin.cycles}
                  className="underline underline-offset-2 hover:text-terra-900"
                >
                  إدارة الدورات
                </Link>
                .
              </p>
            </div>
          </div>
        )}

        {/* Two-column body: vertical stepper rail (sticky) + step content.
         * Rail collapses below md so narrow viewports (and print) get a
         * stacked layout instead of a cramped side-by-side. */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
          <aside
            aria-label="مراحل المعالج"
            className={cn(
              'no-print w-full shrink-0 rounded-md border border-border-subtle bg-surface-card p-3',
              /* Sticky on md+ so the rail stays visible while the form
               * scrolls. Top offset clears the staff chrome header
               * (~64px) plus a hair of breathing room. If the viewport is
               * short, the rail scrolls internally instead of clipping the
               * final steps or distorting row spacing. */
              'md:sticky md:top-20 md:max-h-[calc(100vh_-_7rem)] md:w-[260px] md:overflow-y-auto',
            )}
          >
            <VerticalStepper
              steps={stepperItems}
              activeKey={activeKey}
              disabledKeys={gateState.lockedKeys}
              onSelect={(k) => goTo(k as WizardStepKey)}
            />
          </aside>

          {/* Step content — renders into the natural document scroll. The
           * trailing spacer below guarantees the last form field has air
           * above the sticky toolbar when the page is fully scrolled, so
           * the field is always readable, never visually trapped under it.
           *
           * The wrapping `<fieldset disabled>` is the defensive belt for
           * read-only mode: a disabled fieldset propagates the `disabled`
           * state to every nested `<input>`, `<select>`, `<textarea>`,
           * `<button>` — even the ones whose components don't explicitly
           * consult `useAdmissionSetupCanWrite()`. `all: unset` + `display:
           * contents` keeps the fieldset transparent to the flex layout
           * (no extra box, no default browser padding/border). */}
          {/* In view-only mode we don't disable the step content wholesale
           * — admins need to expand accordions, switch tabs, and inspect
           * the configuration in-place. Write protection is layered
           * instead:
           *   • The banner above states the mode plainly.
           *   • `useAdmissionSetupCanWrite()` returns false for non-draft
           *     cycles, so every save / approve / publish button that
           *     consults it is disabled at the source.
           *   • The `[data-admission-setup-readonly]` attribute below
           *     scopes a CSS rule (admission-setup.css) that visually
           *     marks form controls as read-only.
           * The review step manages its own gating because it owns the
           * "إلغاء الاعتماد" affordance — the only way back from
           * approved → draft. */}
          <div
            className="min-w-0 flex-1"
            data-admission-setup-readonly={isReadOnly || undefined}
          >
            {isReview ? (
              <WizardReviewPage statusInputs={statusInputs} />
            ) : activeKey === 'exams' ? (
              <ExamsManagementPage onWizardDraftsChange={setExamStepDraftState} />
            ) : (
              STEP_RENDERERS[activeKey as AdmissionSetupStepKey]()
            )}
            <div aria-hidden className="h-16 shrink-0" />
          </div>
        </div>

        {/* Sticky footer (not fixed) so it lives in flow with the main
         * column — sidebar isn't overlapped, and scrolling reveals all
         * form content without the toolbar covering the last fields. */}
        <footer
          className="no-print sticky bottom-0 -mx-6 mt-2 border-t border-border-subtle bg-surface-card/95 px-6 py-3 shadow-sm backdrop-blur"
          style={{ zIndex: 'var(--z-sticky)' as unknown as number }}
        >
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={handlePrev}
              disabled={!gateState.previousKey}
              leadingIcon={<ArrowRight size={14} strokeWidth={1.75} />}
            >
              السابق
            </Button>
            <div className="flex items-center gap-2">
              {!isReview && (
                <Button
                  variant="primary"
                  onClick={() => {
                    void handleNext();
                  }}
                  trailingIcon={<ArrowLeft size={14} strokeWidth={1.75} />}
                  isLoading={isSavingExamStep}
                  disabled={isSavingExamStep || (activeKey !== 'exams' && !gateState.canGoNext)}
                >
                  {isFinalConfigStep ? 'إرسال للاعتماد' : 'التالي'}
                </Button>
              )}
              {isReview && (
                <Badge tone="info">
                  <CheckCircle2 size={12} strokeWidth={1.75} className="me-1 inline-block" />
                  مرحلة المراجعة
                </Badge>
              )}
            </div>
          </div>
        </footer>
      </div>
    </WizardModeProvider>
  );
}

function deriveStepperState(
  key: AdmissionSetupStepKey,
  activeKey: WizardStepKey,
  inputs: StepStatusInputs,
): VerticalStepState {
  const status = computeStepStatus(key, inputs);
  if (activeKey === key) return status === 'complete' ? 'current_complete' : 'current';
  if (status === 'complete') return 'complete';
  if (status === 'in_progress') return 'in_progress';
  return 'upcoming';
}

function CycleSwitcher({
  cycleCtx,
}: {
  cycleCtx: ReturnType<typeof useAdmissionSetupCycle>;
}): JSX.Element | null {
  const { cycle, availableCycles } = cycleCtx;
  if (availableCycles.length === 0) {
    return (
      <Link to={ROUTES.admin.cycleNew} className="text-2xs text-gold-700 underline">
        أنشئ دورة من إدارة الدورات
      </Link>
    );
  }
  if (!cycle) {
    return null;
  }
  return (
    <span
      className="inline-flex min-h-10 min-w-[200px] items-center justify-center rounded-md border border-border-subtle bg-surface-card px-4 font-ar text-sm font-medium text-ink-900 shadow-xs"
      aria-label={`الدورة الحالية: ${cycle.nameAr}`}
    >
      {cycle.nameAr}
    </span>
  );
}
