/**
 * ApplicantPreWizardLayout — shell for the public-ish applicant pages
 * mounted outside the 11-stage wizard:
 *   - /applicant/start         CategorySelectionPage
 *   - /applicant/eligibility   EligibilityCheckPage
 *   - /applicant/tests         TestScheduleAndResultsPage
 *
 * Mirrors the slim header from `ApplicantPortalLayout` (logo + branding +
 * Khayameya stripe + tessellation watermark) with a single logout action.
 *
 * Source: ARCH-04 4-layer split — this is the "applicant pre-wizard"
 * variant, no Wizard chrome.
 */

import { Link, Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { KhayameyaStripe, LogoMark, Pattern, toast } from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { useLogoutMutation } from '@/features/auth';
import { ApplicantAvailabilityGate } from './components/ApplicantAvailabilityGate';

export function ApplicantPreWizardLayout(): JSX.Element {
  const navigate = useNavigate();
  const logoutMutation = useLogoutMutation();

  const handleLogout = (): void => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        toast('تم تسجيل الخروج بنجاح', 'success');
        navigate(ROUTES.landing, { replace: true });
      },
    });
  };

  return (
    <div
      data-app="applicant"
      className="page-enter relative flex min-h-screen flex-col bg-surface-page"
    >
      <KhayameyaStripe height="sm" />

      <header
        className="sticky top-0 flex h-16 items-center justify-between gap-4 border-b border-border-subtle bg-surface-card px-6"
        style={{ zIndex: 'var(--z-sticky)' as unknown as number }}
      >
        <Link
          to={ROUTES.landing}
          className="flex items-center gap-3 rounded-md px-1 py-1 -mx-1 transition-colors duration-fast ease-standard hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
        >
          <LogoMark size={36} ariaLabel="شعار أكاديمية الشرطة" className="rounded-full shadow-xs" />
          <span className="hidden flex-col leading-tight md:flex">
            <span className="font-ar-display text-sm font-bold text-ink-900">
              منظومة القبول
            </span>
            <span className="text-2xs text-ink-500">أكاديمية الشرطة</span>
          </span>
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-surface-card px-3 py-1.5 text-xs font-medium text-ink-800 transition-colors duration-fast ease-standard hover:border-terra-500 hover:bg-terra-50 hover:text-terra-700 focus-visible:shadow-focus-teal focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          title="تسجيل الخروج"
          aria-label="تسجيل الخروج"
        >
          <LogOut size={15} strokeWidth={1.75} aria-hidden />
          <span>تسجيل الخروج</span>
        </button>
      </header>

      <Pattern variant="tessellation-8" tile={96} opacity={0.04} />

      <main className="relative mx-auto w-full max-w-[1200px] flex-1 px-6 pb-12 pt-6">
        <ApplicantAvailabilityGate>
          <Outlet />
        </ApplicantAvailabilityGate>
      </main>
    </div>
  );
}
