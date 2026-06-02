/**
 * ApplicantPortalLayout — minimal chrome for the 11-stage applicant wizard.
 * Source: ARCH-04 (third shell — minimal, no sidebar, focus on the wizard).
 *
 * Differences vs. AppShell (staff shell):
 *  - No app-key sidebar (the Wizard is the only navigation)
 *  - Slim public-style header with academy crest + small "خروج"
 *  - Same Khayameya stripe up top + tessellation watermark behind
 *  - Suspended banner + auto-save indicator + FloatingHelp at bottom-end
 */

import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { Ban, LogOut, Pencil } from 'lucide-react';
import {
  AlertDialog,
  Badge,
  KhayameyaStripe,
  LogoMark,
  Pattern,
  Wizard,
  toast,
} from '@/shared/components';
import type { WizardStep, WizardStepState } from '@/shared/components';
import { MOCK } from '@/shared/mock-data';
import { ROUTES } from '@/config/routes';
import { useAuthStore } from '@/features/auth';
import { useAcquaintanceDocStatus, useDraft } from './api/applicantPortal.queries';
import { useApplicantPortalStore } from './store/applicantPortal.store';
import { ApplicantAvailabilityGate } from './components/ApplicantAvailabilityGate';
import {
  isApplicantAppointmentLocked,
  isApplicantFamilyLocked,
  isApplicantPaymentLocked,
  isApplicantRouteLocked,
} from './lib/application-lock';
import {
  VOTHIQA_EXPIRED_NID,
  VOTHIQA_FILLABLE_NID,
  VOTHIQA_LAW_BACHELOR_NID,
  VOTHIQA_SPECIALIZED_OFFICERS_NID,
} from './lib/moi-session.mock';

/* NIDs that get the وثيقة تعارف stepper step un-skipped + the
 * post-submission «وثيقة تعارف» tab. Other demo users still see the
 * dimmed/skipped step. Expand this set as new قسم templates ship. */
const VOTHIQA_ENABLED_NIDS = new Set<string>([
  VOTHIQA_FILLABLE_NID,
  VOTHIQA_EXPIRED_NID,
  VOTHIQA_SPECIALIZED_OFFICERS_NID,
  VOTHIQA_LAW_BACHELOR_NID,
]);

/**
 * Wizard sequence — MOI-aligned post-SSO (PDF DOC-20220806-WA0053).
 *
 * The applicant arrives already-authenticated from moi.gov.eg, so the
 * legacy phone/SMS auth (Stage 1+2) and the re-verify screen (PDF p.5
 * lower) are skipped. The MOI session carries NID, mobile, and the
 * applicant identity straight into the profile step.
 *
 * Stages 3+4+5 (personal / education / marital) are collapsed into a
 * single `profile` step per PDF p.4. The summary is the index of
 * `/applicant` and counts as a stepper node.
 */
export const STAGE_KEYS = [
  'profile',
  '', // summary — the `/applicant` index route
  'payment',
  'profile/family',
  'profile/family-review',
  'exam-schedule',
  'print-card',
  'follow-up',
  'acquaintance-doc',
] as const;

export const STAGE_LABELS = [
  'البيانات الشخصية والدراسية',
  'ملخّص الطلب',
  'سداد رسوم التقديم',
  'بيانات العائلة',
  'عرض واعتماد بيانات العائلة',
  'موعد الاختبار',
  'بطاقة التردد',
  'نتائج الاختبارات',
  'وثيقة التعارف',
] as const;

const APPLICANT_ID = 'APP-2026000';

/** Compute the URL of the next stage the applicant should resume at. */
export function nextApplicantStageUrl(furthestStage: number): string {
  const idx = Math.min(STAGE_KEYS.length - 1, Math.max(0, furthestStage));
  return `${ROUTES.applicant}/${STAGE_KEYS[idx]}`;
}

/**
 * URL of the previous visible stage relative to `activeIndex`, or `null`
 * when there's no earlier step. Skips the empty summary key so «السابق»
 * lands on a real page (e.g. payment → profile, not the filtered-out
 * summary index). Used to wire the wizard's back button — see the
 * `backUrl` gate in ApplicantPortalLayout, which suppresses it once the
 * exam slot is chosen (the application locks).
 */
export function prevApplicantStageUrl(activeIndex: number): string | null {
  for (let i = activeIndex - 1; i >= 0; i--) {
    if (STAGE_KEYS[i] !== '') return `${ROUTES.applicant}/${STAGE_KEYS[i]}`;
  }
  return null;
}

