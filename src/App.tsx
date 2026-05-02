import { BrowserRouter, useRoutes } from 'react-router-dom';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { ToastViewport } from '@/shared/components';
import { routes } from '@/routes';
import { useAuthStore } from '@/features/auth';
import { ROLE_DEFINITIONS } from '@/features/auth/rbac';

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
