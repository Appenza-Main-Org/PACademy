/**
 * AuthGuard — wraps protected routes (staff surface).
 * Source: Sprint 0 + ARCH-04 (public/private split).
 *
 * Redirects to /staff-login if not authenticated; if already authenticated
 * with insufficient role, sends back to the user's home (/applicant for
 * applicants, /hub for officers) with a toast.
 *
 * Architecture-page guard (AUD-006) — when used on /architecture, only
 * super_admin and admin-tier roles should pass.
 */

import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore, canAccessApp } from '@/features/auth';
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

  if (!user) {
    return <Navigate to={ROUTES.staffLogin} replace state={{ from: location.pathname }} />;
  }

  if (app && !canAccessApp(user.apps, app)) {
    toast('ليس لديك صلاحية الوصول لهذا التطبيق', 'danger');
    return <Navigate to={user.role === 'applicant' ? ROUTES.applicant : ROUTES.hub} replace />;
  }

  return <>{children}</>;
}
