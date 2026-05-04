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
 * One-shot redirect for the demo super_admin: every fresh page load lands
 * on the admissions command center, regardless of the URL the user typed
 * or refreshed at. The ref guard ensures this only fires on the initial
 * mount — subsequent in-app navigation is preserved.
 *
 * Public routes (landing/apply) are exempt so the public funnel still
 * works during demos.
 */
const PUBLIC_PATH_PREFIXES = ['/apply', '/staff-login', '/login', '/terms', '/help'];

function DemoBootstrapRedirect(): null {
  const navigate = useNavigate();
  const location = useLocation();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const user = useAuthStore.getState().user;
    if (user?.role !== 'super_admin') return;
    const isPublic = PUBLIC_PATH_PREFIXES.some((p) => location.pathname.startsWith(p));
    if (isPublic) return;
    if (location.pathname === ROUTES.admin.reports) return;
    navigate(ROUTES.admin.reports, { replace: true });
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
