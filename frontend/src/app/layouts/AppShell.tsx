/**
 * AppShell — Khayameya stripe + header + (optional) sidebar + main.
 * Source: Tasks/DESIGN_SYSTEM.md §3.2 (stripe), §4.14 (shell layout).
 *
 * Per-app theming via `data-app="<key>"` on the shell wrapper which flips
 * --accent-* CSS variables (see src/styles/apps.css).
 */

import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, UserCircle } from 'lucide-react';
import {
  AlertDialog,
  Avatar,
  CommandPalette,
  KhayameyaStripe,
  LogoMark,
  NotificationCenter,
  toast,
  useCommandPaletteShortcut,
} from '@/shared/components';
import { useAuthStore, useLogoutMutation } from '@/features/auth';
import { shortName } from '@/shared/lib/format';
import type { AppKey } from '@/shared/lib/constants';
import { Sidebar } from './Sidebar';
import type { SidebarSection } from './Sidebar';

interface AppShellProps {
  app?: AppKey;
  /** @deprecated No longer rendered. Kept for caller compatibility. */
  appLabel?: string;
  sidebar?: readonly SidebarSection[];
  children: ReactNode;
}

export function AppShell({ app, sidebar, children }: AppShellProps): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const logoutMutation = useLogoutMutation();
  const navigate = useNavigate();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  useCommandPaletteShortcut(setPaletteOpen);

  const handleLogout = (): void => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setLogoutDialogOpen(false);
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
        className="sticky top-0 flex h-16 items-center justify-between gap-3 border-b border-border-subtle bg-surface-card px-4 md:px-6"
        style={{ zIndex: 'var(--z-sticky)' as unknown as number }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/hub"
            className="flex items-center gap-3 rounded-md px-1 py-1 transition-colors duration-fast ease-standard hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
            title="العودة إلى البوابة"
          >
            <LogoMark size={36} ariaLabel="شعار أكاديمية الشرطة" className="rounded-full shadow-xs" />
            <span className="hidden flex-col leading-tight md:flex">
              <span className="font-ar-display text-sm font-bold text-ink-900">منظومة القبول</span>
              <span className="text-2xs text-ink-500">أكاديمية الشرطة</span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1">
          <NotificationCenter />
          <span aria-hidden className="mx-1 hidden h-6 w-px bg-border-subtle md:inline-block" />
          <Link
            to="/profile"
            className="inline-flex h-9 items-center gap-2 rounded-md ps-1 pe-2 text-ink-900 transition-colors duration-fast ease-standard hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
            title="الملف الشخصي"
            aria-label={`الملف الشخصي · ${user.name}`}
          >
            <Avatar name={user.name} size="sm" />
            <span className="hidden flex-col items-start leading-tight md:flex">
              <span className="text-xs font-medium text-ink-900">{shortName(user.name, 3)}</span>
              <span className="text-2xs text-ink-500">{user.roleLabel}</span>
            </span>
            <UserCircle size={14} strokeWidth={1.75} className="text-ink-500 md:hidden" />
          </Link>
          <button
            type="button"
            onClick={() => setLogoutDialogOpen(true)}
            disabled={logoutMutation.isPending}
            title="تسجيل الخروج"
            aria-label="تسجيل الخروج"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-transparent px-3 text-sm font-medium text-terra-700 transition-colors duration-fast ease-standard hover:border-terra-300 hover:bg-terra-50 focus-visible:shadow-focus-terra focus-visible:outline-none active:bg-terra-500 active:text-white disabled:opacity-60"
          >
            <LogOut size={16} strokeWidth={1.75} />
            <span className="hidden md:inline">تسجيل الخروج</span>
          </button>
        </div>
      </header>

      <AlertDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        title="تسجيل الخروج من المنظومة"
        description="سيتم إنهاء الجلسة الحالية والعودة إلى شاشة دخول الموظفين."
        actionLabel="تسجيل الخروج"
        cancelLabel="البقاء"
        onAction={handleLogout}
        tone="danger"
        isActionLoading={logoutMutation.isPending}
      />

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      <div className={hasSidebar ? 'grid flex-1 md:grid-cols-[256px_1fr]' : 'flex flex-1 flex-col'}>
        {hasSidebar && <Sidebar sections={sidebar!} />}
        <main className="min-w-0 flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
