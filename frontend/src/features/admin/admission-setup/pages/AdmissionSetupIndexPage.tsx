/**
 * AdmissionSetupIndexPage — launcher for the admission-setup wizard.
 *
 * Lists every admission cycle (the "application setups" in user-facing
 * terms) with status, completeness summary, and a "بدء التقديم / إكمال
 * الإعداد" CTA that opens the wizard at either the first step or the last
 * step the admin saved as a draft.
 *
 * The previous version listed all 15 steps inline as a card grid. The user
 * brief now wants a single sidebar entry + wizard flow, so the steps
 * surface only inside the wizard's top stepper — not here.
 */

import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FilePlus2, PlayCircle, Plus } from 'lucide-react';
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
import { ADMISSION_SETUP_STEPS, ADMISSION_SETUP_TOTAL_STEPS } from '../config';
import {
  computeStepStatus,
  type StepStatusInputs,
} from '../lib/step-status';
import { readDraft } from '../lib/wizard-draft';
import {
  useAdmissionMergeSplitRules,
  useElectronicDeclaration,
  useExamDateConfig,
  useTotalScoreConfigs,
} from '../api/admission-setup.queries';

export function AdmissionSetupIndexPage(): JSX.Element {
  const navigate = useNavigate();
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

  const startNewSetup = (): void => {
    /* "بدء التقديم" always means *start a fresh submission* — route to the
     * blank cycle creation form regardless of whether a cycle is currently
     * selected, so the admin sees empty fields ready for new data. The
     * `from=admission-setup` query tells `CycleNewPage` to land the user
     * back inside the wizard once the cycle is saved. */
    navigate(`${ROUTES.admin.cycleNew}?from=admission-setup`);
  };

  return (
    <AdmissionSetupShell hideStepHeader>
      <PageHeader
        title="التقديم"
        subtitle={`إدارة إعدادات سنوات التقديم — ${toEasternArabicNumerals(ADMISSION_SETUP_TOTAL_STEPS)} خطوة في معالج موحّد`}
        actions={
          <Button
            variant="primary"
            onClick={startNewSetup}
            leadingIcon={<FilePlus2 size={14} strokeWidth={1.75} />}
          >
            بدء التقديم
          </Button>
        }
      />

      {cycles.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span
              aria-hidden
              className="inline-flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: 'var(--accent-50)', color: 'var(--accent-600)' }}
            >
              <Plus size={20} strokeWidth={1.75} />
            </span>
            <h2 className="font-ar-display text-lg font-bold text-ink-900">
              لا توجد إعدادات تقديم بعد
            </h2>
            <p className="max-w-md text-sm text-ink-700 leading-relaxed">
              ابدأ بإنشاء سنة تقديم جديدة ثم اتبع المعالج لتعبئة الخطوات الـ
              {' '}{toEasternArabicNumerals(ADMISSION_SETUP_TOTAL_STEPS)} بترتيب.
            </p>
            <Button
              variant="primary"
              onClick={startNewSetup}
              leadingIcon={<FilePlus2 size={14} strokeWidth={1.75} />}
            >
              بدء التقديم
            </Button>
          </div>
        </Card>
      ) : (
        <SetupList cycles={cycles} />
      )}
    </AdmissionSetupShell>
  );
}

function SetupList({ cycles }: { cycles: AdmissionCycle[] }): JSX.Element {
  const navigate = useNavigate();
  const cycleCtx = useAdmissionSetupCycle();
  return (
    <section aria-label="إعدادات التقديم" className="grid gap-3">
      {cycles.map((cycle) => (
        <SetupRow
          key={cycle.id}
          cycle={cycle}
          onOpen={(stepKey) => {
            cycleCtx.setCycle(cycle.id);
            navigate(ROUTES.admin.admissionSetup.wizard(stepKey));
          }}
        />
      ))}
    </section>
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
  const resumeStepKey = draft?.lastStepKey ?? 'cycle_metadata';

  const isApproved =
    cycle.status === 'active' || cycle.status === 'open' || cycle.status === 'extended';

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
            onClick={() => onOpen('cycle_metadata')}
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