export function ApplicantPortalLayout(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: draft } = useDraft(APPLICANT_ID);
  const clear = useAuthStore((s) => s.clear);
  const selectedCategoryKey = useApplicantPortalStore((s) => s.selectedCategoryKey);
  const submittedDemo = useApplicantPortalStore((s) => s.submittedDemo);
  const currentNid = useApplicantPortalStore((s) => s.nationalId);
  const paid = useApplicantPortalStore((s) => s.paid);
  const parentsApproved = useApplicantPortalStore((s) => s.parentsApproved);
  const {
    data: acquaintanceDocStatus,
    refetch: refetchAcquaintanceDocStatus,
  } = useAcquaintanceDocStatus(currentNid ?? APPLICANT_ID);
  const isDemoVothiqaApplicant = currentNid !== null && VOTHIQA_ENABLED_NIDS.has(currentNid);
  const isBackendVothiqaAvailable = Boolean(
    acquaintanceDocStatus?.isOpen ||
    acquaintanceDocStatus?.isClosed ||
    acquaintanceDocStatus?.canEdit ||
    acquaintanceDocStatus?.canPrint,
  );
  const vothiqaEnabled = isDemoVothiqaApplicant || isBackendVothiqaAvailable;
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const selectedCategory = selectedCategoryKey
    ? MOCK.categories.find((c) => c.key === selectedCategoryKey) ?? null
    : null;
  /* "Irreversible step" = Stage 6 payment committed. After that the user
   * cannot switch category without an admin action; the badge becomes read-only. */
  const paymentLocked = isApplicantPaymentLocked(draft, paid);
  const familyLocked = isApplicantFamilyLocked(draft, parentsApproved);
  const appointmentLocked = isApplicantAppointmentLocked(draft);
  const categoryLocked = paymentLocked;
  const routeLockState = useMemo(
    () => ({ paymentLocked, familyLocked, appointmentLocked }),
    [appointmentLocked, familyLocked, paymentLocked],
  );

  const activeIndex = useMemo(() => {
    const path = location.pathname.replace(/^\/applicant\/?/, '');
    /* Empty path = `/applicant` index = the summary stage. */
    const exact = STAGE_KEYS.indexOf(path as typeof STAGE_KEYS[number]);
    if (exact !== -1) return exact;
    /* Fall back: any nested child path (e.g. legacy /applicant/profile/personal
     * before its redirect kicks in) lands on its parent stage. Skip the
     * empty key so it never matches via startsWith. */
    const idx = STAGE_KEYS.findIndex((k) => k !== '' && path.startsWith(`${k}/`));
    return idx === -1 ? 0 : idx;
  }, [location.pathname]);

  const isLockedEditableRoute = useMemo(() => {
    return isApplicantRouteLocked(location.pathname, routeLockState);
  }, [location.pathname, routeLockState]);

  useEffect(() => {
    if (!isLockedEditableRoute) return;
    toast('تم قفل بيانات الطلب بعد السداد. يمكنك عرض البيانات فقط.', 'warning');
    navigate(ROUTES.applicant, { replace: true });
  }, [isLockedEditableRoute, navigate]);

  useEffect(() => {
    if ((draft?.furthestStage ?? 0) < 8) return;
    void refetchAcquaintanceDocStatus();
  }, [draft?.furthestStage, refetchAcquaintanceDocStatus]);

  /* «السابق» — backward navigation through the wizard steps. Available
   * until payment/submission locks the file; once locked, the guard above
   * returns editable routes to the read-only dashboard. Forward navigation
   * stays owned by each page's own CTA so step validation isn't bypassed. */
  const backUrl = paymentLocked ? null : prevApplicantStageUrl(activeIndex);
  const handleStepClick = (key: string): void => {
    const targetIndex = STAGE_KEYS.indexOf(key as typeof STAGE_KEYS[number]);
    if (targetIndex === -1 || targetIndex > activeIndex) return;
    if (isApplicantRouteLocked(`${ROUTES.applicant}/${key}`, routeLockState)) return;
    navigate(`${ROUTES.applicant}/${key}`);
  };

  /* Step rendering — the empty-key entry (summary, served by the
   * `/applicant` index) is filtered out of the visible stepper per
   * client request. Raw STAGE_KEYS indices are preserved upstream so
   * draft.furthestStage math (and admin reports) keep working. */
  const steps: WizardStep[] = STAGE_KEYS.map((key, i): WizardStep => {
    const reached = (draft?.furthestStage ?? 0) >= i + 1;
    let state: WizardStepState = 'upcoming';
    if (i < activeIndex && reached) state = 'complete';
    else if (i === activeIndex) state = 'current';
    else if (!reached && i > activeIndex) state = 'upcoming';
    if (draft?.suspended && i > 0) state = 'blocked';
    if (
      (key === 'profile' && paymentLocked) ||
      (key === 'payment' && paymentLocked) ||
      (key === 'profile/family' && familyLocked) ||
      (key === 'profile/family-review' && familyLocked) ||
      (key === 'exam-schedule' && appointmentLocked)
    ) {
      state = 'blocked';
    }
    /* وثيقة التعارف is parked for most demo users — render the step
     * as dimmed/skipped so the stepper still shows it. The Case-1
     * demo NIDs (VOTHIQA_ENABLED_NIDS) un-skip it so they can walk
     * through the full 31-form entry experience. */
    if (key === 'acquaintance-doc' && !vothiqaEnabled) state = 'skipped';
    return { key, label: STAGE_LABELS[i] ?? key, state };
  }).filter((s) => s.key !== '');

  const autoSaveStatus = draft && Date.now() - draft.lastSavedAt < 4_000 ? 'saved' : 'idle';

  const handleExit = (): void => {
    setExitDialogOpen(false);
    clear();
    toast('تم الخروج. يمكنك العودة لاحقاً عبر صفحة التقديم.', 'info');
    navigate(ROUTES.landing, { replace: true });
  };

  return (
    <div data-app="applicant" className="page-enter relative flex min-h-screen flex-col bg-surface-page">
      <KhayameyaStripe height="sm" />

      {/* Slim public-style header — applicant doesn't get the staff sidebar/chrome */}
      <header className="sticky top-0 flex h-16 items-center justify-between gap-4 border-b border-border-subtle bg-surface-card px-6"
        style={{ zIndex: 'var(--z-sticky)' as unknown as number }}>
        <a href={ROUTES.landing} className="flex items-center gap-3 rounded-md px-1 py-1 -mx-1 hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none">
          <LogoMark size={36} ariaLabel="شعار أكاديمية الشرطة" />
          <span className="hidden flex-col leading-tight md:flex">
            <span className="font-ar-display text-sm font-bold text-ink-900">منظومة القبول</span>
            <span className="text-2xs text-ink-500">رحلة التقديم</span>
          </span>
        </a>
        <div className="flex items-center gap-2">
          {selectedCategory && (
            <span className="hidden items-center md:inline-flex">
              {categoryLocked ? (
                <Badge tone="brand">{selectedCategory.labelAr}</Badge>
              ) : (
                <Link
                  to={ROUTES.applicantStart}
                  title="تغيير الفئة"
                  className="group inline-flex items-center gap-1.5 rounded-md border border-border-default bg-surface-page px-2.5 py-1.5 text-xs font-medium text-ink-800 transition-colors hover:border-teal-500 hover:bg-teal-50 hover:text-teal-700 focus-visible:shadow-focus-teal focus-visible:outline-none"
                >
                  <span>{selectedCategory.labelAr}</span>
                  <Pencil size={13} strokeWidth={1.75} className="text-ink-500 group-hover:text-teal-600" />
                </Link>
              )}
            </span>
          )}
          <button
            type="button"
            onClick={() => setExitDialogOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-surface-card px-3 py-1.5 text-xs font-medium text-ink-800 transition-colors hover:border-terra-500 hover:bg-terra-50 hover:text-terra-700 focus-visible:shadow-focus-teal focus-visible:outline-none"
          >
            <LogOut size={15} strokeWidth={1.75} /> خروج
          </button>
        </div>
      </header>

      <AlertDialog
        open={exitDialogOpen}
        onOpenChange={setExitDialogOpen}
        title="الخروج من ملف التقديم"
        description="سيتم حفظ تقدّمك تلقائياً، ويمكنك العودة لاحقاً عبر صفحة التقديم."
        actionLabel="الخروج"
        cancelLabel="متابعة التقديم"
        onAction={handleExit}
      />

      <Pattern variant="tessellation-8" tile={96} opacity={0.04} />

      <div className="relative mx-auto w-full max-w-[1200px] flex-1 px-6 pb-12 pt-6">
        <ApplicantAvailabilityGate allowWhenUnavailable={submittedDemo}>
        {draft?.suspended && <SuspendedBanner />}
        {submittedDemo ? (
          /* Post-submission view (client direction 2026-05-19): only the
             demo "submitted" applicant lands here on login. The wizard
             flow is unchanged for everyone else, even after picking
             موعد الاختبار. The 4-section tab strip below — البيانات
             الأساسية / التنبيهات / كارت التردد / نتائج الاختبارات —
             replaces the wizard. */
          <div className="flex flex-col gap-4">
            <PostExamNav vothiqaEnabled={vothiqaEnabled} />
            {draft?.suspended ? <SuspendedScreen /> : isLockedEditableRoute ? null : <Outlet />}
          </div>
        ) : (
          <Wizard
            title="خطوات المتقدم · دفعة 2026"
            steps={steps}
            activeStepKey={STAGE_KEYS[activeIndex] ?? STAGE_KEYS[0]}
            autoSaveStatus={autoSaveStatus}
            onStepClick={handleStepClick}
            onBack={backUrl ? () => navigate(backUrl) : undefined}
          >
            {/* AUD-007 — when suspended, gate every stage form behind a single
                read-only screen instead of rendering the Outlet's form. */}
            {draft?.suspended ? <SuspendedScreen /> : isLockedEditableRoute ? null : <Outlet />}
          </Wizard>
        )}
        </ApplicantAvailabilityGate>
      </div>

      <FloatingHelp />
    </div>
  );
}

