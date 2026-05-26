/**
 * ApplicantPreWizardLayout — shell for the public-ish applicant pages
 * mounted outside the 11-stage wizard:
 *   - /applicant/start         CategorySelectionPage
 *   - /applicant/eligibility   EligibilityCheckPage
 *   - /applicant/tests         TestScheduleAndResultsPage
 *
 * Mirrors the slim header from `ApplicantPortalLayout` (logo + branding +
 * Khayameya stripe + tessellation watermark) but with explicit nav back to:
 *   - بوابة المتقدم (`/applicant`)
 *   - الرئيسية (`/hub`) — for staff users hitting these URLs directly
 *
 * Source: ARCH-04 4-layer split — this is the "applicant pre-wizard"
 * variant, no Wizard chrome.
 */

import { Link, Outlet } from 'react-router-dom';
import { HelpCircle, Home, Phone } from 'lucide-react';
import { KhayameyaStripe, LogoMark, Pattern } from '@/shared/components';
import { ROUTES } from '@/config/routes';

export function ApplicantPreWizardLayout(): JSX.Element {
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

        <nav aria-label="التنقل العام" className="flex items-center gap-2">
          <a
            href="tel:19000"
            className="hidden items-center gap-1.5 rounded-pill bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 transition-colors duration-fast ease-standard hover:bg-teal-100 focus-visible:shadow-focus-teal focus-visible:outline-none sm:inline-flex"
            title="الخط الساخن"
          >
            <Phone size={13} strokeWidth={1.75} aria-hidden />
            <span dir="ltr" className="font-mono">19000</span>
          </a>
          <Link
            to={ROUTES.help}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-700 transition-colors duration-fast ease-standard hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
            title="الأسئلة الشائعة"
            aria-label="الأسئلة الشائعة"
          >
            <HelpCircle size={18} strokeWidth={1.75} />
          </Link>
          <Link
            to={ROUTES.hub}
            className="inline-flex items-center gap-1.5 rounded-md bg-teal-500 px-3 py-2 text-sm font-medium text-white shadow-xs transition-colors duration-fast ease-standard hover:bg-teal-600 focus-visible:shadow-focus-teal focus-visible:outline-none"
          >
            <Home size={15} strokeWidth={1.75} aria-hidden />
            <span className="hidden sm:inline">الرئيسية</span>
          </Link>
        </nav>
      </header>

      <Pattern variant="tessellation-8" tile={96} opacity={0.04} />

      <main className="relative mx-auto w-full max-w-[1200px] flex-1 px-6 pb-12 pt-6">
        <Outlet />
      </main>
    </div>
  );
}
