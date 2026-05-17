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
import { useMemo } from 'react';
import { Ban, BellRing, ClipboardCheck, HelpCircle, LogOut, Pencil, ScrollText } from 'lucide-react';
import {
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
import { useDraft } from './api/applicantPortal.queries';
import { useApplicantPortalStore } from './store/applicantPortal.store';

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
  'exam-schedule',
  'print-card',
  'follow-up',
  'acquaintance-doc',
] as const;

export const STAGE_LABELS = [
  'البيانات الشخصية والدراسية',
  'ملخّص الطلب',
  'سداد رسوم التقديم',
  'بيانات الوالدين',
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

export function ApplicantPortalLayout(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: draft } = useDraft(APPLICANT_ID);
  const clear = useAuthStore((s) => s.clear);
  const selectedCategoryKey = useApplicantPortalStore((s) => s.selectedCategoryKey);
  const selectedCategory = selectedCategoryKey
    ? MOCK.categories.find((c) => c.key === selectedCategoryKey) ?? null
    : null;
  /* "Irreversible step" = Stage 6 payment committed. After that the user
   * cannot switch category without an admin action; the badge becomes read-only. */
  const categoryLocked = Boolean(draft?.payment?.paidAt);

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

  const handleExit = (): void => {
    if (!window.confirm('هل تريد الخروج من ملف التقديم؟ سيتم حفظ تقدّمك تلقائياً.')) return;
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
          {draft?.applicantId && (
            <span
              className="hidden rounded-md border border-border-subtle bg-ink-50 px-2.5 py-1.5 font-mono text-2xs text-ink-700 md:inline-flex"
              dir="ltr"
            >
              {draft.applicantId}
            </span>
          )}
          {/* Edit-application surface — applicant can review the entire
              draft and re-open any unlocked stage. */}
          <Link
            to={ROUTES.applicantApplicationSummary}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-surface-card px-3 py-1.5 text-xs font-medium text-ink-800 transition-colors hover:border-teal-500 hover:bg-teal-50 hover:text-teal-700 focus-visible:shadow-focus-teal focus-visible:outline-none"
          >
            <ScrollText size={15} strokeWidth={1.75} />
            <span className="hidden sm:inline">تعديل الطلب</span>
          </Link>
          {/* Persistent results-tracker — reachable from any wizard stage so
              applicants can check progress without backing out of the wizard. */}
          <Link
            to={ROUTES.applicantTests}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-surface-card px-3 py-1.5 text-xs font-medium text-ink-800 transition-colors hover:border-teal-500 hover:bg-teal-50 hover:text-teal-700 focus-visible:shadow-focus-teal focus-visible:outline-none"
          >
            <ClipboardCheck size={15} strokeWidth={1.75} />
            <span className="hidden sm:inline">نتائج الإختبارات</span>
          </Link>
          <button
            type="button"
            onClick={handleExit}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-surface-card px-3 py-1.5 text-xs font-medium text-ink-800 transition-colors hover:border-terra-500 hover:bg-terra-50 hover:text-terra-700 focus-visible:shadow-focus-teal focus-visible:outline-none"
          >
            <LogOut size={15} strokeWidth={1.75} /> خروج
          </button>
        </div>
      </header>

      <Pattern variant="tessellation-8" tile={96} opacity={0.04} />

      <div className="relative mx-auto w-full max-w-[1200px] flex-1 px-6 pb-12 pt-6">
        {draft?.suspended && <SuspendedBanner />}
        <Wizard
          title="رحلة المتقدم · دفعة 2026"
          steps={steps}
          activeStepKey={STAGE_KEYS[activeIndex] ?? STAGE_KEYS[0]}
          onStepClick={(key) => {
            if (draft?.suspended && key !== STAGE_KEYS[0]) {
              toast('طلبك موقوف مؤقتاً — لا يمكن التنقّل.', 'warning');
              return;
            }
            navigate(`${ROUTES.applicant}/${key}`);
          }}
          autoSaveStatus={autoSaveStatus}
        >
          {/* AUD-007 — when suspended, gate every stage form behind a single
              read-only screen instead of rendering the Outlet's form. */}
          {draft?.suspended ? <SuspendedScreen /> : <Outlet />}
        </Wizard>
      </div>

      <FloatingHelp />
    </div>
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
