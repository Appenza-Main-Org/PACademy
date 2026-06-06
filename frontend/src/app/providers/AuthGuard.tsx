/**
 * AuthGuard — wraps protected routes (staff surface).
 * Source: Sprint 0 + ARCH-04 (public/private split).
 *
 * Redirects to /staff-login if not authenticated; if already authenticated
 * with insufficient role, sends back to the user's default allowed page
 * with a toast.
 *
 * Architecture-page guard (AUD-006) — when used on /architecture, only
 * super_admin and admin-tier roles should pass.
 */

import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  useAuthStore,
  canAccessApp,
  getDefaultRouteForUser,
  hasPermission,
} from '@/features/auth';
import { toast } from '@/shared/components';
import type { AppKey } from '@/shared/lib/constants';
import { ROUTES } from '@/config/routes';

interface AuthGuardProps {
  children: ReactNode;
  app?: AppKey;
  /** Optional permission gate for sensitive routes inside an allowed app. */
  perm?: string | readonly string[];
}

export function AuthGuard({ children, app, perm }: AuthGuardProps): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!user) {
    /* Applicant-gated routes (and any /applicant/* URL) send the visitor
     * to the dedicated applicant login. All other gated routes use the
     * staff login. Preserve the full URL (path + query + hash) so the
     * login page can bounce the user back to where they were headed. */
    const isApplicantRoute = app === 'applicant' || location.pathname.startsWith('/applicant');
    const loginPath = isApplicantRoute ? ROUTES.applicantLogin : ROUTES.staffLogin;
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={loginPath} replace state={{ from }} />;
  }

  if (user.role === 'applicant' && app !== 'applicant') {
    toast('بوابة المتقدمين منفصلة عن تطبيقات الإدارة', 'danger');
    return <Navigate to={ROUTES.applicant} replace />;
  }

  const hasUniversalAccess = user.role === 'super_admin' || hasPermission(user.permissions, '*');
  if (app && !hasUniversalAccess && !canAccessApp(user.apps, app)) {
    toast('ليس لديك صلاحية الوصول لهذا التطبيق', 'danger');
    return <Navigate to={getDefaultRouteForUser(user)} replace />;
  }

  if (perm) {
    const required = Array.isArray(perm) ? perm : [perm];
    const allowed = required.some((p) => hasPermission(user.permissions, p));
    if (!allowed) {
      toast('ليس لديك صلاحية تنفيذ هذا الإجراء', 'danger');
      return <Navigate to={getDefaultRouteForUser(user)} replace />;
    }
  }

  return <>{children}</>;
}
