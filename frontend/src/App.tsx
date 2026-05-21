import { BrowserRouter, useRoutes } from 'react-router-dom';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { ToastViewport } from '@/shared/components';
import { routes } from '@/routes';
import { useAuthStore } from '@/features/auth';
import { ROLE_DEFINITIONS } from '@/features/auth/rbac';
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

function AppRoutes(): JSX.Element {
  const element = useRoutes(routes);
  return <>{element}</>;
}

export function App(): JSX.Element {
  return (
    <QueryProvider>
      <BrowserRouter>
        <AppRoutes />
        <ToastViewport />
      </BrowserRouter>
    </QueryProvider>
  );
}
