/**
 * AuthGuard — wraps protected routes.
 * Redirects to /login if not authenticated.
 * Optionally checks app-level access via RBAC; if denied, redirects to hub with a toast.
 */

import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore, canAccessApp } from '@/features/auth';
import { toast } from '@/shared/components';
import type { AppKey } from '@/shared/lib/constants';

interface AuthGuardProps {
  children: ReactNode;
  app?: AppKey;
}

export function AuthGuard({ children, app }: AuthGuardProps): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (app && !canAccessApp(user.apps, app)) {
    toast('ليس لديك صلاحية الوصول لهذا التطبيق', 'danger');
    return <Navigate to={user.role === 'applicant' ? '/applicant' : '/'} replace />;
  }

  return <>{children}</>;
}
