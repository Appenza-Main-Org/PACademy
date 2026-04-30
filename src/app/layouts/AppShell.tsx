/**
 * AppShell — header + (optional) sidebar + main content area.
 * Per-app theming via `data-app` attribute on the shell wrapper.
 */

import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Layers, LogOut, Shield } from 'lucide-react';
import { Avatar, Button, toast } from '@/shared/components';
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

  return (
    <div className={`shell ${sidebar ? 'shell-with-sidebar' : ''} page-enter`} data-app={app ?? undefined}>
      <header className="header">
        <div className="header-left">
          <Link to="/" className="brand">
            <div className="brand-logo">
              <Shield size={18} strokeWidth={2.2} />
            </div>
            <div className="brand-text">
              <span>منظومة القبول</span>
              <span>أكاديمية الشرطة</span>
            </div>
          </Link>
          {appLabel && <span className="app-pill">{appLabel}</span>}
        </div>
        <div className="header-right">
          <Button variant="ghost" size="icon" title="الإشعارات" aria-label="الإشعارات">
            <Bell size={18} />
          </Button>
          <Link to="/architecture" className="btn btn-ghost" title="معمارية النظام">
            <Layers size={18} />
            <span>المعمارية</span>
          </Link>
          <div className="user-menu">
            <Avatar name={user.name} />
            <div className="user-menu-info">
              <span className="user-menu-name">{shortName(user.name, 3)}</span>
              <span className="user-menu-role">{user.roleLabel}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="تسجيل الخروج" aria-label="تسجيل الخروج">
            <LogOut size={18} />
          </Button>
        </div>
      </header>

      {sidebar && <Sidebar sections={sidebar} />}

      <main className="main">{children}</main>
    </div>
  );
}
