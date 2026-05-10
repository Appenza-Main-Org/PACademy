/**
 * AdmissionSetupIndexPage — launcher for the admission-setup wizard.
 *
 * Lists every already-configured admission cycle (the "application setups"
 * in user-facing terms) with status, completeness summary, and a
 * "بدء التقديم / إكمال الإعداد" CTA that opens the wizard at either the
 * first step or the last step the admin saved as a draft.
 *
 * The active cycle is hoisted to a dedicated highlight card at the top
 * with a primary "بدء التقديم" CTA — admins enter the wizard by selecting
 * an existing cycle, never by creating one here. Cycle creation /
 * metadata editing live in the Cycles section (/admin/cycles).
 */

import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PlayCircle, Settings } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
} from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { useCycles } from '@/features/admin/api/cycles.queries';
import { useCategoriesAdmin } from '@/features/admin/api/categories.queries';
import { useCommittees } from '@/features/committees';
import { date as fmtDate } from '@/shared/lib/format';
import { toEasternArabicNumerals } from '@/shared/lib/arabic';
import { hasPermission, useAuthStore } from '@/features/auth';
import type { AdmissionCycle } from '@/shared/types/domain';
import { AdmissionSetupShell } from '../components/AdmissionSetupShell';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';
import {
  ADMISSION_SETUP_STEPS,
  ADMISSION_SETUP_TOTAL_STEPS,
} from '../config';
import {
  computeStepStatus,
  type StepStatusInputs,
} from '../lib/step-status';
import { readDraft } from '../lib/wizard-draft';
import type { AdmissionSetupStepKey } from '../types';
import {
  useAdmissionMergeSplitRules,
  useElectronicDeclaration,
  useExamDateConfig,
  useTotalScoreConfigs,
} from '../api/admission-setup.queries';

/** First wizard step after cycle_metadata was removed — admins land here. */
const FIRST_STEP: AdmissionSetupStepKey = 'application_settings';

const ACTIVE_STATUSES: ReadonlySet<AdmissionCycle['status']> = new Set([
  'active',
  'open',
  'extended',
]);

