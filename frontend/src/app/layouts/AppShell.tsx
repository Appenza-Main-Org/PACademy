/**
 * AppShell — Khayameya stripe + header + (optional) sidebar + main.
 * Source: Tasks/DESIGN_SYSTEM.md §3.2 (stripe), §4.14 (shell layout).
 *
 * Per-app theming via `data-app="<key>"` on the shell wrapper which flips
 * --accent-* CSS variables (see src/styles/apps.css).
 *
 * Responsive behavior:
 *  • Desktop (md+): sidebar is fixed in-flow as a grid column with internal
 *    scroll. Header at h-16 with full padding.
 *  • Mobile (<md): sidebar hides; a hamburger in the header opens it as a
 *    fixed end-edge drawer with a backdrop. Drawer auto-closes on route
 *    change and on Esc.
 *  • Outer wrapper uses 100dvh (dynamic viewport height) so iOS Safari's
 *    chrome doesn't push content offscreen.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, Search, UserCircle } from 'lucide-react';
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
import { getDefaultRouteForUser, useAuthStore, useLogoutMutation } from '@/features/auth';
import { useAdminNotifications } from '@/features/admin/api/notifications.queries';
import type { AdminNotification, NotificationItem } from '@/shared/types/domain';
import type { AppKey } from '@/shared/lib/constants';
import { Sidebar } from './Sidebar';
import type { SidebarSection } from './Sidebar';

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'pa-sidebar-collapsed';

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
  const location = useLocation();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readSidebarCollapsed());
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const shouldUseAdminNotifications = Boolean(user && (app === 'admin' || user.role === 'super_admin'));
  const adminNotificationsQuery = useAdminNotifications({ status: 'published' }, shouldUseAdminNotifications);
  useCommandPaletteShortcut(setPaletteOpen);

  /* Auto-close the mobile drawer on every navigation — same UX users expect
   * from any drawer-based navigation pattern. */
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  /* Esc closes the mobile drawer. */
  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setMobileSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileSidebarOpen]);

  const handleSidebarCollapsedChange = (next: boolean): void => {
    setSidebarCollapsed(next);
    writeSidebarCollapsed(next);
  };

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
  const toolbarName = firstName(user.name);
  const adminNotificationItems = shouldUseAdminNotifications
    ? adminNotificationsQuery.data?.map(mapAdminNotificationToToolbarItem) ?? []
    : undefined;

  return (
    <div
      data-app={app ?? undefined}
      className="page-enter relative flex h-[100dvh] flex-col overflow-hidden bg-surface-page"
    >
      <KhayameyaStripe height="sm" />

      <header
        className="flex h-16 flex-shrink-0 items-center justify-between gap-1 border-b border-border-subtle bg-surface-card px-2 sm:gap-3 sm:px-4 md:px-6"
        style={{ zIndex: 'var(--z-sticky)' as unknown as number }}
      >
        <div className="flex min-w-0 items-center gap-1 sm:gap-3">
          {hasSidebar && (
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-transparent text-ink-700 transition-colors duration-fast ease-standard hover:border-border-subtle hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none md:hidden"
              aria-label="فتح القائمة الجانبية"
              aria-expanded={mobileSidebarOpen}
              title="فتح القائمة"
            >
              <Menu size={20} strokeWidth={1.75} aria-hidden />
            </button>
          )}
          <Link
            to={getDefaultRouteForUser(user)}
            className="flex items-center gap-2 rounded-md px-1 py-1 transition-colors duration-fast ease-standard hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none sm:gap-3"
            title="العودة إلى البوابة"
          >
            <LogoMark size={36} ariaLabel="شعار أكاديمية الشرطة" className="rounded-full shadow-xs" />
            <span className="hidden flex-col leading-tight md:flex">
              <span className="font-ar-display text-sm font-bold text-ink-900">منظومة القبول</span>
              <span className="text-2xs text-ink-500">أكاديمية الشرطة</span>
            </span>
          </Link>
        </div>

        <div role="toolbar" aria-label="أدوات المنظومة" className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-transparent px-2 text-sm font-medium text-ink-700 transition-colors duration-fast ease-standard hover:border-border-subtle hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none lg:px-3"
            title="بحث الأوامر"
            aria-label="بحث الأوامر"
          >
            <Search size={16} strokeWidth={1.75} />
            <span className="hidden lg:inline">بحث الأوامر</span>
          </button>
          <NotificationCenter
            items={adminNotificationItems}
            isLoading={shouldUseAdminNotifications && adminNotificationsQuery.isLoading}
            isError={shouldUseAdminNotifications && adminNotificationsQuery.isError}
          />
          <span aria-hidden className="mx-1 hidden h-6 w-px bg-border-subtle md:inline-block" />
          <Link
            to="/profile"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-transparent ps-1 pe-2 text-ink-900 transition-colors duration-fast ease-standard hover:border-border-subtle hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
            title="الملف الشخصي"
            aria-label={`الملف الشخصي · ${user.name}`}
          >
            <Avatar name={user.name} size="sm" />
            <span className="hidden flex-col items-start leading-tight md:flex">
              <span className="text-xs font-medium text-ink-900">{toolbarName}</span>
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
            <span className="hidden lg:inline">تسجيل الخروج</span>
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

      <div
        className={
          hasSidebar
            ? sidebarCollapsed
              ? 'flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[64px_1fr]'
              : 'flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[256px_1fr]'
            : 'flex min-h-0 flex-1 flex-col'
        }
      >
        {hasSidebar && (
          <Sidebar
            sections={sidebar!}
            collapsed={sidebarCollapsed}
            onCollapsedChange={handleSidebarCollapsedChange}
            mobileOpen={mobileSidebarOpen}
            onMobileClose={() => setMobileSidebarOpen(false)}
          />
        )}
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-5 sm:py-5 md:px-6 md:py-6">{children}</main>
      </div>
    </div>
  );
}

function firstName(name: string): string {
  const [firstMeaningfulToken] = name
    .replace(/[\\/]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !TITLE_TOKENS.has(token));

  return firstMeaningfulToken ?? name;
}

const TITLE_TOKENS = new Set([
  'د.',
  'د',
  'اللواء',
  'العميد',
  'العقيد',
  'المقدم',
  'مقدم',
  'الرائد',
  'النقيب',
  'الملازم',
  'أول',
]);

function mapAdminNotificationToToolbarItem(notification: AdminNotification): NotificationItem {
  return {
    id: notification.id,
    ts: new Date(notification.publishAt || notification.createdAt).getTime(),
    recipientRole: 'admin',
    type: notification.type,
    title: notification.titleAr,
    body: notification.bodyAr,
    read: false,
    href: '/admin/notifications',
  };
}

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeSidebarCollapsed(value: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(value));
  } catch {
    /* localStorage unavailable — in-memory state still works. */
  }
}