/* Post-exam-date navigation — 4-tab section nav that replaces the
 * wizard stepper once firstExamDate is set. Each tab is route-driven so
 * deep links + the browser's back button stay intact.
 *
 * When `vothiqaEnabled` is true, a 5th tab «وثيقة تعارف» is appended,
 * pointing at /applicant/acquaintance-doc. The post-submission gate is
 * what surfaces the locked view-and-print experience to the expired
 * demo user; the fillable demo user reaches the same route via the
 * wizard stepper instead. */
function PostExamNav({ vothiqaEnabled }: { vothiqaEnabled: boolean }): JSX.Element {
  const location = useLocation();
  const tabs = [
    { label: 'البيانات الأساسية', path: ROUTES.applicant },
    { label: 'كارت التردد', path: ROUTES.applicantPrintCard },
    { label: 'نتائج الاختبارات', path: ROUTES.applicantFollowUp },
    ...(vothiqaEnabled
      ? [{ label: 'وثيقة تعارف', path: `${ROUTES.applicant}/acquaintance-doc` }]
      : []),
  ] as const;
  return (
    <nav
      aria-label="أقسام بوابة المتقدم"
      className="flex flex-wrap gap-1 rounded-lg border border-border-default bg-surface-card p-1"
    >
      {tabs.map((t) => {
        const active = location.pathname === t.path
          || (t.path === ROUTES.applicant && location.pathname === `${ROUTES.applicant}/`);
        return (
          <Link
            key={t.path}
            to={t.path}
            className={
              'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors '
              + (active
                ? 'bg-teal-50 text-teal-700'
                : 'text-ink-700 hover:bg-ink-50')
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SuspendedScreen(): JSX.Element {
  return (
    <div className="rounded-lg border border-terra-500 bg-terra-50 p-6">
      <div className="flex items-start gap-4">
        <span aria-hidden className="inline-flex h-12 w-12 items-center justify-center rounded-md bg-terra-500 text-white">
          <Ban size={22} strokeWidth={1.75} />
        </span>
        <div>
          <p className="font-ar-display text-md font-bold text-terra-700">طلبك موقوف مؤقتاً</p>
          <p className="mt-1 text-sm text-terra-700/85 leading-normal">
            لا يمكن إجراء أيّ تعديل أو إرسال على ملف التقديم في الوقت الحالي. سيتم إخطارك فور
            تحديث الحالة. للاستفسار، تواصل عبر الخط الساخن
            <span className="mx-1 inline-block font-mono font-bold" dir="ltr">19000</span>.
          </p>
        </div>
      </div>
    </div>
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
      {/* <BellRing size={14} strokeWidth={1.75} className="text-teal-700" aria-hidden />
      <span className="text-2xs text-ink-700">دعم فني</span>
      <a
        href="tel:19000"
        className="rounded-md bg-teal-500 px-2 py-1 text-2xs font-medium text-white hover:bg-teal-600"
      >
        19000
      </a>
      <HelpCircle size={14} strokeWidth={1.75} className="text-ink-500" aria-hidden /> */}
    </aside>
  );
}
