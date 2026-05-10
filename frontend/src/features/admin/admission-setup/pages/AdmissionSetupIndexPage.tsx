/**
 * AdmissionSetupIndexPage — landing for `/admin/admission-setup`.
 *
 * Lists all 15 steps as a 3-column grid (RTL). Each card carries:
 *   • step number (Eastern Arabic numeral)
 *   • Arabic label
 *   • subtitle from the config
 *   • status pill (`مكتمل` / `قيد التطوير` / `لم يبدأ`)
 *   • click → step route
 *
 * Status pills key off `computeStepStatus()` in `lib/step-status.ts` so
 * adding a new step needs no change here — only the config + checker.
 */

import { Link } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
} from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { useCategoriesAdmin } from '@/features/admin/api/categories.queries';
import { useCommittees } from '@/features/committees';
import { toEasternArabicNumerals } from '@/shared/lib/arabic';
import { hasPermission, useAuthStore } from '@/features/auth';
import { AdmissionSetupShell } from '../components/AdmissionSetupShell';
import { useAdmissionSetupCycle } from '../hooks/useAdmissionSetupCycle';
import {
  ADMISSION_SETUP_STEPS,
  ADMISSION_SETUP_TOTAL_STEPS,
  type AdmissionSetupStep,
} from '../config';
import {
  computeStepStatus,
  STEP_STATUS_LABEL,
  STEP_STATUS_TONE,
} from '../lib/step-status';
import {
  useAdmissionMergeSplitRules,
  useExamDateConfig,
  useTotalScoreConfigs,
  useElectronicDeclaration,
} from '../api/admission-setup.queries';

export function AdmissionSetupIndexPage(): JSX.Element {
  const cycleCtx = useAdmissionSetupCycle();
  const { cycle } = cycleCtx;
  const cycleId = cycle?.id ?? null;
  const categoriesQuery = useCategoriesAdmin();
  const committeesQuery = useCommittees();
  const mergeSplitQuery = useAdmissionMergeSplitRules(cycleId);
  const examDatesQuery = useExamDateConfig(cycleId);
  const totalScoreQuery = useTotalScoreConfigs(cycleId);
  const declarationQuery = useElectronicDeclaration(cycleId);
  const user = useAuthStore((s) => s.user);
  const canRead = Boolean(user && hasPermission(user.permissions, 'admission-setup:read'));

  if (!canRead) {
    return (
      <CenteredShell>
        <EmptyState variant="generic" title="ليس لديك صلاحية الاطلاع على إعدادات التقديم" />
      </CenteredShell>
    );
  }

  const inputs = {
    cycle,
    categories: categoriesQuery.data ?? [],
    committees: committeesQuery.data ?? [],
    mergeSplitRules: mergeSplitQuery.data ?? [],
    examDateConfig: examDatesQuery.data ?? null,
    totalScoreConfigs: totalScoreQuery.data ?? [],
    declaration: declarationQuery.data ?? null,
  };

  return (
    <AdmissionSetupShell hideStepHeader>
      <PageHeader
        title="إعداد التقديم"
        subtitle={
          cycle
            ? `إعدادات دورة "${cycle.nameAr}" — ${toEasternArabicNumerals(ADMISSION_SETUP_TOTAL_STEPS)} خطوة`
            : `${toEasternArabicNumerals(ADMISSION_SETUP_TOTAL_STEPS)} خطوة لإعداد دورة قبول جديدة`
        }
        actions={
          !cycle ? (
            <Link to={ROUTES.admin.cycleNew} className="inline-flex">
              <Button variant="primary" leadingIcon={<Plus size={14} strokeWidth={1.75} />}>
                إنشاء دورة جديدة
              </Button>
            </Link>
          ) : undefined
        }
      />

      {!cycle && (
        <Card>
          <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
            <h2 className="font-ar-display text-lg font-bold text-ink-900">
              يجب اختيار دورة قبول لإكمال الإعدادات
            </h2>
            <p className="max-w-md text-sm text-ink-700 leading-relaxed">
              لا توجد دورة قبول مفعّلة حالياً. أنشئ دورة جديدة أو فعّل دورة موجودة من إدارة الدورات.
            </p>
            <Link to={ROUTES.admin.cycles} className="inline-flex">
              <Button
                variant="ghost"
                size="sm"
                trailingIcon={<ArrowRight size={14} strokeWidth={1.75} className="rtl:scale-x-[-1]" />}
              >
                إدارة الدورات
              </Button>
            </Link>
          </div>
        </Card>
      )}

      <section
        aria-label="خطوات الإعداد"
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        {ADMISSION_SETUP_STEPS.map((step) => (
          <StepCard key={step.key} step={step} status={computeStepStatus(step.key, inputs)} />
        ))}
      </section>
    </AdmissionSetupShell>
  );
}

function StepCard({
  step,
  status,
}: {
  step: AdmissionSetupStep;
  status: 'complete' | 'in_progress' | 'not_started';
}): JSX.Element {
  const StepIcon = step.icon;
  const route = `/admin/admission-setup/${step.routeSegment}`;
  return (
    <Link
      to={route}
      className="group block rounded-md focus-visible:shadow-focus-teal focus-visible:outline-none"
      aria-label={step.labelAr}
    >
      <Card
        variant="elevated"
        className="h-full transition-shadow duration-fast ease-standard group-hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="inline-flex h-10 w-10 items-center justify-center rounded-md"
              style={{ background: 'var(--accent-50)', color: 'var(--accent-600)' }}
            >
              <StepIcon size={18} strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-2xs text-ink-500 font-numeric tnum">
                الخطوة {toEasternArabicNumerals(step.order)}
              </p>
              <h3 className="font-ar-display text-md font-bold text-ink-900 leading-tight">
                {step.labelAr}
              </h3>
            </div>
          </div>
          <Badge tone={STEP_STATUS_TONE[status]}>{STEP_STATUS_LABEL[status]}</Badge>
        </div>
        <p className="mt-3 text-2xs text-ink-500 leading-relaxed">{step.subtitleAr}</p>
      </Card>
    </Link>
  );
}
