import { useEffect, useRef } from 'react';
import { BrowserRouter, useLocation, useNavigate, useRoutes } from 'react-router-dom';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { ToastViewport } from '@/shared/components';
import { routes } from '@/routes';
import { useAuthStore } from '@/features/auth';
import { ROLE_DEFINITIONS } from '@/features/auth/rbac';
import { ROUTES } from '@/config/routes';
import { setAuditActorProvider } from '@/shared/lib/audit';
import { setListActionPermissionsProvider } from '@/shared/lib/list-action-actor';

/* Register the auth-store as the audit actor source. shared/lib/audit
 * cannot import from features/, so the wiring lives at the app root. */
setAuditActorProvider(() => {
  const u = useAuthStore.getState().user;
  return u ? { id: u.id, name: u.name, role: u.role } : null;
});

/* Register the auth-store as the permission-snapshot source for the
 * universal list-actions stack. Same Clean Arch reason as above. */
setListActionPermissionsProvider(() => useAuthStore.getState().user?.permissions);

/**
 * Demo bootstrap — auto-seeds a super_admin user on startup so every URL
 * is reachable without going through /staff-login. Remove this block once
 * the real auth flow is integrated.
 */
function ensureDemoUser(): void {
  const store = useAuthStore.getState();
  if (store.user) return;
  /* Skip the auto-seed on public-applicant entry URLs so the new
   * /applicant-login flow isn't short-circuited by a pre-existing
   * super_admin in the store. */
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  if (path === '/' || path.startsWith('/applicant')) return;
  const def = ROLE_DEFINITIONS.super_admin;
  store.setUser({
    id: 'U-DEMO',
    name: 'العميد د. أحمد محمود الفقي',
    role: 'super_admin',
    roleLabel: def.labelAr,
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
const PUBLIC_PATH_PREFIXES = ['/applicant-login', '/staff-login', '/login', '/terms', '/help'];

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
    /* Only the reload case redirects super_admin to the command center.
     * Bare-root visits land on PublicLandingPage so applicants can use
     * /applicant-login. Direct navigation to any other URL is respected. */
    if (!isReloadNavigation()) return;
    if (location.pathname === '/') return;
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
