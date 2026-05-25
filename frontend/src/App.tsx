import { BrowserRouter, useRoutes } from 'react-router-dom';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { ToastViewport } from '@/shared/components';
import { routes } from '@/routes';
import { useAuthStore } from '@/features/auth';
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
