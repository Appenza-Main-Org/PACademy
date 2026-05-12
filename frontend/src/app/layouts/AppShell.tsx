/**
 * AppShell — Khayameya stripe + header + (optional) sidebar + main.
 * Source: Tasks/DESIGN_SYSTEM.md §3.2 (stripe), §4.14 (shell layout).
 *
 * Per-app theming via `data-app="<key>"` on the shell wrapper which flips
 * --accent-* CSS variables (see src/styles/apps.css).
 */

import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CircleHelp, LogOut, Search, UserCircle } from 'lucide-react';
import {
  Avatar,
  CommandPalette,
  KhayameyaStripe,
  LogoMark,
  NotificationCenter,
  toast,
  useCommandPaletteShortcut,
} from '@/shared/components';
import { useAuthStore, useLogoutMutation } from '@/features/auth';
import { ActiveCycleIndicator } from '@/features/admin';
import { shortName } from '@/shared/lib/format';
import type { AppKey } from '@/shared/lib/constants';
import { Sidebar } from './Sidebar';
import type { SidebarSection } from './Sidebar';

interface AppShellProps {
  app?: AppKey;
  appLabel?: string;
  sidebar?: readonly SidebarSection[];
  children: ReactNode;
}

export function AppShell({ app, appLabel, sidebar, children }: AppShellProps): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const logoutMutation = useLogoutMutation();
  const navigate = useNavigate();

  const [paletteOpen, setPaletteOpen] = useState(false);
  useCommandPaletteShortcut(setPaletteOpen);

  const handleLogout = (): void => {
    if (!window.confirm('هل تريد تسجيل الخروج من المنظومة؟')) return;
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        toast('تم تسجيل الخروج بنجاح', 'success');
        navigate('/staff-login', { replace: true });
      },
    });
  };

  if (!user) return <>{children}</>;

  const hasSidebar = Boolean(sidebar);

  return (
    <div
      data-app={app ?? undefined}
      className="page-enter relative flex min-h-screen flex-col bg-surface-page"
    >
      <KhayameyaStripe height="sm" />

      <header
        className="sticky top-0 flex h-16 items-center justify-between gap-4 border-b border-border-subtle bg-surface-card px-6"
        style={{ zIndex: 'var(--z-sticky)' as unknown as number }}
      >
        <div className="flex items-center gap-4">
          <Link
            to="/hub"
            className="flex items-center gap-3 rounded-md px-1 py-1 transition-colors duration-fast ease-standard hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
          >
            <LogoMark size={36} ariaLabel="شعار أكاديمية الشرطة" className="rounded-full shadow-xs" />
            <span className="hidden flex-col leading-tight md:flex">
              <span className="font-ar-display text-sm font-bold text-ink-900">منظومة القبول</span>
              <span className="text-2xs text-ink-500">أكاديمية الشرطة</span>
            </span>
          </Link>
          {appLabel && (
            <span
              className="inline-flex items-center gap-1 rounded-pill px-3 py-1 text-xs font-medium"
              style={{ background: 'var(--accent-50)', color: 'var(--accent-600)' }}
            >
              {appLabel}
            </span>
          )}
          <ActiveCycleIndicator />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="بحث (⌘K)"
            className="hidden items-center gap-2 rounded-pill border border-border-default bg-surface-card px-3 py-1.5 text-2xs text-ink-500 transition-colors duration-fast ease-standard hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none md:inline-flex"
          >
            <Search size={14} strokeWidth={1.75} />
            <span>بحث…</span>
            <kbd className="font-mono" dir="ltr">⌘K</kbd>
          </button>
          <NotificationCenter />
          <Link
            to="/help"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-700 transition-colors duration-fast ease-standard hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
            title="الدعم"
            aria-label="الدعم"
          >
            <CircleHelp size={18} strokeWidth={1.75} />
          </Link>
          <Link
            to="/profile"
            className="flex items-center gap-3 rounded-pill bg-ink-50 ps-1 pe-3 py-1 hover:bg-ink-100 focus-visible:shadow-focus-teal focus-visible:outline-none"
            title="الملف الشخصي"
          >
            <Avatar name={user.name} size="sm" />
            <div className="hidden flex-col leading-tight md:flex">
              <span className="text-xs font-medium text-ink-900">{shortName(user.name, 3)}</span>
              <span className="text-2xs text-ink-500">{user.roleLabel}</span>
            </div>
            <UserCircle size={14} strokeWidth={1.75} className="text-ink-500 md:hidden" />
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            title="تسجيل الخروج"
            aria-label="تسجيل الخروج"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-terra-500 bg-terra-50 px-4 text-sm font-semibold text-terra-700 transition-colors duration-fast ease-standard hover:bg-terra-500 hover:text-white focus-visible:shadow-focus-terra focus-visible:outline-none"
          >
            <LogOut size={16} strokeWidth={2} />
            <span className="hidden md:inline">تسجيل الخروج</span>
          </button>
        </div>
      </header>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      <div className={hasSidebar ? 'grid flex-1 md:grid-cols-[256px_1fr]' : 'flex flex-1 flex-col'}>
        {hasSidebar && <Sidebar sections={sidebar!} />}
        <main className="min-w-0 flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
