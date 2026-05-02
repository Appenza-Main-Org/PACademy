/**
 * PublicShell — chrome for unauthenticated routes.
 * Source: Tasks/DESIGN_SYSTEM.md Sprint 0 Part C + ARCH-04 (4-layer split).
 *
 * Used by: PublicLandingPage (`/`), StaffLoginPage (`/staff-login`),
 * TermsPage (`/terms`), HelpPage when reached anonymously.
 *
 * Renders:
 *  - Top Khayameya stripe (anchors the public surface to the same heritage)
 *  - Slim public header with academy crest + small "تواصل" / "الأسئلة الشائعة"
 *  - Full-bleed tessellation watermark at 4% opacity
 *  - Footer with ministry attribution + accessibility links
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, Phone } from 'lucide-react';
import { KhayameyaStripe, Pattern } from '@/shared/components';
import { IconSeal } from '@/shared/components/icons';
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
        <header className="sticky top-0 flex h-14 items-center justify-between gap-4 border-b border-border-subtle bg-surface-card px-6"
          style={{ zIndex: 'var(--z-sticky)' as unknown as number }}>
          <Link to={ROUTES.landing} className="flex items-center gap-3 rounded-md px-1 py-1 hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none">
            <span aria-hidden className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white" style={{ background: 'var(--teal-500)' }}>
              <IconSeal width={18} height={18} color="white" />
            </span>
            <span className="hidden flex-col leading-tight md:flex">
              <span className="font-ar-display text-sm font-bold text-ink-900">منظومة القبول</span>
              <span className="text-2xs text-ink-500">أكاديمية الشرطة</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link to={ROUTES.help} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-700 hover:bg-ink-50">
              <HelpCircle size={14} strokeWidth={1.75} /> الأسئلة الشائعة
            </Link>
            <a href="tel:19000" className="inline-flex items-center gap-1 rounded-pill bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
              <Phone size={12} strokeWidth={1.75} /> الخط الساخن 19000
            </a>
          </nav>
        </header>
      )}

      <Pattern variant="tessellation-8" tile={96} opacity={0.04} />

      <main className="relative flex-1">{children}</main>

      <footer className="relative border-t border-border-subtle bg-surface-card py-4">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-4 px-6 text-2xs text-ink-500">
          <p>© 2026 وزارة الداخلية · أكاديمية الشرطة · إدارة تكنولوجيا المعلومات</p>
          <ul className="flex items-center gap-4">
            <li><Link to={ROUTES.terms} className="hover:text-teal-700">شروط الاستخدام</Link></li>
            <li><Link to={ROUTES.help} className="hover:text-teal-700">المساعدة</Link></li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
