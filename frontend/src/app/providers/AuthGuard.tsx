/**
 * AuthGuard — wraps protected routes (staff surface).
 * Redirects to /staff-login if not authenticated; if already authenticated
 * with insufficient role, sends back to the user's home with a toast.
 *
 * useMe() validates the session server-side on first mount so the Zustand
 * store stays in sync with the real backend session (T034 / FR-004).
 */

import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore, canAccessApp } from '@/features/auth';
import { useMe } from '@/features/auth/api/auth.queries';
import { toast } from '@/shared/components';
import type { AppKey } from '@/shared/lib/constants';
import { ROUTES } from '@/config/routes';

interface AuthGuardProps {
  children: ReactNode;
  app?: AppKey;
}

export function AuthGuard({ children, app }: AuthGuardProps): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  // Validate session server-side; syncs Zustand store as a side-effect.
  const { isLoading } = useMe();

  if (isLoading) {
    // Brief skeleton while the /auth/me request is in flight
    return <div aria-busy="true" aria-label="جارٍ التحميل…" className="min-h-screen" />;
  }

  if (!user) {
    return <Navigate to={ROUTES.staffLogin} replace state={{ from: location.pathname }} />;
  }

  if (app && !canAccessApp(user.apps, app)) {
    toast('ليس لديك صلاحية الوصول لهذا التطبيق', 'danger');
    return <Navigate to={user.role === 'applicant' ? ROUTES.applicant : ROUTES.hub} replace />;
  }

  return <>{children}</>;
}
