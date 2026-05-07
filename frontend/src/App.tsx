import { useEffect, useRef } from 'react';
import { BrowserRouter, useLocation, useNavigate, useRoutes } from 'react-router-dom';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { ToastViewport } from '@/shared/components';
import { routes } from '@/routes';
import { useAuthStore } from '@/features/auth';
import { ROLE_DEFINITIONS } from '@/features/auth/rbac';
import { ROUTES } from '@/config/routes';
import { setAuditActorProvider } from '@/shared/lib/audit';

/* Register the auth-store as the audit actor source. shared/lib/audit
 * cannot import from features/, so the wiring lives at the app root. */
setAuditActorProvider(() => {
  const u = useAuthStore.getState().user;
  return u ? { id: u.id, name: u.name, role: u.role } : null;
});

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
 * Demo super_admin redirect: when the user *reloads* the page (Cmd+R / F5)
 * or hits the bare root URL, land them on the admissions command center.
 * Direct navigation to a specific URL (typing the address, clicking a link,
 * back/forward) stays on that URL so all routes remain reachable.
 *
 * Reload detection uses the Performance Navigation API
 * (`performance.getEntriesByType('navigation')[0].type`).
 */
const PUBLIC_PATH_PREFIXES = ['/apply', '/staff-login', '/login', '/terms', '/help'];

function isReloadNavigation(): boolean {
  if (typeof performance === 'undefined') return false;
  const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  return entries[0]?.type === 'reload';
}

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
    /* Two cases redirect to the command center:
     *  1. User reloaded the page (Cmd+R / F5).
     *  2. User landed on the bare root "/".
     * Direct navigation to any other URL is respected. */
    if (!isReloadNavigation() && location.pathname !== '/') return;
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
