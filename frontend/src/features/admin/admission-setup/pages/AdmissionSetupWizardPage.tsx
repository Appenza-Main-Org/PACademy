/**
 * AdmissionSetupWizardPage — single shell that orchestrates all 15 steps
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

import { useEffect, useMemo } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Save } from 'lucide-react';
import {
  Badge,
  Button,
  Combobox,
  EmptyState,
  toast,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { cn } from '@/shared/lib/cn';
import { toEasternArabicNumerals } from '@/shared/lib/arabic';
import { hasPermission, useAuthStore } from '@/features/auth';
import { useCategoriesAdmin } from '@/features/admin/api/categories.queries';
import { useCommittees } from '@/features/committees';
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
import { writeDraft } from '../lib/wizard-draft';
import {
  useAdmissionMergeSplitRules,
  useElectronicDeclaration,
  useExamDateConfig,
  useTotalScoreConfigs,
} from '../api/admission-setup.queries';
import type { AdmissionSetupStepKey } from '../types';
import { ApplicationSettingsPage } from './ApplicationSettingsPage';
import { ApplicationStatusPage } from './ApplicationStatusPage';
import { AgeRulesPage } from './AgeRulesPage';
import { FeesPage } from './FeesPage';
import { ExamsManagementPage } from './ExamsManagementPage';
import { CommitteesManagementPage } from './CommitteesManagementPage';
import { CommitteeMergeSplitPage } from './CommitteeMergeSplitPage';
import { ScoreThresholdsPage } from './ScoreThresholdsPage';
import { ExamDatesPage } from './ExamDatesPage';
import { DateCommitteeBindingPage } from './DateCommitteeBindingPage';
import { TotalScorePage } from './TotalScorePage';
import { NotificationsStepPage } from './NotificationsStepPage';
import { ElectronicDeclarationPage } from './ElectronicDeclarationPage';
import { WizardReviewPage } from './WizardReviewPage';

const REVIEW_KEY = 'review';
type WizardStepKey = AdmissionSetupStepKey | typeof REVIEW_KEY;

/* The renderer map mirrors ADMISSION_SETUP_STEPS — adding a 15th step is
 * one entry here plus the config append. */
const STEP_RENDERERS: Record<AdmissionSetupStepKey, () => JSX.Element> = {
  application_settings: () => <ApplicationSettingsPage />,
  application_status: () => <ApplicationStatusPage />,
  age_rules: () => <AgeRulesPage />,
  fees: () => <FeesPage />,
  exams: () => <ExamsManagementPage />,
  committees: () => <CommitteesManagementPage />,
  committee_merge_split: () => <CommitteeMergeSplitPage />,
  score_thresholds: () => <ScoreThresholdsPage />,
  exam_dates: () => <ExamDatesPage />,
  date_committee_binding: () => <DateCommitteeBindingPage />,
  total_score: () => <TotalScorePage />,
  notifications: () => <NotificationsStepPage />,
  electronic_declaration: () => <ElectronicDeclarationPage />,
};