export function AdmissionSetupIndexPage(): JSX.Element {
  const navigate = useNavigate();
  const cycleCtx = useAdmissionSetupCycle();
  const cyclesQuery = useCycles();
  const cycles = cyclesQuery.data ?? [];
  const user = useAuthStore((s) => s.user);
  const canRead = Boolean(user && hasPermission(user.permissions, 'admission-setup:read'));

  if (!canRead) {
    return (
      <CenteredShell>
        <EmptyState variant="generic" title="ليس لديك صلاحية الاطلاع على إعدادات التقديم" />
      </CenteredShell>
    );
  }

  const activeCycle = cycles.find((c) => ACTIVE_STATUSES.has(c.status)) ?? null;
  const otherCycles = cycles.filter((c) => c.id !== activeCycle?.id);

  const openWizard = (cycleId: string, stepKey: string): void => {
    cycleCtx.setCycle(cycleId);
    navigate(ROUTES.admin.admissionSetup.wizard(stepKey));
  };

  return (
    <AdmissionSetupShell hideStepHeader>
      <PageHeader
        title="التقديم"
        subtitle={`إدارة إعدادات سنوات التقديم — ${toEasternArabicNumerals(ADMISSION_SETUP_TOTAL_STEPS)} خطوة في معالج موحّد`}
        actions={
          <Button
            variant="ghost"
            onClick={() => navigate(ROUTES.admin.cycles)}
            leadingIcon={<Settings size={14} strokeWidth={1.75} />}
          >
            إدارة الدورات
          </Button>
        }
      />

      {cycles.length === 0 ? (
        <NoCyclesEmptyState onGoToCycles={() => navigate(ROUTES.admin.cycles)} />
      ) : (
        <div className="flex flex-col gap-4">
          {activeCycle ? (
            <ActiveCycleCard
              cycle={activeCycle}
              onStart={(stepKey) => openWizard(activeCycle.id, stepKey)}
            />
          ) : (
            <NoActiveCycleNotice onGoToCycles={() => navigate(ROUTES.admin.cycles)} />
          )}

          {otherCycles.length > 0 && (
            <section aria-label="دورات أخرى" className="flex flex-col gap-2">
              <h2 className="text-2xs font-medium uppercase tracking-wide text-ink-500">
                دورات أخرى
              </h2>
              <div className="grid gap-3">
                {otherCycles.map((cycle) => (
                  <SetupRow
                    key={cycle.id}
                    cycle={cycle}
                    onOpen={(stepKey) => openWizard(cycle.id, stepKey)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </AdmissionSetupShell>
  );
}

function NoCyclesEmptyState({ onGoToCycles }: { onGoToCycles: () => void }): JSX.Element {
  return (
    <Card>
      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <span
          aria-hidden
          className="inline-flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: 'var(--accent-50)', color: 'var(--accent-600)' }}
        >
          <Settings size={20} strokeWidth={1.75} />
        </span>
        <h2 className="font-ar-display text-lg font-bold text-ink-900">
          لا توجد دورات قبول مُعدّة
        </h2>
        <p className="max-w-md text-sm text-ink-700 leading-relaxed">
          أنشئ دورة قبول وفعّلها من قسم إدارة الدورات، ثم عُد هنا لإكمال إعدادات التقديم
          الـ {toEasternArabicNumerals(ADMISSION_SETUP_TOTAL_STEPS)} لها.
        </p>
        <Button
          variant="primary"
          onClick={onGoToCycles}
          leadingIcon={<Settings size={14} strokeWidth={1.75} />}
        >
          الذهاب لإدارة الدورات
        </Button>
      </div>
    </Card>
  );
}

function NoActiveCycleNotice({ onGoToCycles }: { onGoToCycles: () => void }): JSX.Element {
  return (
    <Card variant="elevated" className="border border-gold-300 bg-gold-50">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1">
        <div className="min-w-0">
          <h2 className="font-ar-display text-md font-bold text-gold-800">
            لا توجد دورة قبول نشطة حالياً
          </h2>
          <p className="mt-1 text-2xs leading-relaxed text-gold-700">
            فعّل إحدى الدورات من قسم إدارة الدورات قبل بدء التقديم. تظهر الدورات المعدّة الأخرى
            في الأسفل للمراجعة فقط.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={onGoToCycles}
          leadingIcon={<Settings size={14} strokeWidth={1.75} />}
        >
          إدارة الدورات
        </Button>
      </div>
    </Card>
  );
}

function ActiveCycleCard({
  cycle,
  onStart,
}: {
  cycle: AdmissionCycle;
  onStart: (stepKey: string) => void;
}): JSX.Element {
  const categoriesQuery = useCategoriesAdmin();
  const committeesQuery = useCommittees();
  const mergeSplitQuery = useAdmissionMergeSplitRules(cycle.id);
  const examDatesQuery = useExamDateConfig(cycle.id);
  const totalScoreQuery = useTotalScoreConfigs(cycle.id);
  const declarationQuery = useElectronicDeclaration(cycle.id);

  const inputs: StepStatusInputs = {
    cycle,
    categories: categoriesQuery.data ?? [],
    committees: committeesQuery.data ?? [],
    mergeSplitRules: mergeSplitQuery.data ?? [],
    examDateConfig: examDatesQuery.data ?? null,
    totalScoreConfigs: totalScoreQuery.data ?? [],
    declaration: declarationQuery.data ?? null,
  };
  const completed = ADMISSION_SETUP_STEPS.filter(
    (s) => computeStepStatus(s.key, inputs) === 'complete',
  ).length;
  const draft = readDraft(cycle.id);
  const resumeStepKey = draft?.lastStepKey ?? FIRST_STEP;

  return (
    <Card variant="elevated" className="border-t-4" style={{ borderTopColor: 'var(--accent-500)' }}>
      <div className="flex flex-wrap items-center justify-between gap-4 p-1">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">الدورة النشطة</Badge>
            <h2 className="font-ar-display text-lg font-bold text-ink-900">{cycle.nameAr}</h2>
            <Badge tone="success">{arStatusLabel(cycle.status)}</Badge>
            {draft && (
              <Badge tone="info">
                مسودة — آخر حفظ {fmtDate(draft.savedAt, 'short')}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-2xs text-ink-500">
            <span className="font-numeric tnum">
              {toEasternArabicNumerals(completed)} من {toEasternArabicNumerals(ADMISSION_SETUP_TOTAL_STEPS)}
            </span>{' '}
            خطوة مكتملة · {fmtDate(cycle.openDate, 'short')} → {fmtDate(cycle.closeDate, 'short')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {draft && (
            <Button
              variant="secondary"
              onClick={() => onStart(resumeStepKey)}
              leadingIcon={<PlayCircle size={14} strokeWidth={1.75} />}
            >
              متابعة المسودة
            </Button>
          )}
          <Button
            variant="primary"
            onClick={() => onStart(FIRST_STEP)}
            trailingIcon={
              <ArrowLeft size={14} strokeWidth={1.75} className="rtl:scale-x-[-1]" />
            }
          >
            بدء التقديم
          </Button>
        </div>
      </div>
    </Card>
  );
}

function SetupRow({
  cycle,
  onOpen,
}: {
  cycle: AdmissionCycle;
  onOpen: (stepKey: string) => void;
}): JSX.Element {
  const categoriesQuery = useCategoriesAdmin();
  const committeesQuery = useCommittees();
  const mergeSplitQuery = useAdmissionMergeSplitRules(cycle.id);
  const examDatesQuery = useExamDateConfig(cycle.id);
  const totalScoreQuery = useTotalScoreConfigs(cycle.id);
  const declarationQuery = useElectronicDeclaration(cycle.id);

  const inputs: StepStatusInputs = {
    cycle,
    categories: categoriesQuery.data ?? [],
    committees: committeesQuery.data ?? [],
    mergeSplitRules: mergeSplitQuery.data ?? [],
    examDateConfig: examDatesQuery.data ?? null,
    totalScoreConfigs: totalScoreQuery.data ?? [],
    declaration: declarationQuery.data ?? null,
  };

  const completed = ADMISSION_SETUP_STEPS.filter(
    (s) => computeStepStatus(s.key, inputs) === 'complete',
  ).length;

  const draft = readDraft(cycle.id);
  const resumeStepKey = draft?.lastStepKey ?? FIRST_STEP;

  const isApproved = ACTIVE_STATUSES.has(cycle.status);

  return (
    <Card variant="elevated">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-ar-display text-md font-bold text-ink-900">{cycle.nameAr}</h3>
            <Badge tone={isApproved ? 'success' : draftTone(cycle.status)}>
              {arStatusLabel(cycle.status)}
            </Badge>
            {draft && (
              <Badge tone="info">
                مسودة — آخر حفظ {fmtDate(draft.savedAt, 'short')}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-2xs text-ink-500">
            <span className="font-numeric tnum">
              {toEasternArabicNumerals(completed)} من {toEasternArabicNumerals(ADMISSION_SETUP_TOTAL_STEPS)}
            </span>{' '}
            خطوة مكتملة · آخر تحديث {fmtDate(cycle.updatedAt ?? cycle.openDate, 'short')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {draft && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpen(resumeStepKey)}
              leadingIcon={<PlayCircle size={14} strokeWidth={1.75} />}
            >
              متابعة المسودة
            </Button>
          )}
          <Button
            variant={draft ? 'ghost' : 'primary'}
            size="sm"
            onClick={() => onOpen(FIRST_STEP)}
            trailingIcon={
              <ArrowLeft size={14} strokeWidth={1.75} className="rtl:scale-x-[-1]" />
            }
          >
            {isApproved ? 'مراجعة الإعدادات' : 'إكمال الإعداد'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function arStatusLabel(status: AdmissionCycle['status']): string {
  switch (status) {
    case 'draft':
      return 'مسودة';
    case 'open':
      return 'مفتوحة';
    case 'active':
      return 'مفعّلة';
    case 'extended':
      return 'مُمدَّدة';
    case 'closed':
      return 'مغلقة';
    case 'processing':
      return 'قيد التقييم';
    case 'finalized':
      return 'منتهية';
    case 'archived':
      return 'مؤرشفة';
  }
}

function draftTone(status: AdmissionCycle['status']): 'neutral' | 'warning' | 'info' {
  if (status === 'draft') return 'warning';
  if (status === 'archived' || status === 'finalized' || status === 'closed') return 'neutral';
  return 'info';
}
