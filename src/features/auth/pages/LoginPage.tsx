/**
 * LoginPage — staff (officers) login at /staff-login.
 * Source: ARCH-03 (MOIPASS framing for officers, public/private split).
 *
 * Applicants don't reach this page — they use /apply instead.
 * After successful auth: redirect to /hub (or /admin if super_admin).
 */

import { Navigate } from 'react-router-dom';
import { Pattern } from '@/shared/components';
import { useAuthStore } from '../store/auth.store';
import { LoginArtPanel } from '../components/LoginArtPanel';
import { LoginForm } from '../components/LoginForm';
import { ROUTES } from '@/config/routes';

export function LoginPage(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  /* Already-authenticated visitors: applicants → applicant portal,
     all officers → staff hub. */
  if (user) {
    return <Navigate to={user.role === 'applicant' ? ROUTES.applicant : ROUTES.hub} replace />;
  }

  return (
    <div className="page-enter relative grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <LoginArtPanel />
      <section className="relative flex items-center justify-center overflow-hidden bg-surface-page px-6 py-10 lg:p-6">
        <Pattern variant="tessellation-8" tile={96} opacity={0.04} />
        <div className="relative w-full">
          <div className="mx-auto flex w-full items-center justify-center">
            <LoginForm />
          </div>
        </div>
      </section>
    </div>
  );
}