export function AdmissionSetupWizardPage(): JSX.Element {
  const { stepKey } = useParams<{ stepKey: string }>();
  const navigate = useNavigate();
  const cycleCtx = useAdmissionSetupCycle();
  const user = useAuthStore((s) => s.user);
  const canRead = Boolean(user && hasPermission(user.permissions, 'admission-setup:read'));

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

  const activeKey = (stepKey as WizardStepKey | undefined) ?? orderedSteps[0].key;
  const isReview = activeKey === REVIEW_KEY;

  const cycleId = cycleCtx.cycle?.id ?? null;
  const categoriesQuery = useCategoriesAdmin();
  const committeesQuery = useCommittees();
  const mergeSplitQuery = useAdmissionMergeSplitRules(cycleId);
  const examDatesQuery = useExamDateConfig(cycleId);
  const totalScoreQuery = useTotalScoreConfigs(cycleId);
  const declarationQuery = useElectronicDeclaration(cycleId);

  /* Persist the wizard pointer on every step change so refresh / re-entry
   * lands on the same step. Skip when no cycle is selected. */
  useEffect(() => {
    if (!cycleId) return;
    writeDraft(cycleId, activeKey);
  }, [cycleId, activeKey]);

  if (!canRead) {
    return (
      <div className="px-4 py-8">
        <EmptyState variant="generic" title="ليس لديك صلاحية الاطلاع على إعدادات التقديم" />
      </div>
    );
  }

  if (!validKeys.includes(activeKey)) {
    return <Navigate to={ROUTES.admin.admissionSetup.wizard(orderedSteps[0].key)} replace />;
  }

  const statusInputs: StepStatusInputs = {
    cycle: cycleCtx.cycle,
    categories: categoriesQuery.data ?? [],
    committees: committeesQuery.data ?? [],
    mergeSplitRules: mergeSplitQuery.data ?? [],
    examDateConfig: examDatesQuery.data ?? null,
    totalScoreConfigs: totalScoreQuery.data ?? [],
    declaration: declarationQuery.data ?? null,
  };

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
  const isFirst = activeIndex === 0;
  const isFinalConfigStep = activeIndex === ADMISSION_SETUP_TOTAL_STEPS - 1;

  const goTo = (key: WizardStepKey): void => {
    navigate(ROUTES.admin.admissionSetup.wizard(key));
  };

  const handlePrev = (): void => {
    if (isReview) {
      goTo(orderedSteps[ADMISSION_SETUP_TOTAL_STEPS - 1].key);
      return;
    }
    if (isFirst) return;
    goTo(orderedSteps[activeIndex - 1].key);
  };

  const handleNext = (): void => {
    if (isReview) return;
    if (isFinalConfigStep) {
      goTo(REVIEW_KEY);
      return;
    }
    goTo(orderedSteps[activeIndex + 1].key);
  };

  const handleSaveDraft = (): void => {
    if (!cycleId) {
      toast('اختر دورة قبل حفظ المسودة', 'warning');
      return;
    }
    writeDraft(cycleId, activeKey);
    toast('تم حفظ المسودة — يمكنك الاستئناف لاحقاً', 'success');
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
        <div className="flex flex-wrap items-center justify-between gap-2 text-2xs text-ink-500">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={ROUTES.admin.admissionSetup.index}
              className="inline-flex items-center gap-1 text-ink-500 hover:text-ink-900"
            >
              <ArrowRight size={12} strokeWidth={1.75} className="rtl:scale-x-[-1]" />
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
              الخطوة {toEasternArabicNumerals(activeIndex + 1)} من{' '}
              {toEasternArabicNumerals(ADMISSION_SETUP_TOTAL_STEPS + 1)} —{' '}
              <span className="text-ink-700">{activeLabel}</span>
            </span>
          </div>
          <CycleSwitcher cycleCtx={cycleCtx} />
        </div>

        {/* Two-column body: vertical stepper rail (sticky) + step content.
         * Rail collapses below md so narrow viewports (and print) get a
         * stacked layout instead of a cramped side-by-side. */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
          <aside
            aria-label="مراحل المعالج"
            className={cn(
              'w-full shrink-0 rounded-md border border-border-subtle bg-surface-card p-3',
              /* Sticky on md+ so the rail stays visible while the form
               * scrolls. Top offset clears the staff chrome header
               * (~64px) plus a hair of breathing room. The rail is sized
               * to the available viewport so all 16 steps distribute
               * evenly and fit without a scroll spine. */
              'md:sticky md:top-20 md:h-[calc(100vh-7rem)] md:w-[260px] md:overflow-hidden',
            )}
          >
            <VerticalStepper
              steps={stepperItems}
              activeKey={activeKey}
              onSelect={(k) => goTo(k as WizardStepKey)}
            />
          </aside>

          {/* Step content — renders into the natural document scroll. The
           * trailing spacer below guarantees the last form field has air
           * above the sticky toolbar when the page is fully scrolled, so
           * the field is always readable, never visually trapped under it. */}
          <div className="min-w-0 flex-1">
            {isReview ? (
              <WizardReviewPage statusInputs={statusInputs} />
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
          className="sticky bottom-0 -mx-6 mt-2 border-t border-border-subtle bg-surface-card/95 px-6 py-3 shadow-sm backdrop-blur"
          style={{ zIndex: 'var(--z-sticky)' as unknown as number }}
        >
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={handlePrev}
              disabled={isFirst && !isReview}
              leadingIcon={
                <ArrowRight size={14} strokeWidth={1.75} className="rtl:scale-x-[-1]" />
              }
            >
              السابق
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={handleSaveDraft}
                leadingIcon={<Save size={14} strokeWidth={1.75} />}
              >
                حفظ كمسودة
              </Button>
              {!isReview && (
                <Button
                  variant="primary"
                  onClick={handleNext}
                  trailingIcon={
                    <ArrowLeft size={14} strokeWidth={1.75} className="rtl:scale-x-[-1]" />
                  }
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
  if (activeKey === key) return 'current';
  const status = computeStepStatus(key, inputs);
  if (status === 'complete') return 'complete';
  if (status === 'in_progress') return 'in_progress';
  return 'upcoming';
}

function CycleSwitcher({
  cycleCtx,
}: {
  cycleCtx: ReturnType<typeof useAdmissionSetupCycle>;
}): JSX.Element | null {
  const { cycle, availableCycles, setCycle } = cycleCtx;
  if (availableCycles.length === 0) {
    return (
      <Link to={ROUTES.admin.cycleNew} className="text-2xs text-gold-700 underline">
        أنشئ دورة من إدارة الدورات
      </Link>
    );
  }
  if (availableCycles.length === 1 || !cycle) {
    return null;
  }
  return (
    <div className="min-w-[200px]">
      <Combobox
        value={cycle.id}
        onChange={(next) => {
          if (next) setCycle(next);
        }}
        options={availableCycles.map((c) => ({ value: c.id, label: c.nameAr }))}
        placeholder="اختر دورة"
      />
    </div>
  );
}
