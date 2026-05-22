/**
 * PublicShell — chrome for unauthenticated routes.
 * Source: Tasks/DESIGN_SYSTEM.md Sprint 0 Part C + ARCH-04 (4-layer split).
 *
 * Used by: PublicLandingPage (`/`), StaffLoginPage (`/staff-login`),
 * and ApplicantLoginPage (`/applicant-login`).
 *
 * Renders:
 *  - Top Khayameya stripe (anchors the public surface to the same heritage)
 *  - Slim public header with academy crest + the two public login entries
 *  - Full-bleed tessellation watermark at 4% opacity
 *  - Footer with ministry attribution + accessibility links
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { KhayameyaStripe, LogoMark, Pattern } from '@/shared/components';
import { ROUTES } from '@/config/routes';

interface PublicShellProps {
  children: ReactNode;
  /** Hide the header entirely (for the landing page hero where header is integrated). */
  bareHeader?: boolean;
}

export function PublicShell({ children, bareHeader }: PublicShellProps): JSX.Element {
  return (
    <div className="page-enter relative flex min-h-screen flex-col bg-surface-page">
      <KhayameyaStripe height="sm" />

      {!bareHeader && (
        <header className="sticky top-0 flex h-16 items-center justify-between gap-4 border-b border-border-subtle bg-surface-card px-6"
          style={{ zIndex: 'var(--z-sticky)' as unknown as number }}>
          <Link to={ROUTES.landing} className="flex items-center gap-3 rounded-md px-1 py-1 -mx-1 transition-colors duration-fast ease-standard hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none">
            <LogoMark size={36} ariaLabel="شعار أكاديمية الشرطة" className="rounded-full shadow-xs" />
            <span className="hidden flex-col leading-tight md:flex">
              <span className="font-ar-display text-sm font-bold text-ink-900">منظومة القبول</span>
              <span className="text-2xs text-ink-500">أكاديمية الشرطة</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link to={ROUTES.applicantLogin} className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-ink-700 transition-colors duration-fast ease-standard hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none">
              دخول المتقدمين
            </Link>
            <span aria-hidden className="mx-1 hidden h-6 w-px bg-border-subtle sm:inline-block" />
            <Link to={ROUTES.staffLogin} className="inline-flex items-center gap-1.5 rounded-pill bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 transition-colors duration-fast ease-standard hover:bg-teal-100 focus-visible:shadow-focus-teal focus-visible:outline-none">
              دخول الإدارة
            </Link>
          </nav>
        </header>
      )}

      <Pattern variant="tessellation-8" tile={96} opacity={0.04} />

      <main className="relative flex-1">{children}</main>

      <footer className="relative border-t border-border-subtle bg-surface-card py-4">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-4 px-6 text-2xs text-ink-500">
          <p>© 2026 وزارة الداخلية · أكاديمية الشرطة · إدارة تكنولوجيا المعلومات</p>
          <ul className="flex items-center gap-4">
            <li><Link to={ROUTES.applicantLogin} className="hover:text-teal-700">دخول المتقدمين</Link></li>
            <li><Link to={ROUTES.staffLogin} className="hover:text-teal-700">دخول الإدارة</Link></li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
