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
  Card,
  Combobox,
  EmptyState,
  PageHeader,
  toast,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { toEasternArabicNumerals } from '@/shared/lib/arabic';
import { hasPermission, useAuthStore } from '@/features/auth';
import { useCategoriesAdmin } from '@/features/admin/api/categories.queries';
import { useCommittees } from '@/features/committees';
import {
  ADMISSION_SETUP_STEPS,
  ADMISSION_SETUP_TOTAL_STEPS,
  type AdmissionSetupStep,
} from '../config';
import {
  HorizontalStepper,
  type HorizontalStepDescriptor,
  type HorizontalStepState,
} from '../components/HorizontalStepper';
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
import { CycleMetadataPage } from './CycleMetadataPage';
import { ApplicationSettingsPage } from './ApplicationSettingsPage';
import { ApplicationStatusPage } from './ApplicationStatusPage';
import { AgeRulesPage } from './AgeRulesPage';
import { MaritalStatusRulesPage } from './MaritalStatusRulesPage';
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

const REVIEW_KEY = 'review' as const;
type WizardStepKey = AdmissionSetupStepKey | typeof REVIEW_KEY;

/* The renderer map mirrors ADMISSION_SETUP_STEPS — adding a 16th step is
 * one entry here plus the config append. */
const STEP_RENDERERS: Record<AdmissionSetupStepKey, () => JSX.Element> = {
  cycle_metadata: () => <CycleMetadataPage />,
  application_settings: () => <ApplicationSettingsPage />,
  application_status: () => <ApplicationStatusPage />,
  age_rules: () => <AgeRulesPage />,
  marital_status_rules: () => <MaritalStatusRulesPage />,
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

  const activeKey = (stepKey as WizardStepKey | undefined) ?? orderedSteps[0]!.key;
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
    return <Navigate to={ROUTES.admin.admissionSetup.wizard(orderedSteps[0]!.key)} replace />;
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

  const stepperItems: HorizontalStepDescriptor[] = orderedSteps.map((s) => ({
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
      goTo(orderedSteps[ADMISSION_SETUP_TOTAL_STEPS - 1]!.key);
      return;
    }
    if (isFirst) return;
    goTo(orderedSteps[activeIndex - 1]!.key);
  };

  const handleNext = (): void => {
    if (isReview) return;
    if (isFinalConfigStep) {
      goTo(REVIEW_KEY);
      return;
    }
    goTo(orderedSteps[activeIndex + 1]!.key);
  };

  const handleSaveDraft = (): void => {
    if (!cycleId) {
      toast('اختر دورة قبل حفظ المسودة', 'warning');
      return;
    }
    writeDraft(cycleId, activeKey);
    toast('تم حفظ المسودة — يمكنك الاستئناف لاحقاً', 'success');
  };

  const activeStep = isReview
    ? null
    : orderedSteps.find((s) => s.key === activeKey) ?? orderedSteps[0]!;

  return (
    <WizardModeProvider>
      <div className="flex flex-col gap-4 pb-32">
        <PageHeader
          title="إعداد التقديم"
          subtitle={
            cycleCtx.cycle
              ? `دورة "${cycleCtx.cycle.nameAr}" — الخطوة ${toEasternArabicNumerals(activeIndex + 1)} من ${toEasternArabicNumerals(ADMISSION_SETUP_TOTAL_STEPS + 1)}`
              : 'لم يتم اختيار دورة بعد — اختر دورة من لوحة الإعدادات'
          }
          actions={
            <Link to={ROUTES.admin.admissionSetup.index} className="inline-flex">
              <Button
                variant="ghost"
                size="sm"
                trailingIcon={
                  <ArrowRight size={14} strokeWidth={1.75} className="rtl:scale-x-[-1]" />
                }
              >
                لوحة التقديم
              </Button>
            </Link>
          }
        />

        <Card variant="elevated">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CycleSwitcher cycleCtx={cycleCtx} />
              <CurrentStepBadge
                step={activeStep}
                isReview={isReview}
                stepNumber={activeIndex + 1}
                total={ADMISSION_SETUP_TOTAL_STEPS + 1}
              />
            </div>
            <HorizontalStepper
              steps={stepperItems}
              activeKey={activeKey}
              onSelect={(k) => goTo(k as WizardStepKey)}
            />
          </div>
        </Card>

        <div className="min-w-0">
          {isReview ? (
            <WizardReviewPage statusInputs={statusInputs} />
          ) : (
            STEP_RENDERERS[activeKey as AdmissionSetupStepKey]()
          )}
        </div>

        <footer
          className="fixed inset-x-0 bottom-0 border-t border-border-subtle bg-surface-card px-6 py-3 shadow-md"
          style={{ zIndex: 'var(--z-sticky)' as unknown as number }}
        >
          <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-3">
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
): HorizontalStepState {
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
}): JSX.Element {
  const { cycle, availableCycles, setCycle } = cycleCtx;
  if (availableCycles.length === 0) {
    return (
      <p className="text-2xs text-gold-700">
        لا توجد دورات بعد. أنشئ دورة من{' '}
        <Link to={ROUTES.admin.cycleNew} className="font-medium underline">
          إدارة الدورات
        </Link>
        .
      </p>
    );
  }
  if (availableCycles.length === 1 || !cycle) {
    return (
      <p className="text-2xs text-ink-500">
        دورة الإعداد:{' '}
        <span className="font-medium text-ink-700">
          {cycle?.nameAr ?? 'لم تختر دورة'}
        </span>
      </p>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xs text-ink-500">دورة الإعداد</span>
      <div className="min-w-[240px]">
        <Combobox
          value={cycle.id}
          onChange={(next) => {
            if (next) setCycle(next);
          }}
          options={availableCycles.map((c) => ({ value: c.id, label: c.nameAr }))}
          placeholder="اختر دورة"
        />
      </div>
    </div>
  );
}

function CurrentStepBadge({
  step,
  isReview,
  stepNumber,
  total,
}: {
  step: AdmissionSetupStep | null;
  isReview: boolean;
  stepNumber: number;
  total: number;
}): JSX.Element {
  const label = isReview ? 'المراجعة والاعتماد' : step?.labelAr ?? '';
  return (
    <div className="flex items-center gap-2">
      <Badge tone="info">
        <span className="font-numeric tnum">
          الخطوة {toEasternArabicNumerals(stepNumber)} من {toEasternArabicNumerals(total)}
        </span>
      </Badge>
      <span className="font-ar-display text-md font-bold text-ink-900">{label}</span>
    </div>
  );
}
