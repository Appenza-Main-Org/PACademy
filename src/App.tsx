import { useEffect, useRef } from 'react';
import { BrowserRouter, useLocation, useNavigate, useRoutes } from 'react-router-dom';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { ToastViewport } from '@/shared/components';
import { routes } from '@/routes';
import { useAuthStore } from '@/features/auth';
import { ROLE_DEFINITIONS } from '@/features/auth/rbac';
import { ROUTES } from '@/config/routes';

/**
 * Demo bootstrap — auto-seeds a super_admin user on startup so every URL
 * is reachable without going through /staff-login. Remove this block once
 * the real auth flow is integrated.
 */
function ensureDemoUser(): void {
  const store = useAuthStore.getState();
  if (store.user) return;
  const def = ROLE_DEFINITIONS.super_admin;
  store.setUser({
    id: 'U-DEMO',
    name: 'العميد د. أحمد محمود الفقي',
    role: 'super_admin',
    roleLabel: def.labelAr,
    unit: 'إدارة المنظومة',
    apps: def.apps,
    permissions: def.permissions,
    token: 'demo.bypass.token',
    loggedInAt: Date.now(),
  });
}

ensureDemoUser();

/**
 * One-shot redirect for the demo super_admin: when an auto-seeded super_admin
 * lands on the public root (/), send them to the admissions command center.
 * The ref guard ensures this only fires on the initial mount — users who
 * later navigate to / (e.g. via the public landing's logo) stay put.
 */
function DemoBootstrapRedirect(): null {
  const navigate = useNavigate();
  const location = useLocation();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const user = useAuthStore.getState().user;
    if (user?.role === 'super_admin' && location.pathname === '/') {
      navigate(ROUTES.admin.reports, { replace: true });
    }
  }, [navigate, location.pathname]);

  return null;
}

function AppRoutes(): JSX.Element {
  const element = useRoutes(routes);
  return <>{element}</>;
}

export function App(): JSX.Element {
  return (
    <QueryProvider>
      <BrowserRouter>
        <DemoBootstrapRedirect />
        <AppRoutes />
        <ToastViewport />
      </BrowserRouter>
    </QueryProvider>
  );
}
