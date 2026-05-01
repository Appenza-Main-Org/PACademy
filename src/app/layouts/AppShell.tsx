/**
 * AppShell — Khayameya stripe + header + (optional) sidebar + main.
 * Source: Tasks/DESIGN_SYSTEM.md §3.2 (stripe), §4.14 (shell layout).
 *
 * Per-app theming via `data-app="<key>"` on the shell wrapper which flips
 * --accent-* CSS variables (see src/styles/apps.css).
 */

import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Layers, LogOut } from 'lucide-react';
import { Avatar, Button, KhayameyaStripe, toast } from '@/shared/components';
import { IconSeal } from '@/shared/components/icons';
import { useAuthStore } from '@/features/auth';
import { useLogoutMutation } from '@/features/auth/api/auth.queries';
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

  const handleLogout = (): void => {
    if (!window.confirm('هل تريد تسجيل الخروج من المنظومة؟')) return;
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        toast('تم تسجيل الخروج بنجاح', 'success');
        navigate('/login', { replace: true });
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
            to="/"
            className="flex items-center gap-3 rounded-md px-1 py-1 transition-colors duration-fast ease-standard hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
          >
            <span
              aria-hidden
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-white shadow-xs"
              style={{ background: 'var(--teal-500)' }}
            >
              <IconSeal width={20} height={20} color="white" />
            </span>
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
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" title="الإشعارات" aria-label="الإشعارات">
            <Bell size={18} strokeWidth={1.75} />
          </Button>
          <Link
            to="/architecture"
            className="hidden items-center gap-2 rounded-md px-3 py-1.5 text-sm text-ink-700 transition-colors duration-fast ease-standard hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none md:inline-flex"
            title="معمارية النظام"
          >
            <Layers size={16} strokeWidth={1.75} />
            <span>المعمارية</span>
          </Link>
          <div className="flex items-center gap-3 rounded-pill bg-ink-50 ps-1 pe-3 py-1">
            <Avatar name={user.name} size="sm" />
            <div className="hidden flex-col leading-tight md:flex">
              <span className="text-xs font-medium text-ink-900">{shortName(user.name, 3)}</span>
              <span className="text-2xs text-ink-500">{user.roleLabel}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="تسجيل الخروج"
            aria-label="تسجيل الخروج"
          >
            <LogOut size={18} strokeWidth={1.75} />
          </Button>
        </div>
      </header>

      <div className={hasSidebar ? 'grid flex-1 md:grid-cols-[256px_1fr]' : 'flex flex-1 flex-col'}>
        {hasSidebar && <Sidebar sections={sidebar!} />}
        <main className="min-w-0 flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
