/**
 * ApplicantPortalLayout — wraps every applicant-portal route with the
 * shared Wizard, pulls draft + suspension state, and renders the
 * suspended-applicant guard banner per KARASA_GAPS §2.3.
 */

import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { Ban, BellRing, HelpCircle } from 'lucide-react';
import { AppShell } from '@/app/layouts/AppShell';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { Wizard } from '@/shared/components';
import type { WizardStep, WizardStepState } from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { useDraft } from './api/applicantPortal.queries';

export const STAGE_KEYS = [
  'auth/step-1',
  'auth/step-2',
  'profile/personal',
  'profile/education',
  'profile/marital',
  'payment',
  'profile/family',
  'exam-schedule',
  'print-card',
  'follow-up',
  'acquaintance-doc',
] as const;

export const STAGE_LABELS = [
  'التحقق · الهاتف',
  'التحقق · رمز SMS',
  'البيانات الشخصية',
  'البيانات التعليمية',
  'الحالة الاجتماعية',
  'سداد رسوم التقديم',
  'بيانات الأسرة',
  'موعد الاختبار',
  'طباعة كارت التردد',
  'متابعة الإجراءات',
  'وثيقة التعارف',
] as const;

const APPLICANT_ID = 'APP-2026000';

export function ApplicantPortalLayout(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: draft } = useDraft(APPLICANT_ID);

  const activeIndex = useMemo(() => {
    const path = location.pathname.replace(/^\/applicant\/?/, '');
    if (!path) return 0;
    const idx = STAGE_KEYS.findIndex((k) => path.startsWith(k));
    return idx === -1 ? 0 : idx;
  }, [location.pathname]);

  const steps: WizardStep[] = STAGE_KEYS.map((key, i): WizardStep => {
    const reached = (draft?.furthestStage ?? 0) >= i + 1;
    let state: WizardStepState = 'upcoming';
    if (i < activeIndex && reached) state = 'complete';
    else if (i === activeIndex) state = 'current';
    else if (!reached && i > activeIndex) state = 'upcoming';
    if (draft?.suspended && i > 0) state = 'blocked';
    return { key, label: STAGE_LABELS[i] ?? key, state };
  });

  const autoSaveStatus = draft && Date.now() - draft.lastSavedAt < 4_000 ? 'saved' : 'idle';

  return (
    <AppShell app="applicant" appLabel="موقع المتقدمين · 1.2">
      {draft?.suspended && <SuspendedBanner />}
      <CenteredShell>
        <Wizard
          title="رحلة المتقدم"
          steps={steps}
          activeStepKey={STAGE_KEYS[activeIndex] ?? STAGE_KEYS[0]}
          onStepClick={(key) => navigate(`${ROUTES.applicant}/${key}`)}
          autoSaveStatus={autoSaveStatus}
        >
          <Outlet />
        </Wizard>
      </CenteredShell>

      <FloatingHelp />
    </AppShell>
  );
}

function SuspendedBanner(): JSX.Element {
  return (
    <div
      role="alert"
      className="mb-4 flex items-center gap-3 rounded-md border border-terra-500 bg-terra-50 px-4 py-3 text-sm text-terra-800"
    >
      <Ban size={18} strokeWidth={1.75} aria-hidden />
      <p>
        طلبك <span className="font-bold">موقوف مؤقتاً</span>. لا يمكن إجراء تعديلات حالياً.
        سيتم إخطارك فور تحديث الحالة.
      </p>
    </div>
  );
}

function FloatingHelp(): JSX.Element {
  return (
    <aside
      className="no-print fixed bottom-6 inset-inline-end-6 flex items-center gap-2 rounded-pill bg-surface-card px-3 py-2 shadow-md"
      style={{ zIndex: 'var(--z-raised)' as unknown as number }}
    >
      <BellRing size={14} strokeWidth={1.75} className="text-teal-700" aria-hidden />
      <span className="text-2xs text-ink-700">دعم فني</span>
      <a
        href="tel:19000"
        className="rounded-md bg-teal-500 px-2 py-1 text-2xs font-medium text-white hover:bg-teal-600"
      >
        19000
      </a>
      <HelpCircle size={14} strokeWidth={1.75} className="text-ink-500" aria-hidden />
    </aside>
  );
}
